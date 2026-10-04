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
// ── Uma parcela fora da régua ───────────────────────────────────
// A parcela em aberto de um contrato é REESCRITA pela regra toda vez que a
// tela abre (parcelas, periodicidade, primeiro vencimento). Por isso mudar a
// data de uma delas direto na conta não adianta: no próximo render a regra
// escreve por cima. O ajuste mora no CONTRATO, como exceção anotada, e é
// aplicado por cima do que a regra gerou.
//
// É o caso do empreiteiro que pediu para adiar só a terceira medição: as
// outras seguem combinadas, e reescrever todas seria desfazer um acerto que
// ninguém desfez.
function ajustesDoContrato(contrato) {
  return (contrato && contrato.ajustesVencimento) || {};
}

// A exceção de VALOR, irmã da de vencimento. A parcela do contrato é
// recalculada toda vez que a tela abre, a partir da regra; sem guardar a
// exceção aqui, um valor corrigido à mão voltaria sozinho ao da regra no
// próximo render.
function ajustesDeValorDoContrato(contrato) {
  return (contrato && contrato.ajustesValor) || {};
}

// Mesma lógica de `ajustarVencimentos`: valor igual ao da regra não é
// exceção, e exceção que voltou a coincidir com a regra é apagada — senão
// mexer no valor do contrato depois não moveria mais essa parcela.
function ajustarValores(contrato, pagamentos) {
  const c = contrato || {};
  const daRegra = {};
  for (const l of contasDoContrato({ ...c, ajustesValor: null })) daRegra[l.id] = Math.round((Number(l.valor) || 0) * 100) / 100;
  const ajustes = { ...ajustesDeValorDoContrato(c) };
  for (const d of pagamentos || []) {
    if (!d || !d.id || d.valor == null || d.valor === "") continue;
    const novo = Math.round((typeof numeroDeCampo === "function" ? numeroDeCampo(d.valor) : Number(d.valor) || 0) * 100) / 100;
    if (!(novo > 0)) continue;
    if (Math.abs((daRegra[d.id] || 0) - novo) < 0.005) delete ajustes[d.id];
    else ajustes[d.id] = novo;
  }
  if (!Object.keys(ajustes).length) {
    const limpo = { ...c }; delete limpo.ajustesValor; return limpo;
  }
  return { ...c, ajustesValor: ajustes };
}

function ajustarVencimentos(contrato, datas) {
  const c = contrato || {};
  // O que a regra diria sem exceção nenhuma. Data igual à da regra NÃO vira
  // exceção — e uma exceção que voltou a coincidir com a regra é apagada.
  // Guardar as três parcelas quando só uma mudou congelaria as outras: mexer
  // na periodicidade do contrato depois não moveria mais nada.
  const daRegra = {};
  for (const l of contasDoContrato({ ...c, ajustesVencimento: null })) daRegra[l.id] = l.vencimento;
  const ajustes = { ...ajustesDoContrato(c) };
  for (const d of datas || []) {
    if (!d || !d.id || !d.vencimento) continue;
    const nova = String(d.vencimento).slice(0, 10);
    if (daRegra[d.id] === nova) delete ajustes[d.id];
    else ajustes[d.id] = nova;
  }
  if (!Object.keys(ajustes).length) return limparAjustes(c);
  return { ...c, ajustesVencimento: ajustes };
}

// Recalibrar o contrato inteiro é reescrever o calendário dele — as exceções
// anotadas antes deixam de fazer sentido e saem junto.
function limparAjustes(contrato) {
  const c = { ...(contrato || {}) };
  delete c.ajustesVencimento;
  delete c.ajustesValor;
  return c;
}

function contasDoContrato(contrato) {
  const c = contrato || {};
  const servico = typeof servicoDoContrato === "function" ? servicoDoContrato(c) : "Serviços";
  const ajustes = ajustesDoContrato(c);
  const ajustesV = ajustesDeValorDoContrato(c);
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
    // O contrato que é de UMA etapa (o serralheiro do portão, o pintor)
    // passa a etapa para as parcelas. O de obra civil, que atravessa a obra,
    // fica em branco — a regra da transação sabe disso.
    etapa: c.etapa || "",
    prestadorId: c.prestadorId || "",
    favorecido: c.nomeContratado || "",
    descricao: p.descricao,
    valor: ajustesV[`${c.id}:${idx + 1}`] != null ? ajustesV[`${c.id}:${idx + 1}`] : p.valor,
    valorAjustado: ajustesV[`${c.id}:${idx + 1}`] != null,
    vencimento: ajustes[`${c.id}:${idx + 1}`] || p.vencimento || "",
    ajustada: !!ajustes[`${c.id}:${idx + 1}`],
    estimada: !!p.estimada && !ajustes[`${c.id}:${idx + 1}`],
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
    // A parcela em aberto é reescrita pela regra do contrato, mas o que
    // alguém anotou ou registrou nela não é da regra — fica. O número de
    // documento também: é por ele que a nota e o comprovante se amarram a
    // esta parcela na prestação de contas, e um número que muda a cada
    // abertura da tela não amarra nada.
    return { ...nova, observacao: anterior.observacao || "", registros: anterior.registros || [],
      ...(anterior.numeroDoc ? { numeroDoc: anterior.numeroDoc } : {}) };
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

// Quantos dias faltam para vencer — negativo quando já passou.
function diasParaVencer(conta, hoje) {
  const venc = (conta || {}).vencimento;
  if (!venc) return null;
  return diasEntreIso(hoje || dataParaIso(new Date()), venc);
}

// "Vence em 7d" é o nome da FAIXA (vence dentro de uma semana), e numa conta
// que vence hoje ele faz o olho relaxar justamente no dia de pagar. Aqui o
// texto conta os dias de verdade, então muda sozinho quando a data muda —
// e, no vencido, diz há quanto tempo, que é o que a loja pergunta.
// A faixa (situacaoConta) continua a mesma: é dela que vivem os totais e os
// filtros. O que muda é só a frase.
function rotuloSituacaoConta(conta, hoje) {
  const situacao = situacaoConta(conta, hoje);
  if (situacao !== "vencido" && situacao !== "vencendo") {
    return SITUACAO_CONTA[situacao] || SITUACAO_CONTA.aberto;
  }
  const dias = diasParaVencer(conta, hoje);
  if (dias == null) return SITUACAO_CONTA.semData;
  if (dias === 0) return { label: "Vence hoje", forte: true };
  if (dias === 1) return { label: "Vence amanhã", forte: false };
  if (dias > 1) return { label: `Vence em ${dias} dias`, forte: false };
  const atraso = -dias;
  if (atraso === 1) return { label: "Venceu ontem", forte: true };
  return { label: `Vencida há ${atraso} dias`, forte: true };
}
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
// ── O número de referência da transação ─────────────────────────
// Cada conta a pagar ganha um número da sequência única da casa — a mesma
// que numera contratos e pedidos. É por ele que a prestação de contas acha
// o lançamento e os papéis dele, e por isso ele não pode ser o id interno:
// "0147" se dita ao telefone, "lhpipxm" não.
//
// Quem já tem número não é renumerado: o número é do papel, e papel
// entregue não muda de nome.
// O numero de referencia e da TRANSACAO, nao da linha: o pedido da loja e
// uma nota e um debito no banco, por mais que vire onze contas a pagar — as
// onze carregam o mesmo numero, e e por ele que a nota e o comprovante se
// amarram ao conjunto. Parcela de contrato e o contrario: cada parcela e um
// pagamento seu, com numero proprio.
function numerarContas(contas, obras, lancamentos) {
  const faltando = (contas || []).filter((c) => c && !c.numeroDoc);
  if (!faltando.length) return contas || [];
  let n = parseInt(String(proximoNumeroDoc(obras, lancamentos)).replace(/\D/g, ""), 10);
  if (!Number.isFinite(n)) n = 1;
  // um pedido ja numerado empresta o numero dele aos itens que chegarem depois
  const porPedido = {};
  for (const c of contas || []) {
    if (c && c.pedidoId && c.numeroDoc && !porPedido[c.pedidoId]) porPedido[c.pedidoId] = c.numeroDoc;
  }
  const novos = {};
  for (const c of faltando) {
    const chave = c.pedidoId || "";
    if (chave && porPedido[chave]) { novos[c.id] = porPedido[chave]; continue; }
    const numero = String(n).padStart(4, "0"); n++;
    novos[c.id] = numero;
    if (chave) porPedido[chave] = numero;
  }
  return (contas || []).map((c) => (c && novos[c.id] ? { ...c, numeroDoc: novos[c.id] } : c));
}

// O próximo número para UMA transação só — o lançamento do escritório, que
// não nasce em lista.
function proximaReferencia(obras, lancamentos) {
  return proximoNumeroDoc(obras, lancamentos);
}

// A medição vira conta por item só quando o pagamento é de uma vez. Com
// parcelas, sinal ou entregas, as contas voltam a ser por parcela — e aí o
// item não cabe nelas.
function cpMedicaoEmUmaData(d) {
  const dd = d || {};
  if (!((dd.medicao || []).length)) return false;
  if (dd.modo === "entregas" || dd.modo === "sinalFinal" || dd.modo === "sinalParcelas") return false;
  if ((dd.entregas || []).some((e) => e && valorDaEntrega(e) > 0)) return false;
  return Math.max(1, Math.floor(Number(dd.parcelas) || 1)) === 1;
}

// ── Quantidade, preço e valor: um acerta o outro ────────────────
// Três números que dizem a mesma coisa de dois jeitos, e por isso não podem
// divergir. Mexeu na quantidade ou no unitário, o valor se refaz; mexeu no
// valor — porque foi o que o fornecedor cobrou —, o unitário se refaz para
// explicar esse valor. É o mesmo acerto da tela de proposta, onde preencher
// o unitário OU o total dá no mesmo.
//
// Sem quantidade não há o que acertar: a conta é um valor seco, como sempre
// foi, e continua podendo ser editada assim.
function conciliarValorDaConta(conta, campo, valorDigitado) {
  const n = (v) => (typeof numeroDeCampo === "function" ? numeroDeCampo(v) : Number(v) || 0);
  const red = (x) => Math.round(x * 100) / 100;
  const c = { ...(conta || {}) };
  if (campo === "quantidade") c.quantidade = valorDigitado;
  if (campo === "unitario") c.unitario = valorDigitado;
  if (campo === "valor") c.valor = valorDigitado;
  const q = n(c.quantidade);
  const u = n(c.unitario);
  const v = n(c.valor);
  if (campo === "valor") {
    // o valor manda: o unitário passa a ser o que explica esse valor
    if (q > 0) c.unitario = red(v / q);
    return c;
  }
  if (q > 0 && u > 0) { c.valor = red(q * u); return c; }
  // quantidade sem preço: o unitário sai do valor que já estava lá
  if (campo === "quantidade" && q > 0 && v > 0 && !(u > 0)) { c.unitario = red(v / q); return c; }
  return c;
}

// O que mudou nesta conta, em uma linha, para o registro do ato. Na
// prestacao de contas o que importa nao e que alguem editou: e que o
// concreto passou de 11 para 7 m3 e a conta caiu de 3.780,04 para 2.405,48.
function detalheDaEdicaoDaConta(antes, depois) {
  const a = antes || {}, d = depois || {};
  const n = (v) => (typeof numeroDeCampo === "function" ? numeroDeCampo(v) : Number(v) || 0);
  const q = (v) => {
    const x = n(v);
    return String(Math.round(x * 1000) / 1000).replace(".", ",");
  };
  const un = String(d.unidade || a.unidade || "").trim();
  const partes = [];
  if (n(a.quantidade) !== n(d.quantidade)) {
    partes.push("quantidade " + q(a.quantidade) + " \u2192 " + q(d.quantidade) + (un ? " " + un : ""));
  }
  if (n(a.unitario) !== n(d.unitario)) {
    partes.push("unit\u00e1rio " + cpDinheiro(n(a.unitario)) + " \u2192 " + cpDinheiro(n(d.unitario)));
  }
  if (n(a.valor) !== n(d.valor)) {
    partes.push("valor " + cpDinheiro(n(a.valor)) + " \u2192 " + cpDinheiro(n(d.valor)));
  }
  if (String(a.etapa || "") !== String(d.etapa || "")) {
    partes.push("etapa " + (a.etapa || "\u2014") + " \u2192 " + (d.etapa || "\u2014"));
  }
  if (String(a.vencimento || "") !== String(d.vencimento || "")) {
    partes.push("vencimento " + (a.vencimento || "\u2014") + " \u2192 " + (d.vencimento || "\u2014"));
  }
  return partes.join("; ");
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
    registros: [],
  };
}

// ── Contas nascidas direto de uma cotação ───────────────────────
// Nem toda compra vira contrato: material de fornecedor — aço, cimento,
// esquadria pronta — se resolve na nota fiscal e no boleto. Para esses, a
// cotação escolhida vira conta a pagar direto, sem passar pelo contrato e
// sem esperar o aval do cliente, que é o que o contrato existe para pedir.
//
// As parcelas saem da mesma divisão dos contratos (o resíduo do
// arredondamento vai na última), e todas carregam `cotacaoId` — é por ele
// que o lançamento se desfaz inteiro, se for o caso.
const CP_ORIGEM_COTACAO = "cotacao";

function entregaVazia() { return { descricao: "", valor: "", vencimento: "" }; }

// O campo da entrega é digitado à mão, em português: "9.690,00" tem que valer
// o mesmo que 9690. É o mesmo parser que lê o valor das propostas.
function valorDaEntrega(e) {
  const v = (e || {}).valor;
  if (typeof numeroDeCampo === "function") return numeroDeCampo(v);
  const n = parseFloat(String(v == null ? "" : v).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

// Entrega parcelada NÃO é parcela: cada entrega tem nome, valor próprio e
// data própria, e o fornecedor recebe na entrega. Uma conta por linha, com o
// nome da entrega na descrição — é assim que a obra reconhece o pagamento
// quando o caminhão chega.
function contasDasEntregas(dados, novoId) {
  const d = dados || {};
  const id = typeof novoId === "function" ? novoId : (typeof uid === "function" ? uid : () => String(Date.now()));
  const hoje = dataParaIso(new Date());
  const linhas = (d.entregas || []).filter((e) => e && valorDaEntrega(e) > 0);
  return linhas.map((e, i) => ({
    id: id(),
    origem: CP_ORIGEM_COTACAO,
    obraId: d.obraId || "",
    contratoId: "",
    cotacaoId: d.cotacaoId || "",
    numeroPedido: d.numeroPedido || "",
    parcela: linhas.length > 1 ? i + 1 : 0,
    parcelasTotal: linhas.length > 1 ? linhas.length : 0,
    contaId: d.contaId || (typeof PLANO_CONTAS !== "undefined" && PLANO_CONTAS[0] ? PLANO_CONTAS[0].id : "material"),
    prestadorId: d.prestadorId || "",
    favorecido: d.favorecido || "",
    descricao: [String(d.descricao || "Compra").trim(), String(e.descricao || "").trim()].filter(Boolean).join(" — ")
               || `Entrega ${i + 1}`,
    valor: Math.round(valorDaEntrega(e) * 100) / 100,
    vencimento: String(e.vencimento || "").slice(0, 10) || hoje,
    pago: false, pagoEm: "", valorPago: "", observacao: d.observacao || "",
  }));
}

// Soma das entregas, para a tela poder avisar quando ela não fecha com o
// valor cotado — divergir é permitido (entrega a mais, saldo negociado),
// mas passar batido não.
function totalDasEntregas(entregas) {
  const soma = (entregas || []).reduce((s, e) => s + valorDaEntrega(e), 0);
  return Math.round(soma * 100) / 100;
}

// ── Conta na loja: a compra que não acaba ──────────────────
// Loja de material não se cota a cada saco de cimento: abre-se conta, compra-se
// todo dia e paga-se tudo junto no fim do prazo. Por isso uma cotação por loja,
// aberta o mês inteiro recebendo PEDIDOS, em vez de quinze cotações de R$ 60.
//
// O pedido é o papel que a loja emite: um número dela, uma data, itens com
// quantidade e preço — e um desconto que vem no rodapé, nunca no item.

function pedidoVazio(numero) {
  const id = (typeof uid === "function" ? uid() : String(Date.now()));
  return {
    id, numero: numero || "", numeroLoja: "", numeroNota: "",
    data: dataParaIso(new Date()), vencimento: "",
    itens: [], desconto: 0, observacao: "",
  };
}

function itemDoPedidoVazio() {
  return {
    id: (typeof uid === "function" ? uid() : String(Date.now())),
    codigoLoja: "", descricao: "", insumoCodigo: "", grupoMaterial: "",
    quantidade: "", unidade: "", unitario: "", bruto: "",
    etapa: "", contaId: "",
  };
}

// Valor digitado em português ("1.234,50") vale o mesmo que 1234.5.
function cpNumero(v) {
  if (typeof numeroDeCampo === "function") return numeroDeCampo(v);
  const n = parseFloat(String(v == null ? "" : v).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

// O valor de tabela do item: o subtotal do papel, ou quantidade × unitário
// quando a loja só mandou os dois.
function brutoDoItem(item) {
  const i = item || {};
  const sub = cpNumero(i.bruto);
  if (sub > 0) return Math.round(sub * 100) / 100;
  return Math.round(cpNumero(i.quantidade) * cpNumero(i.unitario) * 100) / 100;
}

function brutoDoPedido(pedido) {
  const itens = ((pedido || {}).itens || []).filter((i) => i && brutoDoItem(i) > 0);
  return Math.round(itens.reduce((s, i) => s + brutoDoItem(i), 0) * 100) / 100;
}

function totalDoPedido(pedido) {
  const p = pedido || {};
  return Math.round((brutoDoPedido(p) - cpNumero(p.desconto)) * 100) / 100;
}

// O desconto do rodapé rateado pelos itens. Sem isto a soma dos itens não
// bate com o que se paga, e a diferença some do P&L sem etapa nenhuma — foi
// exatamente o que quebrou a conciliação da planilha. O resíduo de centavos
// vai no maior item, como nas parcelas do contrato.
function itensRateados(pedido) {
  const red = (x) => Math.round(x * 100) / 100;
  const itens = ((pedido || {}).itens || []).filter((i) => i && brutoDoItem(i) > 0);
  const bruto = brutoDoPedido(pedido);
  const total = totalDoPedido(pedido);
  if (!itens.length || bruto <= 0) return [];
  if (Math.abs(bruto - total) < 0.005) return itens.map((i) => ({ ...i, valor: brutoDoItem(i) }));
  const fator = total / bruto;
  const fora = itens.map((i) => ({ ...i, valor: red(brutoDoItem(i) * fator) }));
  const resto = red(total - fora.reduce((s, i) => s + i.valor, 0));
  if (Math.abs(resto) >= 0.005) {
    let maior = 0;
    for (let k = 1; k < fora.length; k++) if (fora[k].valor > fora[maior].valor) maior = k;
    fora[maior] = { ...fora[maior], valor: red(fora[maior].valor + resto) };
  }
  return fora;
}

// Uma conta a pagar POR ITEM, não por pedido. É o que faz o P&L por etapa e a
// abertura por subconta funcionarem sem nenhum código novo: eles já leem
// `etapa` e `grupoMaterial` de cada conta. O `pedidoId` costura tudo de volta.
function contasDoPedidoDaLoja(dados, pedido, novoId) {
  const d = dados || {}, p = pedido || {};
  const id = typeof novoId === "function" ? novoId : (typeof uid === "function" ? uid : () => String(Date.now()));
  const venc = String(p.vencimento || "").slice(0, 10) || dataParaIso(new Date());
  const padrao = d.contaId || (typeof PLANO_CONTAS !== "undefined" && PLANO_CONTAS[0] ? PLANO_CONTAS[0].id : "material");
  return itensRateados(p).map((i) => ({
    id: id(),
    origem: CP_ORIGEM_COTACAO,
    obraId: d.obraId || "",
    contratoId: "",
    cotacaoId: d.cotacaoId || "",
    pedidoId: p.id || "",
    numeroPedido: p.numero || "",
    numeroLoja: p.numeroLoja || "",
    numeroNota: p.numeroNota || "",
    pixCopiaECola: p.pixCopiaECola || "",
    parcela: 0, parcelasTotal: 0,
    contaId: i.contaId || padrao,
    etapa: i.etapa || "",
    grupoMaterial: i.grupoMaterial || "",
    insumoCodigo: i.insumoCodigo || "",
    prestadorId: d.prestadorId || "",
    favorecido: d.favorecido || "",
    descricao: String(i.descricao || "").trim() || "Item",
    quantidade: cpNumero(i.quantidade) || 0,
    unidade: String(i.unidade || "").trim(),
    valor: i.valor,
    vencimento: venc,
    pago: false, pagoEm: "", valorPago: "", observacao: d.observacao || "",
  }));
}

// ── A Entrada vira contas a pagar ───────────────────────
// Uma tela só para qualquer papel: itens (cada um com item do catálogo,
// etapa e conta), fornecedor, e a situação — A PAGAR (com 1º vencimento,
// parcelas e intervalo) ou PAGO (data e jeito de pagar). Uma conta POR ITEM
// e POR PARCELA, como no pedido da loja: é o que faz o custo por etapa, o
// P&L por insumo e a baixa de cada boleto funcionarem.
//
// Cada parcela é um pedido próprio (pagar o 1º boleto não paga o 2º), mas a
// transação é uma só: todas as contas levam o MESMO número de referência e
// a mesma nota. A quantidade se divide entre as parcelas na proporção do
// valor — somadas, dão a quantidade da nota, e o preço unitário não muda.
//
// `op`: { obraId, numeroDoc, quem, agora, novoId, anexo,
//         cartao, planoDoCartao(conta, cartao, dados) }
function contasDaEntrada(lanc, op) {
  const l = lanc || {}, o = op || {};
  const red = (x) => Math.round(x * 100) / 100;
  const id = typeof o.novoId === "function" ? o.novoId : (typeof uid === "function" ? uid : () => String(Date.now()) + Math.random());
  const agora = o.agora || new Date().toISOString();
  const pago = l.situacao === "pago";
  const itens = (l.itens || []).map((i) => {
    const q = cpNumero(i.quantidade), u = cpNumero(i.unitario), t = cpNumero(i.total);
    return { ...i, _valor: red(t > 0 ? t : q * u), _q: q };
  }).filter((i) => i._valor > 0);
  if (!itens.length) return [];
  const pg = l.pagamento || {}, ap = l.apagar || {};
  const n = pago ? 1 : Math.max(1, Math.floor(Number(ap.parcelas) || 1));
  const intervalo = Math.max(1, Math.floor(Number(ap.intervalo) || 30));
  const primeiro = String((pago ? pg.data : ap.vencimento) || "").slice(0, 10) || dataParaIso(new Date());
  const anexos = o.anexo ? [o.anexo] : [];
  const fora = [];
  const qUsada = itens.map(() => 0);
  for (let p = 0; p < n; p++) {
    const pedidoId = id();
    const venc = p === 0 ? primeiro : somarDias(primeiro, p * intervalo);
    for (let k = 0; k < itens.length; k++) {
      const it = itens[k];
      const base = red(it._valor / n);
      const valor = p === n - 1 ? red(it._valor - base * (n - 1)) : base;
      // A última parcela leva o que sobrou da quantidade, como leva o centavo.
      let q = 0;
      if (it._q > 0) {
        q = n === 1 ? it._q : (p === n - 1 ? Math.round((it._q - qUsada[k]) * 1000) / 1000
          : Math.round((it._q * valor / it._valor) * 1000) / 1000);
        qUsada[k] = Math.round((qUsada[k] + q) * 1000) / 1000;
      }
      let c = {
        id: id(), origem: "avulsa", obraId: o.obraId || l.obraId || "", contratoId: "", cotacaoId: "",
        pedidoId, numeroNota: String(l.numeroNota || "").trim(), numeroDoc: o.numeroDoc || "",
        parcela: n > 1 ? p + 1 : 0, parcelasTotal: n > 1 ? n : 0,
        contaId: it.contaId || "", etapa: it.etapa || "", grupoMaterial: it.grupoMaterial || "",
        insumoCodigo: it.insumoCodigo || "",
        prestadorId: l.prestadorId || "", favorecido: l.favorecido || "",
        descricao: (String(it.descricao || "").trim() || "Item") + (n > 1 ? ` (parcela ${p + 1}/${n})` : ""),
        quantidade: q, unidade: String(it.unidade || "").trim(),
        valor, vencimento: venc,
        pago: false, pagoEm: "", valorPago: "", observacao: String(l.observacao || "").trim(),
        chaveNota: String(l.chaveNota || "").replace(/\D/g, ""), idTransacao: String(l.idTransacao || "").trim().toUpperCase(),
      };
      c = registrarAto(c, "criada", o.quem || "", agora);
      if (pago) {
        c = contaPaga(c, { pagoEm: primeiro, valorPago: valor, comprovante: o.anexo || null }, o.quem || "", agora);
        const plano = pg.forma === "cartao" && o.cartao && typeof o.planoDoCartao === "function"
          ? o.planoDoCartao(c, o.cartao, { pagoEm: primeiro, valorPago: valor, parcelas: pg.parcelas }) : null;
        c = plano ? { ...c, ...plano } : { ...c, formaPagamento: "avista" };
      } else if (anexos.length) {
        c = { ...c, anexos };
      }
      fora.push(c);
    }
  }
  return fora;
}

// O mesmo papel não pode entrar duas vezes — nem nesta obra, nem em outra.
// A chave da NF-e (44 dígitos) e o ID do Pix (E2E) são únicos no país:
// achou um igual, é o mesmo papel. Devolve onde ele já está, ou null.
function papelJaLancado(obras, papel) {
  const p = papel || {};
  const chave = String(p.chaveNota || "").replace(/\D/g, "");
  const idt = String(p.idTransacao || "").trim().toUpperCase();
  const temChave = chave.length === 44, temId = idt.length >= 20;
  if (!temChave && !temId) return null;
  for (const o of obras || []) {
    for (const c of (o && o.contasPagar) || []) {
      if (!c) continue;
      const porChave = temChave && String(c.chaveNota || "").replace(/\D/g, "") === chave;
      const porId = temId && String(c.idTransacao || "").trim().toUpperCase() === idt;
      if (porChave || porId) {
        return { obraId: o.id, obraNome: o.nome || o.titulo || "", ref: c.numeroDoc || "", por: porChave ? "chave" : "pix" };
      }
    }
  }
  return null;
}

// ── Papéis em lote: de qual lançamento é este papel ─────────────
// A obra já tem as contas; os papéis (nota, Pix, boleto) chegaram depois,
// numa pasta. Cada papel procura o seu lançamento pela referência (o
// numeroDoc, que junta os itens de uma compra): o mesmo valor, o mesmo
// fornecedor, a data perto. Nota dividida em etapas vira duas ou três refs
// seguidas do mesmo fornecedor — a soma delas também é candidata. Chave da
// NF-e ou ID do Pix iguais encerram a conversa. O que não for seguro fica
// para a pessoa escolher; nada é anexado sem ela confirmar.
const CP_PALAVRAS_VAZIAS = ["ltda", "eireli", "me", "epp", "sa", "comercio", "comercial", "de", "da", "do", "das", "dos", "e",
  "materiais", "material", "construcao", "construcoes", "industria", "servicos", "servico", "cia", "filial", "loja"];
function cpPalavrasDoNome(nome) {
  return String(nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length >= 3 && CP_PALAVRAS_VAZIAS.indexOf(w) < 0);
}
function cpDiasEntre(a, b) {
  const da = Date.parse(String(a || "").slice(0, 10)), db = Date.parse(String(b || "").slice(0, 10));
  if (!(da > 0) || !(db > 0)) return null;
  return Math.round(Math.abs(da - db) / 86400000);
}
function cpMesmoNome(a, b) {
  const pa = cpPalavrasDoNome(a), pb = cpPalavrasDoNome(b);
  return pa.some((w) => pb.some((x) => x === w || (Math.min(w.length, x.length) >= 5 && (x.startsWith(w) || w.startsWith(x)))));
}

function gruposDeContasPorRef(contas, prestadores) {
  const nomeDe = (id) => ((prestadores || []).find((p) => p && p.id === id) || {}).nome || "";
  const mapa = new Map();
  for (const c of contas || []) {
    if (!c) continue;
    const ref = String(c.numeroDoc || c.pedidoId || c.id);
    if (!mapa.has(ref)) mapa.set(ref, []);
    mapa.get(ref).push(c);
  }
  const red = (x) => Math.round(x * 100) / 100;
  return [...mapa.entries()].map(([ref, cs]) => {
    const c0 = cs[0];
    return {
      ref, contaIds: cs.map((c) => c.id),
      valor: red(cs.reduce((t, c) => t + (Number(c.valorPago) || Number(c.valor) || 0), 0)),
      prestadorId: c0.prestadorId || "", favorecido: nomeDe(c0.prestadorId) || c0.favorecido || "",
      data: String(c0.pagoEm || c0.vencimento || "").slice(0, 10),
      numeroNota: String(c0.numeroNota || "").replace(/^0+/, ""),
      chaveNota: String(c0.chaveNota || ""), idTransacao: String(c0.idTransacao || "").toUpperCase(),
      descricao: cs.map((c) => c.descricao).filter(Boolean).slice(0, 2).join(" + "),
      anexos: cs.reduce((t, c) => t + (Array.isArray(c.anexos) ? c.anexos.length : 0) + (c.comprovante ? 1 : 0), 0),
    };
  }).sort((a, b) => (Number(a.ref) || 0) - (Number(b.ref) || 0) || a.ref.localeCompare(b.ref));
}

function casarPapelComContas(papel, grupos, opcoes) {
  const p = papel || {}, op = opcoes || {};
  const valor = Math.round((Number(p.valor) || Number(p.total) || 0) * 100) / 100;
  const data = String(p.pagoEm || p.vencimento || p.emitido || "").slice(0, 10);
  const numero = String(p.numeroNota || p.numeroPedido || "").replace(/^0+/, "");
  const chave = String(p.chave || "").replace(/\D/g, ""), idt = String(p.idTransacao || "").toUpperCase();
  const lista = grupos || [];
  const pontuar = (gs, soma) => {
    const vg = Math.round(gs.reduce((t, g) => t + g.valor, 0) * 100) / 100;
    const base = { refs: gs.map((g) => g.ref), contaIds: [].concat(...gs.map((g) => g.contaIds)), valor: vg,
      favorecido: gs[0].favorecido, data: gs[0].data, descricao: gs.map((g) => g.descricao).join(" + ") };
    if ((chave.length === 44 && gs.some((g) => g.chaveNota === chave)) || (idt && gs.some((g) => g.idTransacao === idt))) {
      return { ...base, pontos: 200, motivos: ["mesmo papel (chave/ID)"] };
    }
    let pontos = 0; const motivos = [];
    if (valor > 0 && Math.abs(vg - valor) < 0.01) { pontos += soma ? 40 : 50; motivos.push(soma ? "soma das refs" : "mesmo valor"); }
    if (numero && gs.some((g) => g.numeroNota && g.numeroNota === numero)) { pontos += 30; motivos.push("mesmo nº"); }
    if (p.lidoComo && cpMesmoNome(p.lidoComo, gs.map((g) => g.favorecido).join(" "))) { pontos += 20; motivos.push("mesmo fornecedor"); }
    const d = cpDiasEntre(data, gs[0].data);
    if (d != null) {
      if (d === 0) { pontos += 15; motivos.push("mesma data"); }
      else if (d <= 3) { pontos += 10; motivos.push(d + " dia(s) de diferença"); }
      else if (d <= 10) { pontos += 5; motivos.push(d + " dias de diferença"); }
      else if (d > 60) pontos -= 5;
    }
    return { ...base, pontos, motivos };
  };
  const candidatos = [];
  for (const g of lista) {
    const c = pontuar([g], false);
    if (c.pontos >= 200 || c.motivos.indexOf("mesmo valor") >= 0 || c.motivos.indexOf("mesmo nº") >= 0) candidatos.push(c);
  }
  // Nota dividida em etapas: 2 a 4 refs seguidas do mesmo fornecedor.
  if (valor > 0 && !candidatos.some((c) => c.motivos.indexOf("mesmo valor") >= 0)) {
    const mesmo = (a, b) => (a.prestadorId && a.prestadorId === b.prestadorId)
      || (!!a.favorecido && cpPalavrasDoNome(a.favorecido).join(" ") === cpPalavrasDoNome(b.favorecido).join(" "));
    for (let i = 0; i < lista.length; i++) {
      for (let n = 2; n <= 5 && i + n <= lista.length; n++) {
        const gs = lista.slice(i, i + n);
        if (!gs.every((g) => mesmo(g, gs[0]))) break;
        const c = pontuar(gs, true);
        if (c.motivos.indexOf("soma das refs") >= 0) candidatos.push(c);
      }
    }
  }
  candidatos.sort((a, b) => b.pontos - a.pontos || cpDiasEntre(data, a.data) - cpDiasEntre(data, b.data));
  const top = candidatos.slice(0, op.max || 12);
  const [a, b] = top;
  // Empate de valor e fornecedor (os pedágios de 12,80): não há como saber
  // qual é qual — tanto faz para a conta, mas a pessoa confirma.
  const empate = !!a && !!b && a.pontos < 200 && Math.abs(a.valor - b.valor) < 0.01 && b.pontos >= a.pontos - 15;
  const seguro = !!a && (a.pontos >= 200 || (a.pontos >= 50 && !empate && (!b || a.pontos - b.pontos >= 20)));
  return { candidatos: top, seguro, empate };
}

// A planilha de ligação diz, para cada arquivo, a referência do lançamento:
// "4113;0062+0063+0064". O arquivo é achado pelo número no começo do nome
// ("4113.pdf", "4113 - nota.pdf"). Linha que não se entende é ignorada.
function numeroDoArquivo(nome) {
  const m = String(nome || "").match(/^\s*(\d{3,})/);
  return m ? String(Number(m[1])) : "";
}
function ligacaoDoCsv(texto) {
  const mapa = new Map();
  for (const linha of String(texto || "").split(/\r?\n/)) {
    const partes = linha.split(/[;,\t]/).map((x) => x.trim());
    const num = numeroDoArquivo(partes[0]);
    const refs = String(partes[1] || "").split("+").map((r) => r.replace(/\D/g, "")).filter(Boolean)
      .map((r) => r.padStart(4, "0"));
    if (num && refs.length) mapa.set(num, refs);
  }
  return mapa;
}

// No lote, cada conta recebe UM papel de cada espécie (a nota e o
// comprovante podem ir juntos; dois comprovantes não). Quem tem casamento
// seguro escolhe primeiro; os empates vão sendo distribuídos pela data,
// sem repetir conta.
function distribuirPapeisDoLote(lidos) {
  const tomadas = { comprovante: new Set(), nota: new Set() };
  const especie = (l) => ((l.papel || {}).tipo === "comprovante" ? "comprovante" : "nota");
  const ordem = (lidos || []).map((l, i) => ({ l, i })).filter((x) => x.l && x.l.casamento)
    .sort((x, y) => (y.l.casamento.seguro - x.l.casamento.seguro) || (((y.l.casamento.candidatos[0] || {}).pontos || 0) - ((x.l.casamento.candidatos[0] || {}).pontos || 0)));
  const saida = (lidos || []).map(() => null);
  for (const { l, i } of ordem) {
    const t = tomadas[especie(l)];
    const livre = l.casamento.candidatos.find((c) => !c.refs.some((r) => t.has(r)));
    if (!livre) { saida[i] = { escolhido: null, marcado: false }; continue; }
    livre.refs.forEach((r) => t.add(r));
    const primeiro = l.casamento.candidatos[0] === livre;
    saida[i] = { escolhido: livre, marcado: l.casamento.seguro && primeiro };
  }
  return saida;
}

// A conta contábil é quase sempre a mesma no pedido inteiro ("Material").
// Repetida em cada item ela vira ruído e empurra para fora da linha o que
// muda de item para item — quantidade, unidade e preço. No cabeçalho ela
// aparece uma vez só. Quando o pedido mistura contas, o cabeçalho diz isso
// em vez de esconder: é informação contábil, não detalhe.
function contasDoPedidoDeConta(contas) {
  const vistos = [];
  for (const c of contas || []) {
    const id = (c && c.contaId) || "";
    if (id && vistos.indexOf(id) < 0) vistos.push(id);
  }
  return vistos;
}

// O unitário não é guardado: sai do valor já rateado dividido pela
// quantidade. E é assim que tem que ser — com desconto no pedido, o preço
// de tabela não é o que se paga, e quem confere a conta quer o que se paga.
function unitarioDaConta(conta) {
  const c = conta || {};
  const q = cpNumero(c.quantidade);
  if (!(q > 0)) return null;
  const v = cpNumero(c.pago ? (c.valorPago || c.valor) : c.valor);
  if (!(v > 0)) return null;
  return Math.round((v / q) * 100) / 100;
}

// O que impede o pedido de entrar torto. Item sem etapa é erro, e não aviso:
// é assim que "Sem etapa" para de crescer no quadro da obra.
// O que identifica a compra na loja: o número do PEDIDO ou o da NOTA. Nota
// fiscal não tem número de pedido — exigir um deixava quem anexou a nota
// sem saída, tendo que inventar um número para conseguir lançar. Qualquer
// um dos dois identifica; nenhum dos dois, não.
// A chave ignora pontos, traços e zeros à esquerda: "000.008.623" e "8623"
// são a mesma nota, e sem isso ela entraria duas vezes.
function chaveDoDocumento(s) {
  const t = String(s || "").replace(/[\s./-]/g, "").toLowerCase();
  return /^\d+$/.test(t) ? t.replace(/^0+/, "") : t;
}

function validarPedido(pedido, pedidosDaLoja) {
  const p = pedido || {};
  const erros = [];
  const chave = chaveDoDocumento;
  const itens = (p.itens || []).filter((i) => i && brutoDoItem(i) > 0);
  if (!itens.length) erros.push("O pedido não tem nenhum item com valor.");
  const temPedido = !!String(p.numeroLoja || "").trim();
  const temNota = !!String(p.numeroNota || "").trim();
  if (!temPedido && !temNota) {
    erros.push("Informe o número do pedido da loja ou o número da nota fiscal.");
  } else {
    const repetido = (campo, rotulo) => {
      const meu = chave(p[campo]);
      if (!meu) return;
      const outro = (pedidosDaLoja || []).find((o) => o && o.id !== p.id && chave(o[campo]) === meu);
      if (outro) erros.push(`${rotulo} ${p[campo]} já foi lançad${rotulo === "A nota" ? "a" : "o"} nesta loja.`);
    };
    repetido("numeroLoja", "O pedido");
    repetido("numeroNota", "A nota");
  }
  const semEtapa = itens.filter((i) => !String(i.etapa || "").trim()).length;
  if (semEtapa) {
    erros.push(semEtapa === 1 ? "1 item está sem etapa." : `${semEtapa} itens estão sem etapa.`);
  }
  const soma = Math.round(itensRateados(p).reduce((s, i) => s + i.valor, 0) * 100) / 100;
  if (itens.length && Math.abs(soma - totalDoPedido(p)) >= 0.005) {
    erros.push("A soma dos itens não fecha com o total do pedido.");
  }
  return { ok: !erros.length, erros };
}

// ── Como se paga ───────────────────────────────────
// Na hora de pagar, o que falta não é o valor — é a chave. Ela mora no
// cadastro da loja, porque é sempre a mesma; e a fatura pode trazer um
// "copia e cola" próprio, que já vem com valor e identificador dentro. Quando
// os dois existem, o da fatura manda: ele foi emitido para AQUELE pagamento.
const TIPOS_PIX = [
  { id: "cnpj",      nome: "CNPJ" },
  { id: "cpf",       nome: "CPF" },
  { id: "email",     nome: "E-mail" },
  { id: "telefone",  nome: "Telefone" },
  { id: "aleatoria", nome: "Chave aleatória" },
];

function nomeDoTipoPix(id) {
  const t = TIPOS_PIX.find((x) => x.id === id);
  return t ? t.nome : "Chave PIX";
}

function pixDoPagamento(fonte, prestador) {
  const f = fonte || {}, p = prestador || {};
  const vazio = { tem: false, valor: "", rotulo: "", beneficiario: "", copiaECola: false };
  const colar = String(f.pixCopiaECola || "").trim();
  const nome = String(f.pixBeneficiario || p.pixBeneficiario || p.nome || f.favorecido || "").trim();
  if (colar) return { tem: true, valor: colar, rotulo: "PIX copia e cola", beneficiario: nome, copiaECola: true };
  // chave da fatura primeiro, depois a do cadastro — com o tipo de quem deu a chave
  const daFatura = String(f.pixChave || "").trim();
  const chave = daFatura || String(p.pixChave || "").trim();
  if (!chave) return vazio;
  // O rótulo diz PIX antes do tipo: "TELEFONE" sozinho em cima de um número
  // parece o telefone da loja, e não a chave para onde o dinheiro vai.
  return { tem: true, valor: chave, rotulo: "PIX · " + nomeDoTipoPix(daFatura ? f.pixTipo : p.pixTipo),
    beneficiario: nome, copiaECola: false };
}

// Chave aleatória e copia-e-cola não cabem na linha. Mostra as pontas.
function pixResumido(valor, limite) {
  const v = String(valor || "").trim();
  const max = limite || 34;
  if (v.length <= max) return v;
  const meio = Math.floor((max - 1) / 2);
  return v.slice(0, meio) + "…" + v.slice(v.length - meio);
}

// ── Onze itens não são onze contas para quem paga ───────────
// A obra precisa do item a item — é dele que sai o custo por etapa. Quem
// paga precisa do pedido: a loja cobra um valor, com um número. Então o
// dado continua por item e a LISTA se dobra por pedido, com os itens
// dentro. Conta sem pedido (avulsa, parcela de contrato) passa direto.
function linhasDePedido(contas) {
  const red = (x) => Math.round(x * 100) / 100;
  const fora = [];
  const porPedido = new Map();
  for (const c of contas || []) {
    if (!c) continue;
    if (!c.pedidoId) { fora.push({ tipo: "conta", chave: c.id, conta: c }); continue; }
    if (!porPedido.has(c.pedidoId)) {
      const linha = { tipo: "pedido", chave: c.pedidoId, pedidoId: c.pedidoId, pedidoIds: [c.pedidoId],
        numeroPedido: c.numeroPedido || "", numeroLoja: c.numeroLoja || "", numeroNota: c.numeroNota || "",
        cotacaoId: c.cotacaoId || "", obraId: c.obraId || "",
        prestadorId: c.prestadorId || "", favorecido: c.favorecido || "",
        pixCopiaECola: c.pixCopiaECola || "",
        vencimento: c.vencimento || "", contas: [], valor: 0, valorPago: 0, pagos: 0 };
      porPedido.set(c.pedidoId, linha);
      fora.push(linha);
    }
    const l = porPedido.get(c.pedidoId);
    l.contas.push(c);
    l.valor = red(l.valor + (Number(c.valor) || 0));
    if (c.pago) { l.pagos++; l.valorPago = red(l.valorPago + (Number(c.valorPago) || Number(c.valor) || 0)); }
    // vence pelo mais cedo: é a data que cobra
    if (c.vencimento && (!l.vencimento || c.vencimento < l.vencimento)) l.vencimento = c.vencimento;
  }
  for (const l of porPedido.values()) {
    l.pago = l.contas.length > 0 && l.pagos === l.contas.length;
    l.parcial = l.pagos > 0 && !l.pago;
    l.aberto = red(l.valor - l.valorPago);
  }
  return fora;
}

// ── A loja é o de cima; o pedido é a fatura ──────────────
// Conta na loja não é um pedido, é um relacionamento: a loja liga dizendo
// "vamos fechar" e cobra UM valor, que é a soma do que se pediu no mês. Quem
// paga pergunta primeiro "quanto devo para a Ourifer" e só depois "de quais
// pedidos". Por isso os pedidos da mesma loja se juntam num nível acima, com
// o total somado; o pedido continua existindo um nível abaixo, e os itens
// abaixo dele. Conta avulsa e parcela de contrato passam direto.
//
// A exceção é a lista já separada por fornecedor: ali o nome da loja é o
// cabeçalho do grupo, e repeti-lo logo abaixo só gasta uma linha.
// Compra que já entrou paga não é conta de loja: não há o que acumular nem
// cobrança a esperar. É uma nota — os itens juntos, sem o nível da loja
// por cima. Conta de loja é só para o que entra a pagar.
function pedidoEhNotaPaga(l) {
  const x = l || {};
  return x.tipo === "pedido" && !!x.pago && !x.cotacaoId
    && (x.contas || []).every((c) => c && (c.origem || "avulsa") === "avulsa" && !c.cotacaoId);
}
function rotuloDoPedido(l) {
  const x = l || {};
  if (pedidoEhNotaPaga(x)) {
    const n = x.numeroNota || ((x.contas || [])[0] || {}).doc || "";
    return n ? "Nota " + n : "Nota";
  }
  return "Pedido " + (x.numeroLoja || x.numeroPedido || "");
}

function linhasDeLoja(contas, opcoes) {
  const o = opcoes || {};
  const linhas = linhasDePedido(contas);
  if (o.semNivelDeLoja) return linhas;
  const red = (x) => Math.round(x * 100) / 100;
  const saida = [];
  const porLoja = new Map();
  for (const l of linhas) {
    if (l.tipo !== "pedido" || pedidoEhNotaPaga(l)) { saida.push(l); continue; }
    const chave = String(l.prestadorId || l.favorecido || "sem-loja");
    if (!porLoja.has(chave)) {
      const loja = { tipo: "loja", chave: "loja:" + chave, lojaChave: chave,
        favorecido: l.favorecido || "", prestadorId: l.prestadorId || "",
        obraId: l.obraId || "", pedidos: [], pedidoIds: [], contas: [],
        valor: 0, valorPago: 0, pagos: 0, vencimento: "" };
      porLoja.set(chave, loja);
      saida.push(loja);
    }
    const g = porLoja.get(chave);
    g.pedidos.push(l);
    g.pedidoIds.push(l.pedidoId);
    g.contas = g.contas.concat(l.contas);
    g.valor = red(g.valor + l.valor);
    g.valorPago = red(g.valorPago + l.valorPago);
    g.pagos += l.pagos;
    // A loja cobra pela data mais cedo: é ela que manda no vencimento.
    if (l.vencimento && (!g.vencimento || l.vencimento < g.vencimento)) g.vencimento = l.vencimento;
  }
  for (const g of porLoja.values()) {
    g.pago = g.contas.length > 0 && g.pagos === g.contas.length;
    g.parcial = g.pagos > 0 && !g.pago;
    g.aberto = red(g.valor - g.valorPago);
    g.pedidosEmAberto = g.pedidos.filter((x) => !x.pago).length;
  }
  return saida;
}

// ── Corrigir um pedido lançado errado ────────────────────
// Enquanto ninguém pagou, o pedido é só uma intenção: dá para refazer ou
// apagar inteiro. Depois da baixa, não — o dinheiro saiu, e apagar o gasto
// faria a obra mentir e o saldo do banco parar de bater. Aí o caminho é
// desfazer a baixa primeiro, que é um ato com dono e data.
function podeMexerNoPedido(contasPagar, pedidoId) {
  if (!pedidoId) return { pode: false, motivo: "Pedido sem identificação." };
  const pagas = (contasPagar || []).filter((c) => c && c.pedidoId === pedidoId && c.pago).length;
  if (!pagas) return { pode: true, motivo: "" };
  return { pode: false, motivo: pagas === 1
    ? "Um item deste pedido já foi pago. Desfaça a baixa em contas a pagar antes de mexer."
    : `${pagas} itens deste pedido já foram pagos. Desfaça a baixa em contas a pagar antes de mexer.` };
}

// Tira as contas do pedido, deixando as pagas onde estão.
// Apagar um pedido inteiro, inclusive o que já foi baixado. É diferente de
// `removerContasDoPedido`, que poupa o pago de propósito: lá se está
// relançando um pedido e o gasto continua existindo; aqui se está dizendo
// que ele nunca existiu — lançamento de teste, papel duplicado, loja errada.
// Por isso quem chama tem que mostrar antes o que vai sair, e o realizado da
// obra cai junto.
function apagarPedidoInteiro(contasPagar, pedidoId) {
  if (!pedidoId) return contasPagar || [];
  return (contasPagar || []).filter((c) => !(c && c.pedidoId === pedidoId));
}

// O que a pessoa precisa ler antes de confirmar: quantas contas somem, de
// quanto, e quanto disso já estava baixado — porque essa parte sai do
// realizado da obra e mexe no P&L do mês.
function resumoDoQueSai(contasPagar, pedidoId) {
  const alvo = (contasPagar || []).filter((c) => c && c.pedidoId === pedidoId);
  let valor = 0, pagas = 0, valorPago = 0;
  for (const c of alvo) {
    valor += cpNumero(c.valor);
    if (c.pago) { pagas++; valorPago += cpNumero(c.valorPago || c.valor); }
  }
  return { quantas: alvo.length, valor: Math.round(valor * 100) / 100,
    pagas, valorPago: Math.round(valorPago * 100) / 100 };
}

function removerContasDoPedido(contasPagar, pedidoId) {
  if (!pedidoId) return contasPagar || [];
  return (contasPagar || []).filter((c) => !(c && c.pedidoId === pedidoId && !c.pago));
}

// A fila de pagamento: o que está em aberto, agrupado por loja. É a lista que
// se abre quando a loja liga dizendo "vamos fechar".
function pedidosPendentes(contasPagar, opcoes) {
  const red = (x) => Math.round(x * 100) / 100;
  const o = opcoes || {};
  const porPedido = new Map();
  for (const c of contasPagar || []) {
    if (!c || c.pago || !c.pedidoId) continue;
    if (o.obraId && c.obraId !== o.obraId) continue;
    if (!porPedido.has(c.pedidoId)) {
      porPedido.set(c.pedidoId, {
        pedidoId: c.pedidoId, numero: c.numeroPedido || "", numeroLoja: c.numeroLoja || "",
        cotacaoId: c.cotacaoId || "", obraId: c.obraId || "",
        prestadorId: c.prestadorId || "", favorecido: c.favorecido || "Fornecedor",
        vencimento: c.vencimento || "", itens: 0, valor: 0, contas: [],
      });
    }
    const p = porPedido.get(c.pedidoId);
    p.itens++;
    p.valor = red(p.valor + (Number(c.valor) || 0));
    p.contas.push(c.id);
    if (c.vencimento && (!p.vencimento || c.vencimento < p.vencimento)) p.vencimento = c.vencimento;
  }
  const porLoja = new Map();
  for (const p of porPedido.values()) {
    const k = p.prestadorId || p.favorecido;
    if (!porLoja.has(k)) porLoja.set(k, { chave: k, prestadorId: p.prestadorId, favorecido: p.favorecido, pedidos: [], valor: 0 });
    const l = porLoja.get(k);
    l.pedidos.push(p);
    l.valor = red(l.valor + p.valor);
  }
  const lojas = [...porLoja.values()].sort((a, b) => b.valor - a.valor);
  for (const l of lojas) l.pedidos.sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)) || String(a.numeroLoja).localeCompare(String(b.numeroLoja)));
  return { lojas, total: red(lojas.reduce((s, l) => s + l.valor, 0)) };
}

// Baixa em lote: a loja cobra um valor só e a obra registra item a item. As
// contas escolhidas recebem a mesma data, e a soma delas é o que saiu do caixa
// — é essa igualdade que faz o lançamento casar com a linha do extrato.
function baixarPedidos(contasPagar, pedidoIds, dados, quem, agoraIso) {
  const alvo = new Set(pedidoIds || []);
  const d = dados || {};
  const contas = (contasPagar || []).map((c) => {
    if (!c || c.pago || !alvo.has(c.pedidoId)) return c;
    return contaPaga(c, { pagoEm: d.pagoEm || "", valorPago: Number(c.valor) || 0,
      comprovante: d.comprovante || c.comprovante || null }, quem, agoraIso);
  });
  const total = Math.round((contasPagar || [])
    .filter((c) => c && !c.pago && alvo.has(c.pedidoId))
    .reduce((s, c) => s + (Number(c.valor) || 0), 0) * 100) / 100;
  return { contas, total };
}

// As formas de pagar de uma compra — as mesmas do contrato, menos a medição,
// que é de serviço executado e não de material entregue. "Item a item" do
// contrato é a entrega daqui: o que muda de nome é a coisa que se paga.
const MODOS_LANCAMENTO = [
  { id: "parcelas",     nome: "Parcelas iguais",        resumo: "O valor cotado dividido em parcelas mensais." },
  { id: "entregas",     nome: "Por entrega",            resumo: "Cada entrega com nome, valor e data de pagamento." },
  { id: "sinalFinal",   nome: "Sinal + saldo no final", resumo: "Um percentual na compra e o restante na entrega." },
  { id: "sinalParcelas", nome: "Sinal + parcelas",      resumo: "Um percentual na compra e o saldo dividido em parcelas." },
  // Compra recorrente: a cotação não fecha no primeiro lançamento, vai
  // recebendo pedidos, e cada pedido vira uma conta por item.
  { id: "contaLoja",    nome: "Conta na loja",          resumo: "Compra recorrente: cada pedido vira contas, e a cotação segue aberta." },
];
function modoLancamento(id) { return MODOS_LANCAMENTO.find((m) => m.id === id) || MODOS_LANCAMENTO[0]; }

// Uma conta, do jeito que o lançamento monta todas.
function contaDaCompra(d, novoId, dados) {
  return {
    id: novoId(),
    origem: CP_ORIGEM_COTACAO,
    obraId: dados.obraId || "",
    contratoId: "",
    cotacaoId: dados.cotacaoId || "",
    numeroPedido: dados.numeroPedido || "",
    parcela: d.parcela || 0,
    parcelasTotal: d.parcelasTotal || 0,
    contaId: dados.contaId || (typeof PLANO_CONTAS !== "undefined" && PLANO_CONTAS[0] ? PLANO_CONTAS[0].id : "material"),
    // A etapa é da compra inteira e vale para cada parcela: é o que põe o
    // dinheiro no custo por etapa. Sem ela, a cotação lançada parcelada
    // caía inteira em "Sem etapa".
    etapa: dados.etapa || dados.etapaId || "",
    prestadorId: dados.prestadorId || "",
    favorecido: dados.favorecido || "",
    descricao: d.descricao,
    valor: Math.round((Number(d.valor) || 0) * 100) / 100,
    vencimento: d.vencimento,
    pago: false, pagoEm: "", valorPago: "", observacao: dados.observacao || "",
  };
}

function contasDaCotacao(dados, novoId) {
  const d = dados || {};
  if (d.modo === "contaLoja") return contasDoPedidoDaLoja(d, d.pedido, novoId);
  // Medição: a cotação foi lançada pelo que de fato entrou na obra, item a
  // item. Uma conta por item, com quantidade e etapa — é o que faz o custo
  // por etapa enxergar a compra. Só vale quando há UMA data de pagamento:
  // consumo acontece uma vez, e espalhá-lo por parcelas inventaria um
  // consumo por mês que não houve.
  if (cpMedicaoEmUmaData(d)) {
    const venc = String(d.primeiroVencimento || "").slice(0, 10) || dataParaIso(new Date());
    return contasDoPedidoDaLoja(d, {
      id: (typeof uid === "function" ? uid() : String(Date.now())),
      numero: d.numeroPedido || "", numeroLoja: "", numeroNota: "",
      data: venc, vencimento: venc, desconto: 0,
      itens: (d.medicao || []),
    }, novoId);
  }
  if (d.modo === "entregas" || (d.entregas || []).some((e) => e && valorDaEntrega(e) > 0)) {
    return contasDasEntregas(d, novoId);
  }
  const total = Math.round((Number(d.valor) || 0) * 100) / 100;
  if (!(total > 0)) return [];
  const id = typeof novoId === "function" ? novoId : (typeof uid === "function" ? uid : () => String(Date.now()));
  const nome = String(d.descricao || "Compra").trim() || "Compra";
  const base = String(d.primeiroVencimento || "").slice(0, 10) || dataParaIso(new Date());

  if (d.modo === "sinalFinal" || d.modo === "sinalParcelas") {
    const pct = Math.min(100, Math.max(0, Number(d.sinalPct) || 0));
    const e = typeof entradaESaldo === "function"
      ? entradaESaldo(total, pct, Math.max(1, Math.floor(Number(d.parcelas) || 1)))
      : null;
    if (!e) return [];
    const saidas = [];
    if (e.entrada > 0) {
      saidas.push(contaDaCompra({ descricao: `${nome} — sinal`, valor: e.entrada, vencimento: base }, id, d));
    }
    if (e.saldo > 0) {
      if (d.modo === "sinalFinal") {
        saidas.push(contaDaCompra({ descricao: `${nome} — saldo na entrega`, valor: e.saldo,
          vencimento: String(d.vencimentoSaldo || "").slice(0, 10) || base }, id, d));
      } else {
        const qtdP = e.parcelas.qtd;
        const ini = String(d.vencimentoSaldo || "").slice(0, 10) || somarMeses(base, 1);
        for (let i = 0; i < qtdP; i++) {
          saidas.push(contaDaCompra({
            descricao: qtdP > 1 ? `${nome} — parcela ${i + 1}/${qtdP}` : `${nome} — saldo`,
            valor: i === qtdP - 1 ? e.parcelas.ultima : e.parcelas.base,
            vencimento: somarMeses(ini, i),
            parcela: qtdP > 1 ? i + 1 : 0, parcelasTotal: qtdP > 1 ? qtdP : 0,
          }, id, d));
        }
      }
    }
    return saidas;
  }

  const qtd = Math.max(1, Math.floor(Number(d.parcelas) || 1));
  const divisao = typeof parcelasContrato === "function"
    ? parcelasContrato(total, qtd)
    : { qtd, base: Math.round((total / qtd) * 100) / 100, ultima: Math.round((total / qtd) * 100) / 100, iguais: true };
  const contas = [];
  for (let i = 0; i < qtd; i++) {
    contas.push(contaDaCompra({
      descricao: qtd > 1 ? `${nome} — parcela ${i + 1}/${qtd}` : nome,
      valor: i === qtd - 1 ? divisao.ultima : divisao.base,
      vencimento: somarMeses(base, i),
      parcela: qtd > 1 ? i + 1 : 0,
      parcelasTotal: qtd > 1 ? qtd : 0,
    }, id, d));
  }
  return contas;
}

// Desfazer o lançamento: some com as contas daquela cotação que ainda não
// foram pagas. Conta paga NUNCA é removida — o dinheiro já saiu, e apagar o
// registro esconderia um gasto real da obra.
function removerContasDaCotacao(contas, cotacaoId) {
  if (!cotacaoId) return contas || [];
  return (contas || []).filter((c) => !(c && c.cotacaoId === cotacaoId && !c.pago));
}

function contasDeCotacao(contas, cotacaoId) {
  if (!cotacaoId) return [];
  return (contas || []).filter((c) => c && c.cotacaoId === cotacaoId);
}

// ── Identificação da conta ──────────────────────────────────────
// "Contrato 0007 · Serralheria · MB Viezzer · Parcela 2/6"
// "Contrato 0007" ou "Pedido 0008" — o prefixo diz de onde a conta nasceu.
function docDaConta(conta) {
  const c = conta || {};
  if (c.numeroContrato) return `Contrato ${c.numeroContrato}`;
  if (c.numeroPedido) return `Pedido ${c.numeroPedido}`;
  return "";
}

function tituloConta(conta) {
  const c = conta || {};
  const partes = [];
  if (docDaConta(c)) partes.push(docDaConta(c));
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
  if (docDaConta(c)) partes.push(docDaConta(c));
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

// ── Quem fez o quê, e quando ────────────────────────────────────
// A tela é a mesma para o escritório e para o cliente, e os dois dão baixa
// na MESMA conta. Sem nome em cada ato, abrir o mês vira adivinhação: "essa
// baixa foi você ou fui eu?". Então tudo que muda uma conta deixa registro.
//
// É uma LISTA de atos, não um punhado de campos: pagamento desfeito e
// refeito é uma história, não um estado. Conta antiga não tem lista nenhuma
// e continua valendo — aparece sem histórico, que é a verdade sobre ela:
// ninguém sabe quem deu aquela baixa.
const CP_ATOS = {
  criada: "Conta lançada",
  editada: "Conta editada",
  paga: "Pagamento registrado",
  desfeita: "Pagamento desfeito",
  comprovante: "Comprovante anexado",
  nota: "Nota fiscal anexada",
  comprovanteRemovido: "Comprovante removido",
  recalibrada: "Datas recalibradas",
};
// Teto por conta: o histórico é para consultar, não para virar arquivo. O
// que se corta é o começo, porque o que interessa é sempre o que houve por
// último.
const CP_MAX_REGISTROS = 30;

function registrarAto(conta, ato, quem, agoraIso, detalhe) {
  const c = conta || {};
  const linha = { ato, por: String(quem || "").trim(), em: agoraIso || new Date().toISOString() };
  if (detalhe) linha.detalhe = detalhe;
  const lista = [...(c.registros || []), linha];
  return { ...c, registros: lista.slice(-CP_MAX_REGISTROS) };
}

function registrosDaConta(conta) {
  return ((conta || {}).registros || []).filter((r) => r && r.ato);
}

// Dinheiro no registro do ato. O formatador bonito mora na tela; aqui
// basta o número legível, e ele não pode depender dela.
function cpDinheiro(v) {
  const n = Number(v) || 0;
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function cpDiaBR(iso) {
  if (!iso) return "";
  const s = String(iso);
  // "2026-11-05" sozinho é meia-noite UTC, que em Brasília ainda é dia 4 —
  // por isso a data sem hora entra ao meio-dia, como no resto do app.
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + "T12:00:00" : s);
  return isNaN(d) ? "" : d.toLocaleDateString("pt-BR");
}

// "Pagamento registrado por Renato em 20/09/2026"
function textoDoAto(registro) {
  const r = registro || {};
  const nome = typeof textoUtf8Recuperado === "function" ? textoUtf8Recuperado(r.por) : r.por;
  const partes = [CP_ATOS[r.ato] || r.ato];
  if (nome) partes.push(`por ${nome}`);
  if (cpDiaBR(r.em)) partes.push(`em ${cpDiaBR(r.em)}`);
  const base = partes.join(" ");
  return r.detalhe ? `${base} · ${r.detalhe}` : base;
}

// O último ato de um tipo — para a linha curta ("Pago por X") sem abrir o
// histórico inteiro.
function ultimoAto(conta, ato) {
  const lista = registrosDaConta(conta).filter((r) => r.ato === ato);
  return lista.length ? lista[lista.length - 1] : null;
}

// Dar baixa. O comprovante entra junto e é ato à parte: anexar comprovante
// depois, sem mexer no pagamento, também tem dono.
function contaPaga(conta, dados, quem, agoraIso) {
  const c = conta || {};
  const d = dados || {};
  const agora = agoraIso || new Date().toISOString();
  const antes = c.comprovante || null;
  const depois = d.comprovante || null;
  let nova = {
    ...c,
    pago: true,
    pagoEm: d.pagoEm || "",
    valorPago: Math.round((Number(d.valorPago) || Number(c.valor) || 0) * 100) / 100,
    contabilizadoEm: String(agora).slice(0, 10),
    comprovante: depois,
  };
  nova = registrarAto(nova, "paga", quem, agora);
  const mudouAnexo = JSON.stringify(antes || null) !== JSON.stringify(depois || null);
  if (mudouAnexo && depois) nova = registrarAto(nova, depois.tipo === "nota" ? "nota" : "comprovante", quem, agora, depois.nome || "");
  if (mudouAnexo && !depois && antes) nova = registrarAto(nova, "comprovanteRemovido", quem, agora);
  return nova;
}

// Desfazer. O comprovante fica: ele é do pagamento que houve, e apagá-lo
// junto perderia o documento por causa de um clique errado.
function contaEmAberto(conta, quem, agoraIso) {
  // O jeito de pagar vai embora junto com o pagamento: uma conta em aberto
  // com plano de parcelas continuaria caindo na fatura do cartão.
  const { formaPagamento, cartaoId, parcelasCartao, ...c } = conta || {};
  const agora = agoraIso || new Date().toISOString();
  return registrarAto({ ...c, pago: false, pagoEm: "", valorPago: "", contabilizadoEm: "" },
    "desfeita", quem, agora);
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

// ── Só o custo de construir ─────────────────────────────
// Para acompanhar obra o que interessa é material e mão de obra. Preço de
// venda, terreno e tributos são do negócio, não do canteiro — e entram em
// saltos grandes justamente quando a casa vende, atrapalhando a leitura de
// quanto a construção está custando. O filtro é da leitura, não do dado:
// nada sai da base, só da soma.
const GRUPOS_FORA_DO_CUSTO_OBRA = ["receitas", "terreno"];
const CONTAS_TRIBUTO = ["impostos", "ir_receita", "inss", "iss"];

function contaEntraNoCustoDeObra(conta) {
  if (!conta) return true;
  if (GRUPOS_FORA_DO_CUSTO_OBRA.indexOf(conta.grupo) >= 0) return false;
  return CONTAS_TRIBUTO.indexOf(conta.id) < 0;
}

// ── O P&L da obra, conta a conta ────────────────────────────────
// Estimado (Planejamento) e realizado (o que já foi PAGO em contas a pagar),
// lado a lado, na estrutura do plano de contas. É a tela de abertura do
// Planejamento: a pergunta de todo dia é "quanto eu disse que ia custar e
// quanto já saiu".
//
// Só entra conta que tem algum dos dois lados. Mostrar as 42 contas com zero
// nas duas colunas afogaria as seis que importam.
function plDaObra(itens, contasPagar, grupos, plano, opcoes) {
  const red = (x) => Math.round(x * 100) / 100;
  const soCusto = !!(opcoes && opcoes.soCusto);
  const est = estimativaPorConta(itens);
  const real = realizadoPorConta(contasPagar);
  const blocos = [];
  for (const g of grupos || []) {
    if (soCusto && GRUPOS_FORA_DO_CUSTO_OBRA.indexOf(g.id) >= 0) continue;
    const linhas = [];
    for (const c of (plano || []).filter((x) => x.grupo === g.id)) {
      if (soCusto && !contaEntraNoCustoDeObra(c)) continue;
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


// ── O P&L visto por etapa ───────────────────────────────────────
// A mesma base, girada: em vez de "quanto gastei de material", "quanto
// custou a fundação". É a leitura de quem está tocando a obra — a etapa
// acabou e passou do previsto, ou ainda nem começou. Estimado e realizado
// vêm dos mesmos lugares do P&L por conta, então os totais fecham iguais.
// O orçamento da obra é a única estimativa que fala por etapa: ele nasce
// item a item, com etapa e subetapa. A estimativa do P&L fala por conta do
// plano, e nunca soube de etapa — por isso o quadro por etapa mostrava o
// estimado inteiro em "Sem etapa".
//
// Os dois não se substituem e NÃO se somam: são duas contas do mesmo gasto,
// uma por conta contábil e outra por etapa. Por isso o orçado entra como
// coluna própria, ao lado, em vez de virar o estimado — somar daria uma
// obra duas vezes mais cara, e trocar faria o quadro por etapa fechar num
// total diferente do quadro por conta.
function estimativaPorEtapaDoOrcamento(orcamento) {
  const linhas = ((orcamento || {}).itens) || [];
  const por = {};
  for (const i of linhas) {
    if (!i) continue;
    const k = (typeof etapaDoOrcamento === "function" ? etapaDoOrcamento(i.etapa, i.subEtapa) : "") || "";
    const v = Number(i.total);
    const valor = Number.isFinite(v) && v !== 0
      ? v
      : (Number(i.qtd) || 0) * (Number(i.preco) || 0);
    por[k] = Math.round(((por[k] || 0) + valor) * 100) / 100;
  }
  return por;
}

function plPorEtapa(itens, contasPagar, opcoes) {
  const est = {}, real = {}, contasDe = {};
  const orc = estimativaPorEtapaDoOrcamento((opcoes || {}).orcamento);
  const temOrcamento = Object.keys(orc).length > 0;
  const soCusto = !!(opcoes && opcoes.soCusto);
  // Receita e terreno nunca são etapa de obra; com soCusto os tributos
  // também saem, para o quadro por etapa fechar igual ao por conta.
  const fora = (contaId) => {
    const c = (typeof contaPorId === "function" ? contaPorId(contaId) : null);
    if (!c) return false;
    if (GRUPOS_FORA_DO_CUSTO_OBRA.indexOf(c.grupo) >= 0) return true;
    return soCusto && !contaEntraNoCustoDeObra(c);
  };
  for (const i of itens || []) {
    if (!i) continue;
    if (fora(i.contaId)) continue;
    const k = i.etapaId || "";
    est[k] = Math.round(((est[k] || 0) + (Number(i.valor) || 0)) * 100) / 100;
  }
  for (const c of contasPagar || []) {
    if (!c || !c.pago) continue;
    if (fora(c.contaId)) continue;
    const k = c.etapa || c.etapaId || "";
    const v = Number(c.valorPago) || Number(c.valor) || 0;
    real[k] = Math.round(((real[k] || 0) + v) * 100) / 100;
    (contasDe[k] = contasDe[k] || []).push(c);
  }
  const ordem = (id) => {
    const i = (typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : []).findIndex((e) => e.id === id);
    return i < 0 ? 998 : i;
  };
  const nome = (id) => {
    if (!id) return "Sem etapa";
    const e = (typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : []).find((x) => x.id === id);
    return e ? e.nome : id;
  };
  const linhas = [...new Set([...Object.keys(est), ...Object.keys(real), ...Object.keys(orc)])]
    .map((k) => ({
      etapaId: k, nome: nome(k),
      estimado: est[k] || 0, realizado: real[k] || 0,
      orcado: temOrcamento ? (orc[k] || 0) : null,
      saldo: Math.round(((est[k] || 0) - (real[k] || 0)) * 100) / 100,
      saldoOrcado: temOrcamento ? Math.round(((orc[k] || 0) - (real[k] || 0)) * 100) / 100 : null,
      notas: (contasDe[k] || []).length,
    }))
    .filter((l) => l.estimado || l.realizado || l.orcado)
    .sort((a, b) => ordem(a.etapaId) - ordem(b.etapaId));
  const soma = (campo) => Math.round(linhas.reduce((s, l) => s + (Number(l[campo]) || 0), 0) * 100) / 100;
  return { linhas, temOrcamento,
    estimado: soma("estimado"), realizado: soma("realizado"), saldo: soma("saldo"),
    orcado: temOrcamento ? soma("orcado") : null,
    saldoOrcado: temOrcamento ? soma("saldoOrcado") : null };
}

// ══════════════════════════════════════════════════════════════
// A CORRENTE: ORÇAMENTO → CATÁLOGO → COMPRA → PAGAMENTO
// ══════════════════════════════════════════════════════════════
// Estimativa, cotação, pedido, conta a pagar e extrato só conversam se
// falarem da MESMA coisa pelo mesmo nome. O elo é o código do insumo: o
// motor de orçamento já resolve cada linha contra o catálogo e grava
// `insumoCodigo`; a cotação e o pedido levam o mesmo código para a conta a
// pagar; e dele saem, de graça, o grupo de material e a etapa.
//
// Onde o código falta, o elo arrebenta — e arrebenta em silêncio: o gasto
// continua somando no total e some do confronto item a item. Por isso a
// conferência existe e mostra o buraco em vez de maquiar.

// Toda transação pertence a um cliente, a um empreendimento (quando a obra
// é do escritório), a uma obra, a uma etapa e a uma conta contábil — e é
// isso que faz a mesma despesa aparecer no lugar certo das três bases:
// a do cliente, a do empreendimento e a do escritório.
function dimensoesDaConta(conta, obra, cliente, insumos) {
  const c = conta || {}, o = obra || {}, cl = cliente || {};
  const ins = (insumos || []).find((x) => x && (x.codigo === c.insumoCodigo || x.id === c.insumoCodigo)) || null;
  const doEscritorio = !!(o.empreendimento || o.ehEmpreendimento || (cl.servicos && cl.servicos.empreendimento));
  return {
    // quem
    clienteId: cl.id || o.clienteId || "",
    cliente: cl.nome || "",
    empreendimentoId: doEscritorio ? (cl.id || o.clienteId || "") : "",
    obraId: c.obraId || o.id || "",
    obra: o.nome || "",
    // o quê
    insumoCodigo: c.insumoCodigo || "",
    insumo: (ins && ins.nome) || c.descricao || "",
    grupoMaterial: typeof grupoDoItem === "function" ? grupoDoItem(ins, c.grupoMaterial) : (c.grupoMaterial || ""),
    etapa: c.etapa || c.etapaId || "",
    contaId: c.contaId || "",
    quantidade: Number(c.quantidade) || 0,
    unidade: c.unidade || (ins && ins.unidade) || "",
    // quanto, quando, com quem, e por qual papel
    valor: Math.round(((c.pago ? (Number(c.valorPago) || Number(c.valor)) : Number(c.valor)) || 0) * 100) / 100,
    pago: !!c.pago,
    data: String((c.pago ? c.pagoEm : c.vencimento) || "").slice(0, 10),
    competencia: String((c.pago ? c.pagoEm : c.vencimento) || "").slice(0, 7),
    fornecedorId: c.prestadorId || "",
    fornecedor: c.favorecido || "",
    numeroDoc: c.numeroDoc || "",
    documento: c.numeroNota || c.numeroLoja || "",
    pedidoId: c.pedidoId || "",
  };
}

// Estimado × realizado POR INSUMO, em dinheiro e em quantidade. É a leitura
// que responde "orcei 11 m3 de concreto e consumi 7" — a que nem o quadro
// por conta nem o por etapa dão, porque os dois somam reais e perdem o m3.
function plPorInsumo(orcamento, contasPagar, insumos) {
  const linhas = ((orcamento || {}).itens) || [];
  const cat = (codigo) => (insumos || []).find((x) => x && x.codigo === codigo) || null;
  const red = (x) => Math.round(x * 100) / 100;
  const por = {};
  const pegar = (codigo) => {
    const k = codigo || "";
    if (!por[k]) {
      const ins = cat(k);
      por[k] = { insumoCodigo: k, nome: (ins && ins.nome) || "", unidade: (ins && ins.unidade) || "",
        grupo: typeof grupoDoItem === "function" ? grupoDoItem(ins, "") : ((ins && ins.grupo) || ""),
        orcado: 0, qtdOrcada: 0, realizado: 0, qtdRealizada: 0 };
    }
    return por[k];
  };
  for (const i of linhas) {
    if (!i || !i.insumoCodigo) continue;
    const r = pegar(i.insumoCodigo);
    const v = Number(i.total);
    r.orcado = red(r.orcado + (Number.isFinite(v) && v !== 0 ? v : (Number(i.qtd) || 0) * (Number(i.preco) || 0)));
    r.qtdOrcada = Math.round((r.qtdOrcada + (Number(i.qtd) || 0)) * 1000) / 1000;
    if (!r.nome) r.nome = i.item || "";
    if (!r.unidade) r.unidade = i.unidade || "";
  }
  for (const c of contasPagar || []) {
    if (!c || !c.pago || !c.insumoCodigo) continue;
    const r = pegar(c.insumoCodigo);
    r.realizado = red(r.realizado + ((Number(c.valorPago) || Number(c.valor)) || 0));
    r.qtdRealizada = Math.round((r.qtdRealizada + (Number(c.quantidade) || 0)) * 1000) / 1000;
    if (!r.nome) r.nome = c.descricao || "";
    if (!r.unidade) r.unidade = c.unidade || "";
  }
  return Object.keys(por).map((k) => {
    const r = por[k];
    return { ...r,
      saldo: red(r.orcado - r.realizado),
      saldoQtd: Math.round((r.qtdOrcada - r.qtdRealizada) * 1000) / 1000 };
  }).sort((a, b) => (b.orcado || b.realizado) - (a.orcado || a.realizado));
}

// Onde a corrente arrebenta nesta obra. Cada buraco vem com quantas linhas
// e quanto dinheiro estão fora — um aviso sem número não faz ninguém mexer.
function conferenciaDaLigacao(obra, insumos) {
  const o = obra || {};
  const linhas = ((o.orcamento || {}).itens) || [];
  const contas = o.contasPagar || [];
  const red = (x) => Math.round(x * 100) / 100;
  const valorDaLinha = (i) => {
    const v = Number(i.total);
    return Number.isFinite(v) && v !== 0 ? v : (Number(i.qtd) || 0) * (Number(i.preco) || 0);
  };
  const furo = (titulo, oQue, itens, valor) => ({ titulo, oQue, quantos: itens, valor: red(valor) });
  const furos = [];

  const semInsumo = linhas.filter((i) => i && !i.insumoCodigo);
  if (semInsumo.length) furos.push(furo("Orçamento sem item do catálogo",
    "Estas linhas não casaram com nenhum insumo, então o orçado delas não encontra o que foi comprado.",
    semInsumo.length, semInsumo.reduce((s, i) => s + valorDaLinha(i), 0)));

  const semEtapaOrc = typeof etapasDoOrcamentoSemMapa === "function" ? etapasDoOrcamentoSemMapa(linhas) : [];
  if (semEtapaOrc.length) furos.push(furo("Orçamento com etapa que a obra não conhece",
    "A etapa destas linhas não tem correspondente: " + semEtapaOrc.map((x) => x.etapa).join(", ") + ".",
    semEtapaOrc.reduce((s, x) => s + x.linhas, 0), 0));

  const pagas = contas.filter((c) => c && c.pago);
  // A régua é a regra da transação: só é furo o que ela EXIGE. Tarifa
  // bancária sem etapa, frete sem item e parcela de obra civil sem etapa
  // estão certos, e apontá-los como erro faria a pessoa parar de olhar.
  const exige = (c, campo) => (typeof exigenciasDaTransacao === "function"
    ? exigenciasDaTransacao(c)[campo] : true);
  const contaSemEtapa = pagas.filter((c) => exige(c, "etapa") && !String(c.etapa || c.etapaId || "").trim());
  if (contaSemEtapa.length) furos.push(furo("Pagamento sem etapa",
    "Entra no custo da obra e some do custo por etapa.",
    contaSemEtapa.length, contaSemEtapa.reduce((s, c) => s + ((Number(c.valorPago) || Number(c.valor)) || 0), 0)));

  const contaSemInsumo = pagas.filter((c) => exige(c, "item") && !String(c.insumoCodigo || "").trim());
  if (contaSemInsumo.length) furos.push(furo("Material sem item do catálogo",
    "Soma em reais, mas não dá para confrontar com o que foi orçado item a item.",
    contaSemInsumo.length, contaSemInsumo.reduce((s, c) => s + ((Number(c.valorPago) || Number(c.valor)) || 0), 0)));

  const semRef = contas.filter((c) => c && !String(c.numeroDoc || "").trim());
  if (semRef.length) furos.push(furo("Transação sem número de referência",
    "Sem número não há como amarrar nota e comprovante na prestação de contas.",
    semRef.length, semRef.reduce((s, c) => s + ((Number(c.valorPago) || Number(c.valor)) || 0), 0)));

  const semCliente = !String(o.clienteId || "").trim();
  if (semCliente) furos.push(furo("Obra sem cliente",
    "Sem cliente, nada desta obra chega à base do cliente nem à do escritório.", contas.length, 0));

  const totalPago = red(pagas.reduce((s, c) => s + ((Number(c.valorPago) || Number(c.valor)) || 0), 0));
  const ligado = red(pagas.filter((c) => String(c.insumoCodigo || "").trim() && String(c.etapa || c.etapaId || "").trim())
    .reduce((s, c) => s + ((Number(c.valorPago) || Number(c.valor)) || 0), 0));
  return {
    furos,
    ok: furos.length === 0,
    totalPago,
    ligado,
    // quanto do que já foi pago dá para rastrear até o item orçado
    pctLigado: totalPago > 0 ? Math.round((ligado / totalPago) * 1000) / 10 : 0,
  };
}

// ── Subcontas: a conta aberta por grupo de material ─────────────
// "Material R$ 222 mil" não diz nada. Aberto por grupo — concreto,
// esquadrias, tintas, aço —, o orçamento vira leitura: dá para ver qual
// grupo estourou e qual ainda nem começou. O estimado sai do grupo do item
// na planilha do escritório; o realizado, do grupo que veio na nota.
// A mesma função serve para etapa, trocando a chave.
function subcontasDaConta(itens, contasPagar, contaId, opcoes) {
  const o = opcoes || {};
  // o grupo passa pelo vocabulário do catálogo: "Louças" e "Metais" viravam
  // duas linhas onde o catálogo diz "Louças e metais"
  const gr = (v) => (typeof grupoCanonico === "function" ? grupoCanonico(v) : (v || ""));
  const chaveEst = o.chave === "etapa" ? ((i) => i.etapaId || "") : ((i) => gr(i.grupoMaterial));
  const chaveReal = o.chave === "etapa" ? ((c) => c.etapa || c.etapaId || "") : ((c) => gr(c.grupoMaterial));
  const est = {}, real = {};
  for (const i of itens || []) {
    if (!i || i.contaId !== contaId) continue;
    const k = chaveEst(i);
    est[k] = Math.round(((est[k] || 0) + (Number(i.valor) || 0)) * 100) / 100;
  }
  for (const c of contasPagar || []) {
    if (!c || !c.pago || c.contaId !== contaId) continue;
    const k = chaveReal(c);
    real[k] = Math.round(((real[k] || 0) + (Number(c.valorPago) || Number(c.valor) || 0)) * 100) / 100;
  }
  const chaves = [...new Set([...Object.keys(est), ...Object.keys(real)])];
  const nomeEtapa = (id) => {
    const e = (typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : []).find((x) => x.id === id);
    return e ? e.nome : id;
  };
  const semNome = o.chave === "etapa" ? "Sem etapa" : "Sem grupo";
  return chaves
    .map((k) => ({
      chave: k,
      nome: !k ? semNome : (o.chave === "etapa" ? nomeEtapa(k) : k),
      estimado: est[k] || 0, realizado: real[k] || 0,
      saldo: Math.round(((est[k] || 0) - (real[k] || 0)) * 100) / 100,
    }))
    .filter((l) => l.estimado || l.realizado)
    // Do maior para o menor: é onde o dinheiro está, não a ordem do plano.
    .sort((a, b) => (b.estimado || b.realizado) - (a.estimado || a.realizado));
}

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

// ── Recalibrar as datas de um pedido ────────────────────────────
// O contrato se recalibra pela regra (parcelas, periodicidade) e as contas
// renascem dela. O pedido não tem regra: as datas foram digitadas uma a uma,
// entrega por entrega. Então aqui o que se preserva é o ESPAÇAMENTO — move-se
// a primeira conta em aberto para a data nova e as outras andam o mesmo
// tanto de dias. Conta paga não se mexe: a data dela é fato consumado.
function contasDoPedido(contas, cotacaoId) {
  return (contas || []).filter((c) => c && c.cotacaoId === cotacaoId)
    .slice().sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));
}

function diasEntreIso(de, para) {
  if (!de || !para) return 0;
  const a = new Date(de + "T12:00:00"), b = new Date(para + "T12:00:00");
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

function recalibrarPedido(contas, cotacaoId, novaData, quem, agoraIso) {
  const doPedido = contasDoPedido(contas, cotacaoId);
  const emAberto = doPedido.filter((c) => !c.pago);
  if (!emAberto.length || !novaData) return contas || [];
  const delta = diasEntreIso(emAberto[0].vencimento, String(novaData).slice(0, 10));
  if (!delta) return contas || [];
  const mover = new Set(emAberto.map((c) => c.id));
  const agora = agoraIso || new Date().toISOString();
  // A conta do pedido não é reescrita por regra nenhuma (as datas foram
  // digitadas à mão), então é nela mesma que o ato fica registrado.
  return (contas || []).map((c) => {
    if (!mover.has(c.id)) return c;
    const movida = { ...c, vencimento: somarDias(c.vencimento, delta) };
    return quem
      ? registrarAto(movida, "recalibrada", quem, agora,
          `${cpDiaBR(c.vencimento)} → ${cpDiaBR(movida.vencimento)}`)
      : movida;
  });
}

// ── Um pagamento só, em vez do pedido inteiro ───────────────────
// Escorregar tudo junto serve quando a obra atrasou e a entrega toda foi
// junto. Não serve quando UMA entrega atrasou: aí as outras continuam no dia
// combinado, e mover todas seria reescrever um acerto que ninguém desfez.
// Então a telinha tem os dois caminhos, e este é o segundo — cada conta em
// aberto com a data dela.
// Recalibrar move a data E o valor do que ainda não foi pago. O valor entra
// aqui porque a realidade corrige a previsão: mediu menos, entregou menos,
// o fornecedor deu desconto. O que já foi pago não se mexe — é fato
// consumado, e reescrevê-lo seria reescrever o extrato.
function recalibrarContasDoPedido(contas, mudancas, quem, agoraIso) {
  const porId = {};
  for (const d of mudancas || []) {
    if (!d || !d.id) continue;
    const alvo = porId[d.id] || (porId[d.id] = {});
    if (d.vencimento) alvo.vencimento = String(d.vencimento).slice(0, 10);
    if (d.valor != null && d.valor !== "") {
      const v = Math.round((typeof numeroDeCampo === "function" ? numeroDeCampo(d.valor) : Number(d.valor) || 0) * 100) / 100;
      if (v > 0) alvo.valor = v;
    }
  }
  const agora = agoraIso || new Date().toISOString();
  return (contas || []).map((c) => {
    if (!c || c.pago || !porId[c.id]) return c;
    const m = porId[c.id];
    const mudouData = !!m.vencimento && m.vencimento !== c.vencimento;
    const mudouValor = m.valor != null && Math.abs(m.valor - (Number(c.valor) || 0)) >= 0.005;
    if (!mudouData && !mudouValor) return c;
    const movida = { ...c };
    if (mudouData) movida.vencimento = m.vencimento;
    if (mudouValor) movida.valor = m.valor;
    if (!quem) return movida;
    const conta = [
      mudouData ? `${cpDiaBR(c.vencimento)} → ${cpDiaBR(movida.vencimento)}` : "",
      mudouValor ? `${cpDinheiro(c.valor)} → ${cpDinheiro(movida.valor)}` : "",
    ].filter(Boolean).join(" · ");
    return registrarAto(movida, "recalibrada", quem, agora, conta);
  });
}

// O total do que ainda está em aberto, antes e depois do ajuste. É o número
// que se confere antes de confirmar: recalibrar sem ver o total é mudar
// parcela por parcela sem saber onde a soma foi parar.
function totalDaRecalibragem(pagamentos) {
  const n = (v) => (typeof numeroDeCampo === "function" ? numeroDeCampo(v) : Number(v) || 0);
  const red = (x) => Math.round(x * 100) / 100;
  const lista = (pagamentos || []).filter(Boolean);
  const antes = red(lista.reduce((s, p) => s + (Number(p.valorOriginal != null ? p.valorOriginal : p.valor) || 0), 0));
  const depois = red(lista.reduce((s, p) => s + n(p.valor), 0));
  return { antes: antes, depois: depois, diferenca: red(depois - antes), mudou: Math.abs(depois - antes) >= 0.005 };
}

function previaDatasDoPedido(contas, cotacaoId, datas, limite) {
  const antes = contasDoPedido(contas, cotacaoId);
  const depois = contasDoPedido(recalibrarContasDoPedido(contas, datas), cotacaoId);
  const porId = {};
  for (const c of antes) porId[c.id] = c.vencimento;
  const linhas = [];
  let pagas = 0;
  for (const c of depois) {
    if (c.pago) { pagas++; continue; }
    linhas.push({ id: c.id, descricao: c.descricao, de: porId[c.id] || "", para: c.vencimento });
    if (limite && linhas.length >= limite) break;
  }
  return { linhas, pagas, total: depois.length };
}

// ── Pagamentos em aberto de um documento ────────────────────────
// Serve aos dois: contrato (contratoId) e pedido (cotacaoId). É a lista que
// a telinha mostra quando se quer mexer num pagamento só.
function pagamentosEmAberto(contas, alvoId, tipo) {
  const campo = tipo === "pedido" ? "cotacaoId" : "contratoId";
  return (contas || [])
    .filter((c) => c && c[campo] === alvoId && !c.pago)
    .slice()
    .sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)))
    .map((c) => ({ id: c.id, descricao: c.descricao || "", vencimento: c.vencimento || "",
      valor: Number(c.valor) || 0 }));
}

// A prévia de um ajuste de contrato: gera as contas com a exceção aplicada e
// compara com as de agora.
function previaAjusteContrato(contrato, contas, datas, limite) {
  const antes = (contas || []).filter((c) => c && c.contratoId === (contrato || {}).id);
  const porId = {};
  for (const c of antes) porId[c.id] = c.vencimento;
  const depois = contasDoContrato(ajustarVencimentos(contrato, datas));
  const linhas = [];
  let pagas = 0;
  for (const c of depois) {
    const anterior = antes.find((x) => x.id === c.id);
    if (anterior && anterior.pago) { pagas++; continue; }
    linhas.push({ id: c.id, descricao: c.descricao, de: porId[c.id] || "", para: c.vencimento });
    if (limite && linhas.length >= limite) break;
  }
  return { linhas, pagas, total: depois.length };
}

// ── Pedido lançado antes de existir número ──────────────────────
// A numeração compartilhada com o contrato chegou depois, e quem já tinha
// lançado ficou com um pedido sem número: na lista ele aparece pelo nome do
// fornecedor, e dois pedidos para o MESMO fornecedor viram dois itens
// idênticos, impossíveis de distinguir. Então o número é atribuído na
// primeira vez que a tela abre, seguindo a fila de sempre, e desce para as
// contas que já tinham nascido dele.
function numerarPedidosAntigos(obra, obras) {
  const cots = (obra && obra.cotacoes) || [];
  const faltando = cots.filter((c) => c && c.contaGeradaId && !c.numeroPedido);
  if (!faltando.length) return null;
  let n = parseInt(String(proximoNumeroDoc(obras)).replace(/\D/g, ""), 10);
  if (!Number.isFinite(n)) n = 1;
  const novos = {};
  for (const c of faltando) { novos[c.id] = String(n).padStart(4, "0"); n++; }
  return {
    ...obra,
    cotacoes: cots.map((c) => (novos[c.id] ? { ...c, numeroPedido: novos[c.id] } : c)),
    contasPagar: ((obra && obra.contasPagar) || []).map((x) =>
      x && x.cotacaoId && novos[x.cotacaoId] && !x.numeroPedido
        ? { ...x, numeroPedido: novos[x.cotacaoId] }
        : x),
  };
}

// A prévia do que vai mudar, no mesmo formato da do contrato.
function previaDoPedido(contas, cotacaoId, novaData, limite) {
  const antes = contasDoPedido(contas, cotacaoId);
  const depois = contasDoPedido(recalibrarPedido(contas, cotacaoId, novaData), cotacaoId);
  const porId = {};
  for (const c of antes) porId[c.id] = c.vencimento;
  const linhas = [];
  let pagas = 0;
  for (const c of depois) {
    if (c.pago) { pagas++; continue; }
    linhas.push({ id: c.id, descricao: c.descricao, de: porId[c.id] || "", para: c.vencimento });
    if (limite && linhas.length >= limite) break;
  }
  return { linhas, pagas, total: depois.length };
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
// ── A base de dados: uma linha por item ─────────────────────────
// O espelho da planilha de controle: cada conta da obra é um item (de uma
// nota, de um pedido, de um contrato). As colunas são as da planilha do
// escritório — Ref, cliente, obra, unidade de negócio, fornecedor, a
// descrição do lançamento (a transação inteira), conta contábil, nota, o
// valor total da nota, período contábil, data do lançamento (o pagamento),
// e o item: insumo do catálogo, unidade, quantidade, preço, valor, etapa e
// grupo. É daqui que se filtra, soma e exporta.
const CP_UNIDADES_NEGOCIO = { escritorio: "Escritório", projetos: "Projetos", gestao_obras: "Gestão de obras", empreendimento: "Empreendimento" };

// ── O número do papel ───────────────────────────────────────────
// Toda transação paga tem um número de papel — o mesmo da sequência dos
// arquivos do escritório (3274, 3275 … 4214). Ele nasce na baixa, vai para
// o campo "Nota / Comprovante" (`doc`) e dá nome ao arquivo anexado: o
// comprovante da Ref 0185 pago hoje vira "4215.jpg", e é por 4215 que se
// acha o papel na pasta e a linha na base.
//
// O próximo é o maior da série + 1. Um número solto bem acima da série (o
// nº de uma nota digitado no campo do documento, como 8623) não puxa a
// sequência: vale o maior número que tem outro a menos de 500 abaixo.
function proximoNumeroDePapel(obras, lancamentos) {
  const vistos = new Set();
  const olhar = (v) => { const t = String(v == null ? "" : v).trim(); if (/^\d{3,6}$/.test(t)) vistos.add(+t); };
  for (const o of obras || []) for (const c of (o && o.contasPagar) || []) if (c) olhar(c.doc);
  for (const l of lancamentos || []) if (l) olhar(l.documento);
  const ns = [...vistos].sort((a, b) => a - b);
  if (!ns.length) return 1;
  for (let i = ns.length - 1; i >= 1; i--) if (ns[i] - ns[i - 1] <= 500) return ns[i] + 1;
  return ns[ns.length - 1] + 1;
}

// O nome do arquivo segue o número: "4215.pdf"; o segundo papel da mesma
// transação, "4215-2.jpg". Nome que já é um número (o papel que veio da
// pasta, "4098.pdf") fica como está.
function cpNomeDoPapel(numero, ordem, nomeAntigo) {
  const m = String(nomeAntigo || "").match(/\.([A-Za-z0-9]{2,5})$/);
  return String(numero) + (ordem > 0 ? "-" + (ordem + 1) : "") + (m ? "." + m[1].toLowerCase() : "");
}
function cpNomeJaENumero(nome) {
  return /^\d{3,6}(-\d+)?(\.[A-Za-z0-9]{2,5})?$/.test(String(nome || "").trim());
}

// Numera as transações pagas que ainda não têm papel e dá o nome do número
// aos arquivos delas. `elegivel(c)` diz quais contas podem ganhar número
// agora (na gravação do dia a dia, só as que acabaram de ser pagas ou de
// receber um papel). Devolve as contas e o próximo número livre.
function numerarPapeisDasPagas(contas, proximo, elegivel, numeros) {
  const lista = (contas || []).slice();
  let n = Number(proximo) || 1;
  const pode = typeof elegivel === "function" ? elegivel : () => true;
  const chave = (c) => String(c.numeroDoc || c.pedidoId || c.id);
  const grupos = {};
  lista.forEach((c, i) => { if (c && c.pago) (grupos[chave(c)] = grupos[chave(c)] || []).push(i); });
  for (const k of Object.keys(grupos)) {
    const idx = grupos[k];
    if (!idx.some((i) => pode(lista[i]))) continue;
    const comDoc = idx.map((i) => lista[i]).find((c) => String(c.doc || "").trim());
    let numero = comDoc ? String(comDoc.doc).trim() : "";
    if (!numero && numeros && numeros[k]) numero = String(numeros[k]);
    if (!numero) { numero = String(n); n++; }
    // os papéis da transação, na ordem em que aparecem, com o nome novo
    const nomes = new Map();
    const chaveDoPapel = (a) => (a && (a.public_id || a.url || a.nome)) || "";
    for (const i of idx) {
      const c = lista[i];
      const papeis = (Array.isArray(c.anexos) ? c.anexos.filter(Boolean) : []).concat(c.comprovante ? [c.comprovante] : []);
      for (const a of papeis) {
        const kp = chaveDoPapel(a);
        if (!kp || nomes.has(kp)) continue;
        nomes.set(kp, cpNomeJaENumero(a.nome) ? a.nome : cpNomeDoPapel(numero, nomes.size, a.nome));
      }
    }
    const renomear = (a) => { if (!a) return a; const nv = nomes.get(chaveDoPapel(a)); return nv && nv !== a.nome ? { ...a, nome: nv } : a; };
    for (const i of idx) {
      const c = lista[i];
      let x = c;
      if (!String(c.doc || "").trim()) x = { ...x, doc: numero };
      if (Array.isArray(c.anexos) && c.anexos.length) x = { ...x, anexos: c.anexos.map(renomear) };
      if (c.comprovante) x = { ...x, comprovante: renomear(c.comprovante) };
      lista[i] = x;
    }
  }
  return { contas: lista, proximo: n };
}

// ── Completar a base ────────────────────────────────────────────
// O que as regras conseguem preencher no que já está gravado, numa lista
// para conferir antes de gravar:
//   1. número do papel nas transações pagas sem número (na ordem do
//      pagamento), com o arquivo renomeado, e o mesmo número no lançamento
//      do escritório ligado a ela;
//   2. item ligado ao catálogo quando o nome é igual ao de um insumo;
//   3. unidade com a grafia do catálogo ("unidades" → "Unidades");
//   4. os ajustes combinados um a um (etapa do aço da Cobop, a perfuração,
//      o nome do prestador do empreiteiro) — cada um só vale enquanto o
//      campo ainda estiver como estava.
const CP_AJUSTES_COMBINADOS = {
  contas: [
    { obraId: "in624qo", ref: "0174", cotacaoId: "6y18uze", etapa: "fundacao", grupoMaterial: "Aço" },
    { obraId: "in624qo", ref: "0175", cotacaoId: "6y18uze", etapa: "fundacao", grupoMaterial: "Aço" },
    { obraId: "in624qo", ref: "0176", cotacaoId: "6y18uze", etapa: "supra_paredes_1", grupoMaterial: "Aço" },
    { obraId: "in624qo", ref: "0177", cotacaoId: "6y18uze", etapa: "supra_paredes_1", grupoMaterial: "Aço" },
    { obraId: "in624qo", ref: "0178", cotacaoId: "6y18uze", etapa: "supra_paredes_1", grupoMaterial: "Aço" },
    { obraId: "in624qo", ref: "0179", cotacaoId: "kzzld9w", insumoCodigo: "LOC-003" },
  ],
  catalogo: [{ codigo: "PRE-001", de: "Pedreiros Casa", para: "Empreiteiro" }],
};
function cpChaveDoNome(t) {
  return cpSemAcento(t).replace(/[\u2013\u2014-]/g, "-").replace(/\s+/g, " ").trim();
}
function completarBase(dados, opcoes) {
  const d = dados || {};
  const o = opcoes || {};
  const quem = o.quem || "";
  const agora = o.agora || new Date().toISOString();
  const ajustes = o.ajustes || CP_AJUSTES_COMBINADOS;
  const etapas = o.etapas || (typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : []);
  const nomeEtapa = (id) => ((etapas || []).find((e) => e && e.id === id) || {}).nome || id;
  const obras = (d.obras || []).filter(Boolean);
  const lancs = d.lancamentos || [];
  const materiais = (d.materiais || []).filter(Boolean);
  const ativos = materiais.filter((m) => m.ativo !== false);
  const grupos = { papel: [], escritorio: [], catalogo: [], unidade: [], ajuste: [], insumos: [] };
  const nomeObra = (ob) => ob.nome || ob.id;
  const reg = (c, det) => (typeof registrarAto === "function" ? registrarAto(c, "editada", quem, agora, det) : c);

  // 1. números do papel, na ordem do pagamento
  const chave = (c) => String(c.numeroDoc || c.pedidoId || c.id);
  const pend = [];
  for (const ob of obras) {
    const vistos = {};
    for (const c of ob.contasPagar || []) {
      if (!c || !c.pago || String(c.doc || "").trim()) continue;
      const k = chave(c);
      const irmas = (ob.contasPagar || []).filter((x) => x && x.pago && chave(x) === k);
      if (vistos[k] || irmas.some((x) => String(x.doc || "").trim())) continue;
      vistos[k] = 1;
      pend.push({ ob, k, irmas, data: String(c.pagoEm || c.vencimento || "").slice(0, 10), ref: c.numeroDoc || "" });
    }
  }
  pend.sort((a, b) => a.data.localeCompare(b.data) || String(a.ref).localeCompare(String(b.ref)));
  let n = proximoNumeroDePapel(obras, lancs);
  const numerosPorObra = {};
  for (const p of pend) {
    const num = n++;
    (numerosPorObra[p.ob.id] = numerosPorObra[p.ob.id] || {})[p.k] = num;
    const c0 = p.irmas[0];
    const papeis = [];
    for (const c of p.irmas) for (const a of (c.anexos || []).filter(Boolean).concat(c.comprovante ? [c.comprovante] : [])) {
      if (a && papeis.indexOf(a.nome) < 0) papeis.push(a.nome);
    }
    grupos.papel.push({ obraId: p.ob.id, texto: `${num} · ${nomeObra(p.ob)} · Ref ${p.ref || "—"} · ${c0.favorecido || ""} · ${c0.descricao || ""}`
      + (p.irmas.length > 1 ? ` (${p.irmas.length} itens)` : "")
      + " · " + (papeis.length ? papeis.map((x, i) => `${x} → ${cpNomeJaENumero(x) ? x : cpNomeDoPapel(num, i, x)}`).join(", ") : "sem arquivo") });
  }

  // índice do catálogo pelo nome e apelidos
  const porNome = new Map();
  for (const m of ativos) for (const nm of [m.nome].concat(m.aliases || [])) {
    const k = cpChaveDoNome(nm);
    if (k && !porNome.has(k)) porNome.set(k, m);
  }
  const grafia = {};
  for (const m of ativos) { const u = String(m.unidade || "").trim(); if (u && !grafia[u.toLowerCase()]) grafia[u.toLowerCase()] = u; }

  const obrasNovas = obras.map((ob) => {
    let contas = (ob.contasPagar || []).slice();
    if (numerosPorObra[ob.id]) {
      const alvo = numerosPorObra[ob.id];
      contas = numerarPapeisDasPagas(contas, 0, (c) => !!alvo[chave(c)], alvo).contas
        .map((c, i) => (c !== ob.contasPagar[i] && String(c.doc || "") !== String((ob.contasPagar[i] || {}).doc || "")
          ? reg(c, "número do papel " + c.doc) : c));
    }
    contas = contas.map((c) => {
      if (!c) return c;
      let x = c;
      // 4. ajustes combinados
      for (const a of ajustes.contas || []) {
        if (a.obraId !== ob.id || a.ref !== x.numeroDoc || (a.cotacaoId && a.cotacaoId !== x.cotacaoId)) continue;
        const muda = [];
        if (a.etapa && !x.etapa) { x = { ...x, etapa: a.etapa }; muda.push("etapa " + nomeEtapa(a.etapa)); }
        if (a.grupoMaterial && !x.grupoMaterial) { x = { ...x, grupoMaterial: a.grupoMaterial }; muda.push("grupo " + a.grupoMaterial); }
        if (a.insumoCodigo && !x.insumoCodigo) {
          const m = ativos.find((i) => i.codigo === a.insumoCodigo);
          if (m) { x = { ...x, insumoCodigo: m.codigo }; muda.push(`catálogo ${m.codigo} ${m.nome}`); }
        }
        if (muda.length) {
          x = reg(x, muda.join(", "));
          grupos.ajuste.push({ obraId: ob.id, texto: `${nomeObra(ob)} · Ref ${x.numeroDoc} · ${x.descricao || ""} → ${muda.join(" · ")}` });
        }
      }
      // 2. ligar ao catálogo pelo nome
      if (!x.insumoCodigo && !x.contratoId) {
        const m = porNome.get(cpChaveDoNome(x.descricao));
        if (m) {
          x = reg({ ...x, insumoCodigo: m.codigo }, "ligado ao catálogo " + m.codigo);
          grupos.catalogo.push({ obraId: ob.id, texto: `${nomeObra(ob)} · Ref ${x.numeroDoc || "—"} · ${x.descricao} → ${m.codigo}` });
        }
      }
      // 3. unidade com a grafia do catálogo
      const u = String(x.unidade || "").trim();
      if (u && grafia[u.toLowerCase()] && grafia[u.toLowerCase()] !== u) {
        const nova = grafia[u.toLowerCase()];
        x = reg({ ...x, unidade: nova }, `unidade ${u} → ${nova}`);
        grupos.unidade.push({ obraId: ob.id, texto: `${nomeObra(ob)} · Ref ${x.numeroDoc || "—"} · ${x.descricao} · ${u} → ${nova}` });
      }
      return x;
    });
    return contas.some((c, i) => c !== (ob.contasPagar || [])[i]) ? { ...ob, contasPagar: contas } : ob;
  });

  // 1b. o número no lançamento do escritório ligado à transação
  const lancsNovos = lancs.map((l) => {
    const or = (l && l.origem) || {};
    const ob = or.obraId && obrasNovas.find((x) => x.id === or.obraId);
    if (!ob || !numerosPorObra[ob.id]) return l;
    const conta = (ob.contasPagar || []).find((c) => c && cpLancamentoDaConta([l], ob.id, c));
    const doc = conta && String(conta.doc || "").trim();
    if (!doc || !numerosPorObra[ob.id][chave(conta)] || String(l.documento || "") === doc) return l;
    grupos.escritorio.push({ texto: `${l.descricao || "Lançamento"} · documento ${l.documento || "—"} → ${doc}` });
    return { ...l, documento: doc };
  });

  // 4b. o nome no catálogo
  const materiaisNovos = materiais.map((m) => {
    const a = (ajustes.catalogo || []).find((x) => x.codigo === m.codigo);
    if (!a || m.nome !== a.de) return m;
    grupos.insumos.push({ texto: `${m.codigo} · ${a.de} → ${a.para} (o nome antigo fica como apelido)` });
    return { ...m, nome: a.para, aliases: [...new Set((m.aliases || []).concat([a.de]))] };
  });

  const total = Object.values(grupos).reduce((t, g) => t + g.length, 0);
  return { dados: { ...d, obras: obrasNovas, lancamentos: lancsNovos, materiais: materiaisNovos }, grupos, total };
}

// O lançamento do escritório que representa esta conta (a ponte grava a
// origem: a conta, o pedido inteiro ou o papel da planilha antiga).
function cpLancamentoDaConta(lancamentos, obraId, c) {
  for (const l of lancamentos || []) {
    const o = (l && l.origem) || {};
    if (!o.obraId || o.obraId !== obraId) continue;
    if (o.tipo === "conta" && o.refId === c.id) return l;
    if (o.tipo === "pedido" && c.pedidoId && String(o.refId || "").split("|")[0] === c.pedidoId) return l;
    if (o.tipo === "doc" && c.doc && String(o.refId || "") === String(c.doc)) return l;
  }
  return null;
}

// O prestador do catálogo que o contrato representa. Vale o que o contrato
// gravou (`insumoCodigo`); sem isso, o tipo do profissional e o texto do
// serviço apontam para o item do grupo "Prestadores de serviços".
const CP_SERVICO_NO_CATALOGO = [
  [/gerenc|gest[aã]o|administra/, ["gestao obra"]],
  [/serralh/, ["serralheiro"]],
  [/eletric/, ["eletricista"]],
  [/encan|hidraul/, ["encanador"]],
  [/pint/, ["pintor"]],
  [/carpint/, ["carpinteiro"]],
  [/marcen/, ["marceneiro portas internas"]],
  [/impermeab/, ["impermeabilizador"]],
  [/terraplan/, ["terraplanagem"]],
  [/empreit|obra civil|pedreir|alvenaria/, ["empreiteiro", "pedreiros casa"]],
];
function cpInsumoDoContrato(c, ctr, insumos) {
  const lista = (insumos || []).filter(Boolean);
  const cod = (c && c.insumoCodigo) || (ctr && ctr.insumoCodigo);
  if (cod) { const x = lista.find((i) => i.codigo === cod || i.id === cod); if (x) return x; }
  const texto = cpSemAcento([ctr && ctr.tipoProfissional, c && c.servico, ctr && ctr.servico, ctr && ctr.descricaoServico, c && c.contaId].filter(Boolean).join(" "));
  if (!texto) return null;
  const prest = lista.filter((i) => i.tipo === "prestador" || /prestador/i.test(i.grupo || ""));
  for (const [rx, nomes] of CP_SERVICO_NO_CATALOGO) {
    if (!rx.test(texto)) continue;
    const x = prest.find((i) => nomes.indexOf(cpSemAcento(i.nome)) >= 0);
    if (x) return x;
  }
  return null;
}

function linhasDaBase(obras, opcoes) {
  const o = opcoes || {};
  const red = (x) => Math.round(x * 100) / 100;
  const nomeDe = (lista, id) => ((lista || []).find((x) => x && x.id === id) || {}).nome || "";
  const insumoDe = (cod) => (o.insumos || []).find((x) => x && (x.codigo === cod || x.id === cod)) || null;
  // "unidades" e "Unidades" são a mesma unidade: vale a grafia do catálogo
  const grafia = {};
  for (const i of o.insumos || []) {
    const u = String((i && i.unidade) || "").trim();
    if (u && !grafia[u.toLowerCase()]) grafia[u.toLowerCase()] = u;
  }
  const dia = (v) => String(v || "").slice(0, 10);
  const saida = [];
  for (const ob of obras || []) {
    if (!ob) continue;
    const cli = (o.clientes || []).find((x) => x && x.id === ob.clienteId) || null;
    const cliente = (cli && cli.nome) || "";
    const unidadeDaObra = cli && cli.servicos && cli.servicos.empreendimento ? "empreendimento" : "gestao_obras";
    const contas = (ob.contasPagar || []).filter(Boolean);
    const valorDe = (c) => red(Number(c.pago ? (c.valorPago || c.valor) : c.valor) || 0);
    // a transação: a mesma Ref junta os itens de uma compra
    const chave = (c) => String(c.numeroDoc || c.pedidoId || c.id);
    const porChave = {};
    for (const c of contas) (porChave[chave(c)] = porChave[chave(c)] || []).push(c);
    for (const c of contas) {
      const total = valorDe(c);
      const qtd = Number(c.quantidade) || 0;
      const ins = c.insumoCodigo ? insumoDe(c.insumoCodigo) : null;
      const irmas = porChave[chave(c)] || [c];
      const lanc = cpLancamentoDaConta(o.lancamentos, ob.id, c);
      const cot = c.cotacaoId ? (ob.cotacoes || []).find((x) => x && x.id === c.cotacaoId) : null;
      const ctr = c.contratoId ? (ob.contratos || []).find((x) => x && x.id === c.contratoId) : null;
      const titulo = String((cot && cot.titulo) || "").trim();
      const desc = String(c.descricao || "").trim();
      // a descrição da transação inteira; o item fica na coluna do insumo.
      // Cotação que o lançamento da loja abriu leva o nome da loja como
      // título — aí o título não descreve nada e vale o pedido.
      const tituloUtil = titulo && cpSemAcento(titulo) !== cpSemAcento(c.favorecido || "") ? titulo : "";
      const n = c.numeroNota || c.doc;
      const itemTexto = titulo && desc.indexOf(titulo + " — ") === 0 ? desc.slice(titulo.length + 3).trim() : desc;
      let descricaoLanc = desc;
      let insumoNome = ins ? ins.nome : "";
      if (c.contratoId) {
        // parcela de contrato não é item: o serviço vai na descrição
        descricaoLanc = c.servico && desc.indexOf(c.servico) < 0 ? `${c.servico} — ${desc}` : desc;
      } else if (c.pedidoId) {
        descricaoLanc = n ? "Nota " + n : (c.numeroLoja ? "Pedido " + c.numeroLoja : (tituloUtil || desc));
        if (!ins) insumoNome = desc;
      } else if (tituloUtil && Number(c.parcelasTotal) > 1) {
        // a compra paga por entrega: cada parcela é uma etapa da mesma compra
        if (!ins) insumoNome = tituloUtil;
      } else if (tituloUtil) {
        descricaoLanc = tituloUtil;
        if (!ins && itemTexto !== tituloUtil) insumoNome = itemTexto;
      } else if (irmas.length > 1) {
        descricaoLanc = n ? "Nota " + n : desc;
        if (!ins) insumoNome = desc;
      }
      if (lanc && lanc.descricao) descricaoLanc = String(lanc.descricao).trim();
      if (!ins && !insumoNome && !c.contratoId && itemTexto && itemTexto !== descricaoLanc) insumoNome = itemTexto;
      if (insumoNome === descricaoLanc && !ins) insumoNome = "";
      const valorNota = lanc && (lanc.origem || {}).tipo !== "conta" && Number(lanc.valor)
        ? red(Math.abs(Number(lanc.valor)))
        : red(irmas.reduce((t, x) => t + valorDe(x), 0));
      const pagoEm = c.pago ? dia(c.pagoEm) : "";
      const vencimento = dia(c.vencimento);
      // o período contábil é a competência, reconhecida no vencimento (o
      // contrato tem várias parcelas: cada uma no mês em que vence)
      const competencia = String((vencimento || pagoEm).slice(0, 7) || c.competencia || (lanc && lanc.competencia) || "").slice(0, 7);

      const regs = (c.registros || []).filter((r) => r && r.em);
      const criada = regs.find((r) => r.ato === "criada");
      const primeiro = regs.map((r) => dia(r.em)).sort()[0] || "";
      const entradaEm = dia((criada && criada.em) || c.importadoEm || c.lancadoEm || (cot && cot.lancadoEm)
        || (ctr && (ctr.criadoEm || ctr.criadaEm || ctr.dataAssinatura)) || primeiro);
      // a data do lançamento é a da entrada no sistema
      const dataLanc = entradaEm;
      const un = String(c.unidade || "").trim();
      // Regras para não ficar em branco. Parcela de contrato: o serviço é o
      // item, 1 unidade, preço = valor, etapa e grupo "Prestadores de
      // serviços". Sem quantidade: 1 unidade pelo valor. Sem insumo: o grupo
      // (ou "Outros"), como na planilha do escritório.
      const PREST = "Prestadores de serviços";
      const ehContrato = !!c.contratoId;
      const semQtd = !(qtd > 0);
      // o contrato aponta para o prestador do catálogo (Gestão Obra,
      // Serralheiro, Empreiteiro…) pelo tipo do profissional e pelo serviço
      const insC = ins || (ehContrato ? cpInsumoDoContrato(c, ctr, o.insumos) : null);
      let insumoFinal = insC ? insC.nome : insumoNome;
      if (ehContrato && !insC) insumoFinal = String(c.servico || (ctr && (ctr.servico || ctr.descricaoServico)) || "Serviço").trim();
      const grupoFinal = c.grupoMaterial || (insC && insC.grupo) || (ehContrato ? PREST : "");
      if (!insumoFinal) insumoFinal = grupoFinal || "Outros";
      const etapaNome = nomeDe(o.etapas, c.etapa) || c.etapa || (ehContrato ? PREST : "");
      saida.push({
        id: c.id, obraId: ob.id, obra: ob.nome || "", cliente,
        unidadeNegocio: CP_UNIDADES_NEGOCIO[(lanc && lanc.unidadeId) || unidadeDaObra] || "",
        ref: c.numeroDoc || "", nota: String(c.doc || c.numeroNota || ""), arquivo: String(c.doc || ""),
        fornecedor: c.favorecido || nomeDe(o.prestadores, c.prestadorId) || "",
        descricaoLanc, item: desc, insumoCodigo: c.insumoCodigo || (insC && insC.codigo) || "", insumo: insC ? insC.nome : "", insumoNome: insumoFinal,
        quantidade: semQtd ? 1 : qtd, unidade: semQtd ? (grafia[un.toLowerCase()] || un || "Unidades") : (grafia[un.toLowerCase()] || un || "Unidades"),
        unitario: semQtd ? total : Math.round((total / qtd) * 10000) / 10000,
        total, valorNota,
        grupo: grupoFinal,
        etapaId: c.etapa || (ehContrato ? "prestadores" : ""), etapa: etapaNome,
        contaId: c.contaId || "", conta: nomeDe(o.planoContas, c.contaId) || c.contaId || "",
        pago: !!c.pago, pagoEm, vencimento, competencia, dataLanc, entradaEm,
        noEscritorio: !!lanc,
        origem: c.origem || "", papeis: (Array.isArray(c.anexos) ? c.anexos.filter(Boolean).length : 0) + (c.comprovante ? 1 : 0),
        conta_: c,
      });
    }
  }
  // o mais recente primeiro; dentro do dia, pela referência
  return saida.sort((a, b) => (b.pagoEm || b.vencimento).localeCompare(a.pagoEm || a.vencimento)
    || String(b.ref).localeCompare(String(a.ref)));
}

function filtrarBase(linhas, filtro, op) {
  const f = filtro || {};
  const contas = buscarContas(linhas.map((l) => l.conta_), f, op);
  const ids = new Set(contas.map((c) => c.id));
  return linhas.filter((l) => ids.has(l.id)
    && (!f.obraId || l.obraId === f.obraId)
    && (!f.grupo || l.grupo === f.grupo)
    && (!f.de || (l.pagoEm || l.vencimento) >= f.de)
    && (!f.ate || (l.pagoEm || l.vencimento) <= f.ate)
    && (!f.situacao || (f.situacao === "pago" ? l.pago : !l.pago)));
}

// As colunas da planilha, na ordem e com os títulos da planilha de
// controle do escritório. Situação e vencimento vêm depois, para as contas
// ainda a pagar.
const BASE_COLUNAS = [
  ["ref", "Ref"], ["cliente", "Nome Cliente"], ["obra", "Projeto / obra"], ["unidadeNegocio", "Unidade negócio"],
  ["fornecedor", "Fornecedor"], ["descricaoLanc", "Descrição Lançamento"], ["conta", "Conta contábil"],
  ["nota", "Nota / Comprovante"], ["valorNota", "Valor total nota"], ["competencia", "Período Contábil"],
  ["dataLanc", "Data do lançamento"], ["insumoNome", "Nome Insumo (catálogo)"], ["unidade", "Unidade"],
  ["quantidade", "Quantidade"], ["unitario", "Preço"], ["total", "Valor"], ["etapa", "Etapa"], ["grupo", "Grupo Materiais"],
  ["situacao", "Situação"], ["vencimento", "Vencimento"], ["entradaEm", "Entrada no sistema"],
];
function tabelaDaBase(linhas) {
  return [BASE_COLUNAS.map((c) => c[1])].concat((linhas || []).map((l) => BASE_COLUNAS.map(([k]) => {
    if (k === "situacao") return l.pago ? "Pago" : "A pagar";
    const v = l[k];
    return v == null ? "" : v;
  })));
}

// O relatório em Excel, no modelo do escritório (FORMATAR BASE): as 18
// colunas da planilha, Century Gothic 8 nos dados e 10 em negrito branco no
// título azul, várias colunas centralizadas, os formatos de moeda, mês
// ("jul-27"), data ("5-ago-26") e quantidade contábil, e a largura de cada
// coluna pelo maior conteúdo (o título conta). Texto longo para em 45 — a
// descrição inteira continua na célula.
const CP_MOEDA_XL = '"R$"\\ #,##0.00';
const BASE_RELATORIO = [
  ["Ref", "numeroTexto", "0000", "center"], ["Nome Cliente", "texto", "", "center"], ["Projeto / obra", "texto", "", "center"],
  ["Unidade negócio", "texto", "", "center"], ["Fornecedor", "texto", "", "center"], ["Descrição Lançamento", "texto", "", ""],
  ["Conta contábil", "texto", "", "center"], ["Nota / Comprovante", "numeroTexto", "0", "center"], ["Valor total nota", "moeda", CP_MOEDA_XL, ""],
  ["Período Contábil", "mes", "[$-416]mmm\\-yy;@", "center"], ["Data do lançamento", "data", "[$-416]d\\-mmm\\-yy;@", "center"],
  ["Nome Insumo (catálogo)", "texto", "", ""], ["Unidade", "texto", "", "center"],
  ["Quantidade", "numero", '_-* #,##0.00_-;\\-* #,##0.00_-;_-* "-"??_-;_-@_-', ""], ["Preço", "moeda", CP_MOEDA_XL, ""],
  ["Valor", "moeda", CP_MOEDA_XL, ""], ["Etapa", "texto", "", "center"], ["Grupo Materiais", "texto", "", "center"],
];
// largura aproximada do texto na fonte (maiúscula é mais larga)
function cpLarguraDoTexto(t) {
  let w = 0;
  for (const ch of String(t)) {
    if (ch === " ") w += 0.45;
    else if (/[A-ZÀ-Ý]/.test(ch)) w += 1.2;
    else if (/[a-zß-ÿ0-9]/.test(ch)) w += 0.85;
    else w += 0.5;
  }
  return w;
}
function planilhaDaBase(tabela) {
  const cab = (tabela || [])[0] || [];
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const br = (v, casas) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  const idx = BASE_RELATORIO.map(([t]) => cab.indexOf(t));
  const linhas = (tabela || []).slice(1).map((l) => idx.map((j) => (j >= 0 ? l[j] : "")));
  const colunas = BASE_RELATORIO.map(([titulo, tipo, formato, alinhar], k) => {
    let maior = cpLarguraDoTexto(titulo) * 1.25 + 2.5;
    for (const l of linhas) {
      const v = l[k];
      if (v === "" || v == null) continue;
      const m = String(v).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
      const t = tipo === "moeda" ? "R$ " + br(v, 2) : tipo === "numero" ? " " + br(v, 2) + " "
        : tipo === "mes" && m ? meses[+m[2] - 1] + "-" + m[1].slice(2)
        : tipo === "data" && m ? +m[3] + "-" + meses[+m[2] - 1] + "-" + m[1].slice(2) : String(v);
      maior = Math.max(maior, cpLarguraDoTexto(t) * 1.08 + 2);
    }
    return { titulo, tipo, formato, alinhar, largura: Math.round(Math.min(45, maior) * 100) / 100 };
  });
  return { colunas, linhas };
}

// ── Procurar e filtrar as contas ────────────────────────────────
// Uma caixa só: cada palavra digitada tem que aparecer em algum lugar da
// conta — ref, descrição, fornecedor, conta contábil, etapa, nº da nota,
// valor ("12,80" ou "12.8") ou o nome do papel anexado ("4113.pdf").
// Os filtros de lado (papel, conta, etapa) se somam à busca.
function cpSemAcento(t) {
  return String(t == null ? "" : t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function textoDeBuscaDaConta(c, op) {
  const o = op || {};
  const x = c || {};
  const v = Number(x.valorPago) || Number(x.valor) || 0;
  const valores = v > 0 ? [v.toFixed(2), v.toFixed(2).replace(".", ","), String(v), String(v).replace(".", ","),
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })] : [];
  const anexos = (Array.isArray(x.anexos) ? x.anexos : []).concat(x.comprovante ? [x.comprovante] : []);
  return cpSemAcento([
    x.numeroDoc, x.numeroDoc ? "ref " + x.numeroDoc : "", x.descricao, x.favorecido,
    o.nomePrestador ? o.nomePrestador(x.prestadorId) : "", o.nomeConta ? o.nomeConta(x.contaId) : "",
    o.nomeEtapa ? o.nomeEtapa(x.etapa) : "", x.numeroNota, x.numeroNota ? "nota " + x.numeroNota : "",
    x.observacao, ...valores, ...anexos.map((a) => (a && a.nome) || ""),
  ].filter(Boolean).join(" | "));
}
const FILTROS_PAPEL = [
  { id: "todos", nome: "Todos" },
  { id: "com", nome: "Com papel" },
  { id: "sem", nome: "Sem papel" },
];
function temPapel(c) {
  return (Array.isArray((c || {}).anexos) && c.anexos.some(Boolean)) || !!(c || {}).comprovante;
}
function buscarContas(contas, filtro, op) {
  const f = filtro || {};
  const termos = cpSemAcento(f.texto || "").split(/\s+/).filter(Boolean);
  return (contas || []).filter((c) => {
    if (!c) return false;
    if (f.papel === "com" && !temPapel(c)) return false;
    if (f.papel === "sem" && temPapel(c)) return false;
    if (f.contaId && c.contaId !== f.contaId) return false;
    if (f.etapa && c.etapa !== f.etapa) return false;
    if (!termos.length) return true;
    const t = textoDeBuscaDaConta(c, op);
    const junto = t.replace(/\s+/g, "");
    return termos.every((w) => t.indexOf(w) >= 0 || junto.indexOf(w) >= 0);
  });
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

// ── UI — a Base de dados ─────────────────────────────────────────
// A planilha de controle dentro do VICKE: uma linha por item, as colunas
// de sempre, os filtros por cima e o botão de baixar em Excel. Na obra
// mostra só a obra; no escritório, todas.
let cpCargaExcel = null;
function carregarExcelJS() {
  if (typeof window !== "undefined" && window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (cpCargaExcel) return cpCargaExcel;
  cpCargaExcel = new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
    s.onload = () => (window.ExcelJS ? ok(window.ExcelJS) : falha(new Error("sem ExcelJS")));
    s.onerror = () => { cpCargaExcel = null; falha(new Error("não carregou")); };
    document.head.appendChild(s);
  });
  return cpCargaExcel;
}

function BaseDeDados({ obras, clientes, prestadores, insumos, lancamentos, isMobile, obraFixa, nomeDoArquivo, completar }) {
  // "Completar a base": o que as regras preenchem no que já está gravado,
  // listado para conferir; só grava no clique de quem confere.
  const [conferindo, setConferindo] = useState(false);
  const [gravandoBase, setGravandoBase] = useState("");
  const pendencias = useMemo(() => (completar && completar.data ? completarBase(completar.data, { quem: completar.quem }) : null),
    [completar && completar.data]);
  async function gravarCompletar() {
    if (!completar || !pendencias || !pendencias.total) return;
    setGravandoBase("Gravando…");
    try {
      const r = completarBase(completar.data, { quem: completar.quem });
      await completar.save(r.dados);
      setGravandoBase(`Gravado: ${r.total} ${r.total === 1 ? "ajuste" : "ajustes"}.`);
      setConferindo(false);
    } catch (e) {
      setGravandoBase("Não gravou: " + ((e && e.message) || "erro"));
    }
  }
  const [texto, setTexto] = useState("");
  const [obraId, setObraId] = useState("");
  const [contaId, setContaId] = useState("");
  const [etapa, setEtapa] = useState("");
  const [grupo, setGrupo] = useState("");
  const [papel, setPapel] = useState("todos");
  const [situacao, setSituacao] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [limite, setLimite] = useState(300);
  const [baixando, setBaixando] = useState("");
  const etapas = typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : [];
  const plano = typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : [];
  const linhas = useMemo(() => linhasDaBase(obras || [], { clientes, prestadores, insumos, lancamentos, etapas, planoContas: plano }),
    [obras, clientes, prestadores, insumos, lancamentos]);
  const nomeDe = (lista, id) => ((lista || []).find((x) => x && x.id === id) || {}).nome || "";
  const op = { nomePrestador: (id) => nomeDe(prestadores, id), nomeConta: (id) => nomeDe(plano, id), nomeEtapa: (id) => nomeDe(etapas, id) };
  const filtradas = filtrarBase(linhas, { texto, obraId, contaId, etapa, grupo, papel, situacao, de, ate }, op);
  const red = (x) => Math.round(x * 100) / 100;
  const soma = red(filtradas.reduce((t, l) => t + l.total, 0));
  const somaPaga = red(filtradas.filter((l) => l.pago).reduce((t, l) => t + l.total, 0));
  const unicos = (k, rot) => [...new Map(linhas.filter((l) => l[k]).map((l) => [l[k], rot ? l[rot] : l[k]])).entries()]
    .map(([valor, rotulo]) => ({ valor, rotulo })).sort((a, b) => String(a.rotulo).localeCompare(String(b.rotulo)));
  const moeda = (v) => (typeof fmtMoedaCtr === "function" ? fmtMoedaCtr(v) : "R$ " + Number(v || 0).toFixed(2));
  const num = (v, casas) => (v == null || v === "" ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas || 0, maximumFractionDigits: casas == null ? 3 : casas }));
  const diaBR = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };
  const mesBR = (ym) => { const m = String(ym || "").match(/^(\d{4})-(\d{2})/); return m ? `${m[2]}/${m[1]}` : ""; };
  const procurando = !!(texto.trim() || obraId || contaId || etapa || grupo || papel !== "todos" || situacao || de || ate);
  const limpar = () => { setTexto(""); setObraId(""); setContaId(""); setEtapa(""); setGrupo(""); setPapel("todos"); setSituacao(""); setDe(""); setAte(""); };

  async function baixar() {
    setBaixando("Montando a planilha…");
    const tabela = tabelaDaBase(filtradas);
    const plan = planilhaDaBase(tabela);
    const nome = (nomeDoArquivo || "base-de-dados").replace(/[^\w-]+/g, "-").toLowerCase() + "-" + new Date().toISOString().slice(0, 10);
    const salvar = (blob, arquivo) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = arquivo; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    try {
      const E = await carregarExcelJS();
      const wb = new E.Workbook();
      wb.creator = "VICKE";
      // relatório: títulos em negrito, linha de títulos congelada, colunas
      // na largura do conteúdo, filtro no cabeçalho
      const ws = wb.addWorksheet("Base de dados", { views: [{ state: "frozen", xSplit: 0, ySplit: 1, activeCell: "A2" }] });
      ws.columns = plan.colunas.map((c) => ({ header: c.titulo, key: c.titulo, width: c.largura }));
      const fonte = { name: "Century Gothic", size: 8 };
      plan.linhas.forEach((linha) => {
        const r = ws.addRow(linha.map((v, j) => {
          const tipo = plan.colunas[j].tipo;
          if (v === "" || v == null) return null;
          // número guardado como texto ("4224", "0194") vai como número, para
          // o Excel não marcar a célula; o formato mantém os zeros da Ref
          if (tipo === "numeroTexto") return /^\d{1,9}$/.test(String(v).trim()) ? Number(String(v).trim()) : v;
          if (tipo === "data" || tipo === "mes") {
            const m = String(v).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
            return m ? new Date(Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1)) : v;
          }
          return v;
        }));
        r.height = 10.8;
        r.eachCell({ includeEmpty: true }, (cel, j) => {
          const c = plan.colunas[j - 1];
          cel.font = fonte;
          if (c.formato) cel.numFmt = c.formato;
          if (c.alinhar) cel.alignment = { horizontal: c.alinhar };
        });
      });
      const cab = ws.getRow(1);
      cab.height = 19.95;
      cab.eachCell((cel) => {
        cel.font = { name: "Century Gothic", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF366092" } };
        cel.alignment = { horizontal: "center", vertical: "middle" };
      });
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, plan.linhas.length + 1), column: plan.colunas.length } };
      const buf = await wb.xlsx.writeBuffer();
      salvar(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nome + ".xlsx");
      setBaixando("");
    } catch (e) {
      // sem a biblioteca: CSV com ponto e vírgula, que o Excel brasileiro abre
      const esc = (v) => { const t = typeof v === "number" ? String(v).replace(".", ",") : String(v == null ? "" : v); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
      const csv = "\ufeff" + tabela.map((l) => l.map(esc).join(";")).join("\r\n");
      salvar(new Blob([csv], { type: "text/csv;charset=utf-8" }), nome + ".csv");
      setBaixando("");
    }
  }

  const input = { border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 10, padding: "8px 11px", fontSize: 13, color: "#111827",
    outline: "none", background: "#fff", fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
  const chip = (ativo, rot, fn) => (
    <button key={rot} type="button" onClick={fn} style={{ border: `1.5px solid ${ativo ? "#0474f4" : "rgba(38,36,33,0.16)"}`,
      background: ativo ? "#eff6ff" : "#fff", color: ativo ? "#0474f4" : "#374151", borderRadius: 999, padding: "5px 12px",
      fontSize: 12, fontWeight: ativo ? 600 : 500, cursor: "pointer", fontFamily: "inherit" }}>{rot}</button>
  );
  // a mesma ordem da planilha; na obra, cliente e obra já estão no título
  const COLS = [
    ["ref", "Ref", 48],
    ...(obraFixa ? [] : [["cliente", "Cliente", 150], ["obra", "Projeto / obra", 130]]),
    ["unidadeNegocio", "Unid. negócio", 110], ["fornecedor", "Fornecedor", 150], ["descricaoLanc", "Descrição lançamento", 190],
    ["conta", "Conta contábil", 130], ["nota", "Nota", 64], ["valorNota", "Total nota", 96], ["competencia", "Período", 64],
    ["dataLanc", "Data lanç.", 80], ["pagoEm", "Pagamento", 86], ["insumoNome", "Insumo (catálogo)", 210], ["unidade", "Un", 70], ["quantidade", "Qtd", 56],
    ["unitario", "Preço", 80], ["total", "Valor", 92], ["etapa", "Etapa", 130], ["grupo", "Grupo", 120], ["papeis", "📎", 30],
  ];
  const grade = COLS.map((c) => c[2] + "px").join(" ");
  const largura = COLS.reduce((t, c) => t + c[2], 0) + COLS.length * 8 + 24;
  const direita = ["quantidade", "unitario", "total", "valorNota"];
  const celula = (l, k) => {
    if (k === "pagoEm") return l.pago ? diaBR(l.pagoEm) : <span style={{ color: "#b45309" }}>vence {diaBR(l.vencimento)}</span>;
    if (k === "competencia") return mesBR(l.competencia);
    if (k === "dataLanc") return diaBR(l.dataLanc);
    if (k === "valorNota") return moeda(l.valorNota);
    if (k === "entradaEm") return diaBR(l.entradaEm);
    if (k === "quantidade") return l.quantidade ? num(l.quantidade) : "";
    if (k === "unitario") return l.unitario == null ? "" : num(l.unitario, 2);
    if (k === "total") return moeda(l.total);
    if (k === "papeis") return l.papeis ? (l.papeis > 1 ? "📎" + l.papeis : "📎") : "";
    return l[k] || "";
  };
  const visiveis = filtradas.slice(0, limite);

  return (
    <div style={{ minWidth: 0, maxWidth: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : (obraFixa ? "minmax(0,2fr) repeat(3, minmax(0,1fr))" : "minmax(0,2fr) repeat(4, minmax(0,1fr))"), gap: 8, marginBottom: 8 }}>
        <input style={input} value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Procurar na base"
          placeholder="Procurar: item, fornecedor, nota, ref, valor…" />
        {!obraFixa && (
          <SelectBusca style={input} value={obraId} onChange={(v) => setObraId(v || "")} vazio="Todas as obras" placeholder="Procurar obra…"
            opcoes={[{ valor: "", rotulo: "Todas as obras" }].concat(unicos("obraId", "obra"))} />
        )}
        <SelectBusca style={input} value={etapa} onChange={(v) => setEtapa(v || "")} vazio="Todas as etapas" placeholder="Procurar etapa…"
          opcoes={[{ valor: "", rotulo: "Todas as etapas" }].concat(unicos("etapaId", "etapa"))} />
        <SelectBusca style={input} value={grupo} onChange={(v) => setGrupo(v || "")} vazio="Todos os grupos" placeholder="Procurar grupo…"
          opcoes={[{ valor: "", rotulo: "Todos os grupos" }].concat(unicos("grupo"))} />
        <SelectBusca style={input} value={contaId} onChange={(v) => setContaId(v || "")} vazio="Todas as contas" placeholder="Procurar conta…"
          opcoes={[{ valor: "", rotulo: "Todas as contas" }].concat(unicos("contaId", "conta"))} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        {chip(situacao === "", "Tudo", () => setSituacao(""))}
        {chip(situacao === "pago", "Pago", () => setSituacao("pago"))}
        {chip(situacao === "apagar", "A pagar", () => setSituacao("apagar"))}
        <span style={{ width: 8 }} />
        {chip(papel === "com", "Com papel", () => setPapel(papel === "com" ? "todos" : "com"))}
        {chip(papel === "sem", "Sem papel", () => setPapel(papel === "sem" ? "todos" : "sem"))}
        <span style={{ display: isMobile ? "grid" : "inline-flex", gridTemplateColumns: "auto minmax(0,1fr) auto minmax(0,1fr)", width: isMobile ? "100%" : undefined,
          gap: 6, alignItems: "center", fontSize: 12, color: "#4b5563" }}>
          de <input type="date" value={de} onChange={(e) => setDe(e.target.value)} aria-label="De" style={{ ...input, width: isMobile ? "100%" : 140, minWidth: 0, padding: "5px 8px" }} />
          até <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} aria-label="Até" style={{ ...input, width: isMobile ? "100%" : 140, minWidth: 0, padding: "5px 8px" }} />
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 12.5, color: "#374151" }}>
          <b>{filtradas.length}</b> {filtradas.length === 1 ? "item" : "itens"} · total <b>{moeda(soma)}</b>
          {somaPaga !== soma ? ` · pago ${moeda(somaPaga)}` : ""}
          {procurando && <> · <button type="button" onClick={limpar} style={{ background: "none", border: "none", padding: 0, color: "#0474f4", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5 }}>limpar filtros</button></>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {pendencias && pendencias.total > 0 && (
          <button type="button" onClick={() => setConferindo(!conferindo)}
            style={{ background: "#fff", color: "#0474f4", border: "1.5px solid #0474f4", borderRadius: 10, padding: "7px 14px", fontSize: 12.5,
              fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Completar a base ({pendencias.total})
          </button>
        )}
        <button type="button" onClick={baixar} disabled={!filtradas.length || !!baixando}
          style={{ background: "#0474f4", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12.5, fontWeight: 600,
            cursor: filtradas.length ? "pointer" : "default", opacity: filtradas.length ? 1 : 0.5, fontFamily: "inherit" }}>
          {baixando || "Baixar Excel"}
        </button>
        </div>
      </div>
      {gravandoBase && !conferindo && <div style={{ fontSize: 12.5, color: /^Não/.test(gravandoBase) ? "#b91c1c" : "#047857", marginBottom: 10 }}>{gravandoBase}</div>}
      {conferindo && pendencias && (
        <div style={{ border: "1.5px solid #0474f4", borderRadius: 12, padding: 14, marginBottom: 12, background: "#f8fbff" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Completar a base</div>
          <div style={{ fontSize: 12, color: "#4b5563", margin: "2px 0 10px" }}>
            O que as regras preenchem no que já está gravado. Confira; nada muda até você gravar.
          </div>
          {[["papel", "Número do papel (e nome do arquivo)"], ["escritorio", "Mesmo número no lançamento do escritório"],
            ["catalogo", "Item ligado ao catálogo pelo nome"], ["unidade", "Unidade com a grafia do catálogo"],
            ["ajuste", "Ajustes combinados"], ["insumos", "Catálogo"]].map(([k, titulo]) => {
            const linhas = pendencias.grupos[k] || [];
            if (!linhas.length) return null;
            return (
              <details key={k} open={linhas.length <= 12} style={{ marginBottom: 8 }}>
                <summary style={{ fontSize: 12.5, fontWeight: 600, color: "#111827", cursor: "pointer" }}>{titulo} — {linhas.length}</summary>
                <div style={{ maxHeight: 260, overflowY: "auto", marginTop: 4 }}>
                  {linhas.map((l, i) => (
                    <div key={i} style={{ fontSize: 11.5, color: "#374151", padding: "3px 0", borderBottom: "1px solid rgba(38,36,33,0.06)", overflowWrap: "anywhere" }}>{l.texto}</div>
                  ))}
                </div>
              </details>
            );
          })}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={gravarCompletar} disabled={!!gravandoBase && gravandoBase === "Gravando…"}
              style={{ background: "#0474f4", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {gravandoBase === "Gravando…" ? "Gravando…" : `Gravar ${pendencias.total} ${pendencias.total === 1 ? "ajuste" : "ajustes"}`}
            </button>
            <button type="button" onClick={() => setConferindo(false)}
              style={{ background: "#fff", color: "#374151", border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 10, padding: "7px 14px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
              Cancelar
            </button>
          </div>
          {/^Não/.test(gravandoBase) && <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 6 }}>{gravandoBase}</div>}
        </div>
      )}

      {!filtradas.length ? (
        <div style={{ border: "1px dashed rgba(38,36,33,0.2)", borderRadius: 12, padding: 24, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
          {linhas.length ? "Nada com esses filtros." : "Nenhum item lançado ainda."}
        </div>
      ) : isMobile ? (
        <div style={{ display: "grid", gap: 8 }}>
          {visiveis.map((l) => (
            <div key={l.id} style={{ border: "1px solid rgba(38,36,33,0.12)", borderRadius: 12, padding: 12, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", minWidth: 0 }}>{l.insumoNome || l.descricaoLanc || "—"}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", whiteSpace: "nowrap" }}>{moeda(l.total)}</div>
              </div>
              <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 3 }}>
                {[l.ref ? "ref " + l.ref : "", l.fornecedor, l.insumoNome && l.descricaoLanc !== l.insumoNome ? l.descricaoLanc : "",
                  l.nota && l.descricaoLanc !== "Nota " + l.nota ? "nota " + l.nota : "", l.valorNota !== l.total ? "total nota " + moeda(l.valorNota) : "",
                  l.pago ? diaBR(l.pagoEm) : "vence " + diaBR(l.vencimento)].filter(Boolean).join(" · ")}
              </div>
              <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 2 }}>
                {[l.quantidade ? `${num(l.quantidade)} ${l.unidade}`.trim() + (l.unitario != null ? ` × ${num(l.unitario, 2)}` : "") : "", l.etapa, l.grupo, l.conta,
                  l.unidadeNegocio, !obraFixa ? [l.cliente, l.obra].filter(Boolean).join(" / ") : ""].filter(Boolean).join(" · ")}
                {l.papeis ? " · 📎" : ""}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid rgba(38,36,33,0.12)", borderRadius: 12, background: "#fff" }}>
          <div style={{ minWidth: largura }}>
            <div style={{ display: "grid", gridTemplateColumns: grade, gap: 8, padding: "8px 12px", borderBottom: "1px solid rgba(38,36,33,0.1)",
              fontSize: 10.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.3, position: "sticky", top: 0, background: "#fff" }}>
              {COLS.map(([k, rot]) => <span key={k} style={{ textAlign: direita.indexOf(k) >= 0 ? "right" : "left" }}>{rot}</span>)}
            </div>
            {visiveis.map((l) => (
              <div key={l.id} style={{ display: "grid", gridTemplateColumns: grade, gap: 8, padding: "7px 12px", borderBottom: "1px solid rgba(38,36,33,0.05)",
                fontSize: 12, color: "#374151", alignItems: "baseline" }}>
                {COLS.map(([k]) => (
                  <span key={k} title={typeof l[k] === "string" ? l[k] : undefined}
                    style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      textAlign: direita.indexOf(k) >= 0 ? "right" : "left", fontVariantNumeric: "tabular-nums",
                      color: k === "item" || k === "total" ? "#111827" : undefined, fontWeight: k === "total" ? 600 : 400 }}>
                    {celula(l, k)}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      {filtradas.length > limite && (
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <button type="button" onClick={() => setLimite(limite + 300)} style={{ border: "1.5px solid rgba(38,36,33,0.16)", background: "#fff",
            borderRadius: 10, padding: "7px 14px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
            Mostrar mais ({filtradas.length - limite} restantes) — o Excel baixa todos
          </button>
        </div>
      )}
    </div>
  );
}
