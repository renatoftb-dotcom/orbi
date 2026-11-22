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
  const dia = Math.floor(Number(o.diaVencimento) || 0);
  if (dia > 0) return dia;
  // Sem dia escolhido, vale o dia da âncora: início em 31/01 vence 28/02 e
  // volta a 31/03 — sem isto o 28 de fevereiro virava o dia de todo mês,
  // contra o "mesmo dia dos meses subsequentes" da cláusula.
  const a = /^\d{4}-\d{2}-(\d{2})/.exec(String(ancoraContrato(o)));
  return a ? Number(a[1]) : 0;
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
    // nº de parcelas em branco é o saldo inteiro numa parcela só — sem o
    // "|| 1" só a entrada virava conta e o saldo sumia das contas a pagar
    const n = Math.max(0, Math.floor(Number(c.parcelas) || 0)) || 1;
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
    // contrato global antigo, sem o campo, é item a item — o mesmo padrão
    // que o texto do contrato usa (montarContrato)
    const porItem = (c.entradaEscopo || (c.modelo === "empreitadaGlobal" ? "item" : "contrato")) === "item";
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

  // ── Retenção de garantia ──
  // A cláusula de pagamento retém a última parcela, ou um percentual de cada
  // pagamento, até o aceite final (montarContrato, opção "retencao"). Sem
  // isto as contas pagavam tudo no calendário normal, contra o contrato.
  // Gerenciamento e serviço com equipamento não têm essa cláusula.
  const modeloId = typeof contratoModelo === "function" ? contratoModelo(c.modelo).id : c.modelo;
  const temRetencao = modeloId !== "gerenciamentoObra" && modeloId !== "servicoEquipamento"
    && typeof opcaoAtiva === "function" && opcaoAtiva(c, "retencao");
  if (linhas.length && temRetencao) {
    // o aceite vem depois da conclusão: a previsão informada, ou o fim do
    // prazo — nunca antes do vencimento que a parcela já teria
    const fim = c.previsaoConclusao || vencimentoFinal(c);
    const noAceite = (v) => (fim && (!v || fim > v) ? fim : v);
    const pct = Number(c.retencaoPct) || 0;
    if (pct > 0) {
      // "De cada pagamento será retido X%": cada linha paga o resto, e o
      // retido volta numa linha só — o total continua o do contrato
      let retido = 0;
      for (const l of linhas) {
        const r = Math.round(l.valor * pct) / 100;
        l.valor = Math.round((l.valor - r) * 100) / 100;
        retido += r;
      }
      retido = Math.round(retido * 100) / 100;
      if (retido > 0) {
        const ultimo = linhas.reduce((a, l) => (l.vencimento && l.vencimento > a ? l.vencimento : a), "");
        // totalParcelas 0: o título não vira "Parcela 7/6"
        linhas.push({ n: linhas.length + 1, parcela: linhas.length + 1, totalParcelas: 0,
          descricao: "Retenção — liberação no aceite", valor: retido,
          vencimento: noAceite(ultimo), estimada: true, retencao: true });
      }
    } else if (modo !== "entradaFinal") {
      // "A última parcela ficará retida ... e será paga somente após a
      // conclusão total dos serviços e o respectivo aceite final". Na
      // entrada + saldo no final a última já é o saldo da conclusão.
      const u = linhas[linhas.length - 1];
      u.descricao = /\)$/.test(u.descricao) ? u.descricao.replace(/\)$/, ", retida até o aceite)") : `${u.descricao} — retida até o aceite`;
      u.retida = true;
      const v = noAceite(u.vencimento);
      if (v !== u.vencimento) { u.vencimento = v; u.estimada = true; }
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
  // o valor na tela já tem o saldo de gestão somado; a exceção guarda só a
  // parte da regra
  const saldo = c.ajustesSaldo || {};
  for (const d of pagamentos || []) {
    if (!d || !d.id || d.valor == null || d.valor === "") continue;
    const novo = Math.round((typeof numeroDeCampo === "function" ? numeroDeCampo(d.valor) : Number(d.valor) || 0) * 100) / 100;
    if (!(novo > 0)) continue;
    if (Math.abs((daRegra[d.id] || 0) - novo) < 0.005) delete ajustes[d.id];
    else ajustes[d.id] = Math.round((novo - (Number(saldo[d.id]) || 0)) * 100) / 100;
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
  // O saldo de gestão do mês anterior (pago a mais ou a menos) acerta a
  // parcela seguinte; a frase curta vai junto, para quem olha saber por quê.
  const saldo = (c && c.ajustesSaldo) || {};
  const notasSaldo = (c && c.notasSaldo) || {};
  const ligar = typeof comPadraoDaConta === "function" ? comPadraoDaConta : (x) => x;
  return parcelasAPagar(c).map((p, idx) => ligar({
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
    // fica em branco aqui e recebe o padrão da conta: mão de obra entra
    // em "Prestadores de serviços" (comPadraoDaConta).
    etapa: c.etapa || "",
    prestadorId: c.prestadorId || "",
    favorecido: c.nomeContratado || "",
    descricao: p.descricao,
    valor: Math.round(((ajustesV[`${c.id}:${idx + 1}`] != null ? ajustesV[`${c.id}:${idx + 1}`] : p.valor)
      + (Number(saldo[`${c.id}:${idx + 1}`]) || 0)) * 100) / 100,
    ...(notasSaldo[`${c.id}:${idx + 1}`] ? { notaSaldo: notasSaldo[`${c.id}:${idx + 1}`] } : {}),
    valorAjustado: ajustesV[`${c.id}:${idx + 1}`] != null,
    vencimento: ajustes[`${c.id}:${idx + 1}`] || p.vencimento || "",
    ajustada: !!ajustes[`${c.id}:${idx + 1}`],
    estimada: !!p.estimada && !ajustes[`${c.id}:${idx + 1}`],
    // a linha do retido e a última parcela retida carregam a marca: é por
    // ela que a sincronização acerta o retido das parcelas já pagas cheias
    ...(p.retencao ? { retencao: true } : {}),
    ...(p.retida ? { retida: true } : {}),
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
    if (anterior.pago) {
      const paga = { ...anterior, contaId: nova.contaId, servico: nova.servico, favorecido: nova.favorecido };
      return typeof comPadraoDaConta === "function" ? comPadraoDaConta(paga) : paga;
    }
    // A parcela em aberto é reescrita pela regra do contrato, mas o que
    // alguém anotou ou registrou nela não é da regra — fica. O número de
    // documento também: é por ele que a nota e o comprovante se amarram a
    // esta parcela na prestação de contas, e um número que muda a cada
    // abertura da tela não amarra nada.
    // O estorno também: a parcela devolvida e paga de novo é outro
    // pagamento, e é a contagem das voltas que separa um do outro.
    return { ...nova, observacao: anterior.observacao || "", registros: anterior.registros || [],
      ...(anterior.numeroDoc ? { numeroDoc: anterior.numeroDoc } : {}),
      ...(anterior.estornos ? { estornos: anterior.estornos } : {}),
      ...(anterior.movimentos ? { movimentos: anterior.movimentos } : {}),
      // Os papéis também: o boleto anexado à parcela em aberto (e o número
      // do papel) sumiam na primeira regravação — bastava prorrogar outra
      // parcela do mesmo contrato.
      ...(anterior.anexos ? { anexos: anterior.anexos } : {}),
      ...(anterior.comprovante ? { comprovante: anterior.comprovante } : {}),
      ...(anterior.doc ? { doc: anterior.doc } : {}),
      ...(anterior.chaveNota ? { chaveNota: anterior.chaveNota } : {}),
      ...(anterior.idTransacao ? { idTransacao: anterior.idTransacao } : {}) };
  });
  // parcela paga que não existe mais no contrato continua na lista: o
  // dinheiro saiu, e sumir com ela esconderia um pagamento real
  const orfas = pagas.filter((x) => !geradas.some((g) => g.id === x.id));
  // Retenção percentual num contrato com parcelas JÁ pagas pelo valor cheio
  // (antes de a retenção entrar nas contas): o retido delas não existe — o
  // dinheiro saiu inteiro. A linha da retenção fica com o que falta para
  // fechar o contrato, e some se não falta nada; senão o total passaria do
  // valor do contrato.
  const ret = geradas.find((g) => g && g.retencao && !g.pago);
  if (ret) {
    const cent = (v) => Math.round((Number(v) || 0) * 100) / 100;
    // o valor do contrato manda: parcela com valor ajustado à mão não leva o
    // desconto da retenção, e somar as contas geradas passaria do contrato
    const totalDoContrato = Number(c.valor) > 0 ? cent(c.valor)
      : cent(contasDoContrato(c).reduce((t, x) => t + (Number(x.valor) || 0), 0));
    const resto = cent([...geradas, ...orfas].filter((g) => g !== ret).reduce((t, g) => t + (Number(g.valor) || 0), 0));
    const falta = cent(totalDoContrato - resto);
    if (falta <= 0) return [...outras, ...geradas.filter((g) => g !== ret), ...orfas];
    if (falta !== cent(ret.valor)) {
      const i = geradas.indexOf(ret);
      geradas[i] = { ...ret, valor: falta };
    }
  }
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
// No planejado, a compra no cartão do escritório conta inteira desde o dia
// da compra: as parcelas pagas e as que ainda vão cair nas faturas. No
// contas a pagar e na base, cada parcela segue a fatura dela.
// Toda conta lançada a pagar vale o mesmo — a compra a prazo (pedido, nota,
// boleto a vencer) e a conta avulsa: é custo executado, pago ou não; é a
// mesma régua da prestação por competência. A parcela de contrato a pagar
// fica de fora: o serviço dela ainda vai ser feito.
function contaNoRealizado(c) {
  if (!c) return false;
  if (c.pago || (c.parcelaCartao && c.parcelaCartao.grupo)) return true;
  return !!(!c.contratoId && !c.vendaId && Number(c.valor) !== 0);
}
// A venda de imóvel no Planejamento: o Planejamento acompanha a EXECUÇÃO
// (gasto × planejado), não apura resultado. Do lado da venda, o realizado é
// o que já entrou ("Recebido"); o que falta receber da venda aparece só como
// informação, fora do realizado (ver aReceberDaVendaNoPlanejamento).
// O resultado pelo contrato é outra pergunta, de outra tela.
// Só para o quadro: a lista que volta não é gravada.
const PL_GRUPOS_DA_VENDA = { recebido: "Recebido" };
function contasDoPlanejamento(obra, contas) {
  const o = obra || {};
  const lista = (contas || o.contasPagar || []).filter(Boolean);
  if (!lista.some((c) => c.contaId === "venda_imovel")) return lista;
  return lista.map((c) => (c.contaId === "venda_imovel" && c.pago ? { ...c, grupoMaterial: PL_GRUPOS_DA_VENDA.recebido } : c));
}
function aReceberDaVendaNoPlanejamento(contas) {
  return Math.round((contas || []).filter((c) => c && c.contaId === "venda_imovel" && c.vendaId && !c.pago)
    .reduce((t, c) => t + (Number(c.valor) || 0), 0) * 100) / 100;
}
function valorNoRealizado(c) {
  return (c && c.pago ? (Number(c.valorPago) || Number(c.valor)) : Number((c || {}).valor)) || 0;
}
// Realizado por conta do plano de contas — é o que o Planejamento compara
// com a estimativa.
function realizadoPorConta(contas) {
  const r = {};
  for (const c of contas || []) {
    if (!contaNoRealizado(c)) continue;
    const k = c.contaId || "mo_diversos";
    r[k] = Math.round(((r[k] || 0) + valorNoRealizado(c)) * 100) / 100;
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
// Toda conta que nasce aqui passa pela mesma regra: a conta do plano traz
// a etapa e o grupo padrão (mão de obra → "Prestadores de serviços").
function cpLigar(c) { return typeof comPadraoDaConta === "function" ? comPadraoDaConta(c) : c; }

function contasDasEntregas(dados, novoId) {
  const d = dados || {};
  const id = typeof novoId === "function" ? novoId : (typeof uid === "function" ? uid : () => String(Date.now()));
  const hoje = dataParaIso(new Date());
  const linhas = (d.entregas || []).filter((e) => e && valorDaEntrega(e) > 0);
  return linhas.map((e, i) => cpLigar({
    id: id(),
    origem: CP_ORIGEM_COTACAO,
    obraId: d.obraId || "",
    contratoId: "",
    cotacaoId: d.cotacaoId || "",
    numeroPedido: d.numeroPedido || "",
    parcela: linhas.length > 1 ? i + 1 : 0,
    parcelasTotal: linhas.length > 1 ? linhas.length : 0,
    contaId: d.contaId || (typeof PLANO_CONTAS !== "undefined" && PLANO_CONTAS[0] ? PLANO_CONTAS[0].id : "material"),
    etapa: d.etapa || d.etapaId || "",
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
  return itensRateados(p).map((i) => cpLigar({
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
    // o preço de tabela, quando o desconto do pedido mexeu no item
    ...(Math.abs(brutoDoItem(i) - i.valor) >= 0.005 ? { valorTabela: brutoDoItem(i) } : {}),
    vencimento: venc,
    pago: false, pagoEm: "", valorPago: "", observacao: d.observacao || "",
    // o papel do pedido final da loja vai com cada conta do pedido — anexado
    // uma vez, na tela do pedido, e não de novo no contas a pagar
    ...(p.anexo && p.anexo.url ? { anexos: [{ ...p.anexo, tipo: p.anexo.tipo || "pedido" }] } : {}),
  }));
}

// ── O desconto do pedido, visto da conta a pagar ────────────────
// Os itens chegam ao contas a pagar já com o desconto distribuído, e a soma
// deles não bate com o valor de tabela do papel. Isto devolve as duas pontas
// para a tela dizer, em letra pequena, de onde vem a diferença.
// Procura no próprio item (valorTabela) e, para pedido antigo, no pedido
// guardado na conta da loja. Sem desconto → null.
function descontoDasContas(contas, cotacoes) {
  const red = (x) => Math.round(x * 100) / 100;
  const cs = (contas || []).filter(Boolean);
  if (!cs.length) return null;
  const total = red(cs.reduce((t, c) => t + cpNumero(c.valor), 0));
  let bruto = 0;
  if (cs.some((c) => cpNumero(c.valorTabela) > 0)) {
    bruto = red(cs.reduce((t, c) => t + (cpNumero(c.valorTabela) || cpNumero(c.valor)), 0));
  } else {
    const pid = cs[0].pedidoId;
    if (!pid) return null;
    for (const cot of cotacoes || []) {
      const ped = ((cot && cot.pedidos) || []).find((p) => p && p.id === pid);
      if (!ped) continue;
      if (cpNumero(ped.desconto) > 0) bruto = brutoDoPedido(ped);
      break;
    }
  }
  const desconto = red(bruto - total);
  if (!(bruto > 0) || desconto < 0.01) return null;
  return { bruto, total, desconto, pct: Math.round((desconto / bruto) * 1000) / 10 };
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
        pedidoId, numeroNota: String(l.numeroNota || "").trim(), numeroLoja: String(l.numeroLoja || "").trim(),
        numeroDoc: o.numeroDoc || "",
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
      c = cpLigar(c);
      c = registrarAto(c, "criada", o.quem || "", agora);
      if (pago) {
        c = contaPaga(c, { pagoEm: primeiro, valorPago: valor, comprovante: o.anexo || null }, o.quem || "", agora);
        const plano = pg.forma === "cartao" && o.cartao && typeof o.planoDoCartao === "function"
          ? o.planoDoCartao(c, o.cartao, { pagoEm: primeiro, valorPago: valor, parcelas: pg.parcelas }) : null;
        c = plano ? { ...c, ...plano } : { ...c, formaPagamento: pg.forma === "permuta" ? "permuta" : "avista",
          ...(pg.forma === "permuta" ? { permutaServicos: pg.permutaServicos || [] } : {}) };
      } else if (anexos.length) {
        c = { ...c, anexos };
      }
      fora.push(c);
    }
  }
  return fora;
}

// ── A Entrada a pagar de quem tem conta aberta ─────────────────
// Comprou a prazo numa loja que tem conta nesta obra: é mais um PEDIDO da
// conta dela — soma na fatura, aparece na lista de pedidos da loja e paga
// junto. Lançado como conta avulsa, ele aparecia no contas a pagar ao lado
// dos pedidos da loja mas não existia na conta dela, e o número do pedido
// virava número de nota.
function pedidoDaEntrada(lanc, prazoLoja) {
  const l = lanc || {};
  const base = pedidoVazio("");
  const data = String(l.emitido || "").slice(0, 10) || base.data;
  const ap = l.apagar || {};
  const prazo = Number(prazoLoja) || 0;
  const vencimento = String(ap.vencimento || "").slice(0, 10) || (prazo > 0 ? somarDias(data, prazo) : data);
  return {
    ...base, data, vencimento,
    numeroLoja: String(l.numeroLoja || "").trim(),
    numeroNota: String(l.numeroNota || "").trim(),
    desconto: cpNumero(l.desconto) || 0,
    origem: "entrada",
    itens: (l.itens || []).map((i) => {
      const q = cpNumero(i.quantidade);
      const bruto = cpNumero(i.bruto) || cpNumero(i.total);
      return { ...itemDoPedidoVazio(), descricao: String(i.descricao || "").trim(), insumoCodigo: i.insumoCodigo || "",
        grupoMaterial: i.grupoMaterial || "", quantidade: i.quantidade, unidade: i.unidade || "",
        unitario: q > 0 ? Math.round((bruto / q) * 10000) / 10000 : "", bruto,
        etapa: i.etapa || "", contaId: i.contaId || "" };
    }).filter((i) => i.bruto > 0),
  };
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
// Prestador de serviço não faz pedido: recebe pagamento. Quando todos os
// itens caem em conta de mão de obra ou de serviço (empreiteiro, pedreiro,
// eletricista, taxas…), o nível se chama "Pagamento" — "Pedido" é da loja.
const CP_GRUPOS_DE_SERVICO = ["maoDeObra", "servicos"];
const CP_CONTAS_DE_SERVICO_PADRAO = ["ajudantes", "carpinteiro", "eletricista", "empreiteiro", "encarregados", "mo_diversos",
  "marceneiro", "pedreiros", "pintor", "serralheiro", "impermeabilizacao", "encanador", "gesseiro", "instalador_ar",
  "assentador_pisos", "vale_refeicao", "fgts", "darf", "lixador_concreto", "adicionais_mo",
  "impostos", "impressao_plantas", "outras_taxas"];
function contaEhDeServico(contaId) {
  if (!contaId) return false;
  const plano = typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : null;
  if (plano && plano.length) {
    const c = plano.find((x) => x && x.id === contaId);
    if (c) return CP_GRUPOS_DE_SERVICO.indexOf(c.grupo) >= 0;
  }
  return CP_CONTAS_DE_SERVICO_PADRAO.indexOf(contaId) >= 0;
}
function pedidoEhServico(l) {
  const x = l || {};
  if (Array.isArray(x.pedidos)) return x.pedidos.length > 0 && x.pedidos.every(pedidoEhServico);
  const cs = (x.contas || []).filter(Boolean);
  return cs.length > 0 && cs.every((c) => contaEhDeServico(c.contaId));
}
// "pedido" ou "pagamento", no singular ou no plural, para as frases da tela.
function palavraDoPedido(l, n) {
  const serv = pedidoEhServico(l);
  return (serv ? "pagamento" : "pedido") + (n === 1 || n == null ? "" : "s");
}
function rotuloDoPedido(l) {
  const x = l || {};
  if (pedidoEhNotaPaga(x)) {
    const n = x.numeroNota || ((x.contas || [])[0] || {}).doc || "";
    return n ? "Nota " + n : "Nota";
  }
  return (pedidoEhServico(x) ? "Pagamento " : "Pedido ") + (x.numeroLoja || x.numeroPedido || "");
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

// ── Trocar o vencimento de um pedido (ou de todos os da loja) ──
// A loja combinou outra data: os itens EM ABERTO passam a vencer nela; o
// que já foi pago fica como está. Cada item guarda no histórico de onde
// para onde foi. O pedido na cotação (que também tem vencimento) acompanha,
// para as duas telas não dizerem datas diferentes.
function comVencimentoNovo(contasPagar, contaIds, vencimento, quem, agoraIso) {
  const alvo = new Set(contaIds || []);
  const novo = String(vencimento || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(novo)) return contasPagar || [];
  return (contasPagar || []).map((c) => {
    if (!c || !alvo.has(c.id) || c.pago || c.vencimento === novo) return c;
    const antes = c.vencimento || "";
    return registrarAto({ ...c, vencimento: novo }, "editada", quem, agoraIso, "vencimento " + (antes || "\u2014") + " \u2192 " + novo);
  });
}
function cotacoesComVencimento(cotacoes, pedidoIds, vencimento) {
  const ids = new Set(pedidoIds || []);
  const novo = String(vencimento || "").slice(0, 10);
  if (!ids.size || !novo) return cotacoes;
  return (cotacoes || []).map((c) => {
    if (!c || !(c.pedidos || []).some((x) => x && ids.has(x.id))) return c;
    return { ...c, pedidos: c.pedidos.map((x) => (x && ids.has(x.id) && !x.pago ? { ...x, vencimento: novo } : x)) };
  });
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

// Pedido pago no cartão em várias vezes: a loja parcela a NOTA, não o item.
// Cada item dividido sozinho arredonda os próprios centavos, e a fatura de
// uma compra de 30,00 em 3x (três itens de 10,00) saía 9,99 / 9,99 / 10,02.
// O total das contas `ids` se divide uma vez (a conta de parcelasDoCartao:
// parcelas iguais, a última leva o resto) e a diferença de centavos fica num
// item só — o maior —, que acerta a própria última parcela para continuar
// somando o valor dele. Só mexe quando todas têm o mesmo cartão e as mesmas
// faturas; senão devolve a lista como veio.
function acertarParcelasDoCartaoNoPedido(contas, ids) {
  const lista = (contas || []).slice();
  const alvo = new Set(ids || []);
  const red = (x) => Math.round(x * 100) / 100;
  const idx = [];
  lista.forEach((c, i) => {
    if (c && alvo.has(c.id) && c.cartaoId && Array.isArray(c.parcelasCartao) && c.parcelasCartao.length > 1) idx.push(i);
  });
  if (idx.length < 2) return lista;
  const primeira = lista[idx[0]];
  const n = primeira.parcelasCartao.length;
  const faturas = primeira.parcelasCartao.map((p) => p && p.competencia).join(",");
  if (idx.some((i) => lista[i].cartaoId !== primeira.cartaoId || lista[i].parcelasCartao.length !== n
    || lista[i].parcelasCartao.map((p) => p && p.competencia).join(",") !== faturas)) return lista;
  const somaDe = (c) => red(c.parcelasCartao.reduce((t, p) => t + (Number(p && p.valor) || 0), 0));
  const total = red(idx.reduce((t, i) => t + somaDe(lista[i]), 0));
  const base = red(total / n);
  const maior = idx.reduce((a, i) => (somaDe(lista[i]) > somaDe(lista[a]) ? i : a), idx[0]);
  const parcelas = lista[maior].parcelasCartao.map((p) => ({ ...p }));
  let desvio = 0;
  for (let k = 0; k < n - 1; k++) {
    const soma = red(idx.reduce((t, i) => t + (Number(lista[i].parcelasCartao[k].valor) || 0), 0));
    const d = red(base - soma);
    if (!d) continue;
    parcelas[k].valor = red(Number(parcelas[k].valor) + d);
    desvio = red(desvio + d);
  }
  if (!desvio) return lista;
  parcelas[n - 1].valor = red(Number(parcelas[n - 1].valor) - desvio);
  if (parcelas.some((p) => !(Number(p.valor) > 0))) return lista;
  lista[maior] = { ...lista[maior], parcelasCartao: parcelas };
  return lista;
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
  return cpLigar({
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
  });
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
  // a parcela retida até o aceite diz isso já no título (não só no detalhe):
  // é a que não se paga no calendário normal
  if (c.retida && !/retida/i.test(partes.join(" "))) partes.push("retida até o aceite");
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
  // "retida até o aceite" já está no título (tituloCurtoConta)
  if (m) return c.retida ? m[1].replace(/,? ?retida até o aceite/, "") : m[1];
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
  entrega: "Entrega conferida (foto anexada)",
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
  // A marca de pagamento conjunto é de UM pagamento: conta paga de novo é
  // outro débito. Quem paga junto (vários pedidos de uma vez) põe a marca
  // nova depois desta baixa; quem paga sozinho não pode herdar a velha,
  // senão leva o número do papel e a linha do extrato do conjunto antigo.
  const { pagamentoConjunto, ...c } = conta || {};
  const d = dados || {};
  const agora = agoraIso || new Date().toISOString();
  const antes = c.comprovante || null;
  const depois = d.comprovante || null;
  let nova = {
    ...c,
    pago: true,
    pagoEm: d.pagoEm || "",
    valorPago: Math.round((Number(d.valorPago) || Number(c.valor) || 0) * 100) / 100,
    // o dia de quem está mexendo, no fuso dele: depois das 21h, o relógio
    // UTC já está no dia seguinte
    // (o carimbo vem em UTC: o dia é o local, não o corte da string)
    contabilizadoEm: agoraIso ? cpDiaLocal(agoraIso) : new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10),
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
  // A marca do pagamento conjunto também: ela é daquele débito. Mantida,
  // a conta paga de novo, sozinha, herdava o papel e a linha do extrato
  // do conjunto antigo.
  const { formaPagamento, cartaoId, parcelasCartao, pagamentoConjunto, ...c } = conta || {};
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
  return CONTAS_TRIBUTO.indexOf(conta.pai || conta.id) < 0;
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
function estimativaPorEtapaDoOrcamento(orcamento, insumos) {
  const linhas = ((orcamento || {}).itens) || [];
  const por = {};
  for (const i of linhas) {
    if (!i) continue;
    // a etapa do catálogo manda; sem ela, a da fórmula
    const k = (typeof etapaDaLinhaDoOrcamento === "function" ? etapaDaLinhaDoOrcamento(i, insumos)
      : typeof etapaDoOrcamento === "function" ? etapaDoOrcamento(i.etapa, i.subEtapa) : "") || "";
    const v = Number(i.total);
    const valor = Number.isFinite(v) && v !== 0
      ? v
      : (Number(i.qtd) || 0) * (Number(i.preco) || 0);
    por[k] = Math.round(((por[k] || 0) + valor) * 100) / 100;
  }
  return por;
}

// No Planejamento por etapa, os ofícios (Empreiteiro, Pintor, Eletricista…)
// não são etapa da obra: são todos "Prestadores de serviços". A conta
// guarda o ofício (é ele que casa o orçado com o pago), e o quadro soma
// tudo na etapa de prestadores.
function etapaDoPlanejamento(id) {
  const lista = typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : [];
  const e = id ? lista.find((x) => x && x.id === id) : null;
  return e && e.macro === "Prestadores de serviços" ? "prestadores" : (id || "");
}
function plPorEtapa(itens, contasPagar, opcoes) {
  const est = {}, real = {}, contasDe = {};
  const orc0 = estimativaPorEtapaDoOrcamento((opcoes || {}).orcamento, (opcoes || {}).insumos);
  const orc = {};
  for (const k of Object.keys(orc0)) { const kk = etapaDoPlanejamento(k); orc[kk] = Math.round(((orc[kk] || 0) + (Number(orc0[k]) || 0)) * 100) / 100; }
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
    const k = etapaDoPlanejamento(i.etapaId || "");
    est[k] = Math.round(((est[k] || 0) + (Number(i.valor) || 0)) * 100) / 100;
  }
  for (const c of contasPagar || []) {
    if (!contaNoRealizado(c)) continue;
    if (fora(c.contaId)) continue;
    const k = etapaDoPlanejamento(c.etapa || c.etapaId || "");
    const v = valorNoRealizado(c);
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
    if (!contaNoRealizado(c) || !c.insumoCodigo) continue;
    const r = pegar(c.insumoCodigo);
    r.realizado = red(r.realizado + valorNoRealizado(c));
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

// ══════════════════════════════════════════════════════════════
// ORÇADO × REALIZADO, ITEM A ITEM — macro-etapa → etapa → item
// ══════════════════════════════════════════════════════════════
// O mesmo quadro de quem orça e de quem paga: cada linha é UM item numa
// etapa — o tijolo do Térreo e o tijolo do Pav 1 são duas linhas, porque o
// catálogo diz que tijolo é por pavimento e a fórmula diz qual.
//   - a etapa do orçado é a do catálogo (ou a da fórmula, para o insumo
//     sem etapa); a do realizado é a gravada na conta;
//   - material casa pelo código do insumo, na etapa;
//   - mão de obra casa pela CONTA (empreiteiro com empreiteiro), em
//     qualquer etapa: o orçamento tem cinco linhas de pedreiro (casa, muro,
//     arrimo, piscina, pavimentação) e o pagamento é um só, ao empreiteiro;
//   - conta paga sem item (frete, aluguel, caçamba avulsa) aparece como a
//     própria conta, na etapa dela — some do confronto em quantidade, mas
//     não do dinheiro.
// Quantidade comprada em outra unidade (metro de cano, quilo de prego) é
// convertida para a do catálogo quando o fator é conhecido.
// `opcoes.porEtapa === false` junta o item de todas as etapas numa linha.
function orcadoXRealizadoPorItem(obra, insumos, opcoes) {
  const o = obra || {};
  const op = opcoes || {};
  const porEtapa = op.porEtapa !== false;
  const linhasOrc = ((o.orcamento || {}).itens) || [];
  const contas = (o.contasPagar || []).filter(Boolean);
  const lista = insumos || [];
  const red = (x) => Math.round(x * 100) / 100;
  const redQ = (x) => Math.round(x * 1000) / 1000;
  const plano = typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : [];
  const etapas = typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : [];
  const contaDe = (id) => plano.find((c) => c && c.id === id) || null;
  const ehMaoDeObra = (contaId) => { const c = contaDe(contaId); return !!c && c.grupo === "maoDeObra"; };
  const fora = (contaId) => {
    const c = contaDe(contaId);
    // receita, terreno e reembolso não são custo de construir
    return !!c && ["receitas", "terreno", "excluidas"].indexOf(c.grupo) >= 0;
  };
  const insDe = (codigo) => (codigo ? lista.find((x) => x && (x.codigo === codigo || x.id === codigo)) || null : null);
  const valorDaLinha = (l) => {
    const v = Number(l.total);
    return Number.isFinite(v) && v !== 0 ? v : (Number(l.qtd) || 0) * (Number(l.preco) || 0);
  };
  const linhas = {};
  const pegar = (chave, etapaId, base) => {
    // mão de obra e conta sem item já vêm com a chave pronta; material leva a etapa
    const k = chave.indexOf("conta:") === 0 || !porEtapa ? chave : chave + "@" + etapaId;
    if (!linhas[k]) {
      linhas[k] = { chave: k, etapaId: etapaId || "", insumoCodigo: "", contaId: "", nome: "", unidade: "", grupo: "",
        qtdOrcada: 0, orcado: 0, qtdRealizada: 0, realizado: 0, aPagar: 0, aVencer: 0, notas: 0, linhasOrcamento: 0, ...base };
    }
    return linhas[k];
  };

  for (const l of linhasOrc) {
    if (!l) continue;
    const ins = typeof insumoDaLinhaDoOrcamento === "function" ? insumoDaLinhaDoOrcamento(l, lista) : insDe(l.insumoCodigo);
    const etapaId = (typeof etapaDaLinhaDoOrcamento === "function" ? etapaDaLinhaDoOrcamento(l, lista)
      : (typeof etapaDoOrcamento === "function" ? etapaDoOrcamento(l.etapa, l.subEtapa) : "")) || "";
    const contaMO = ins && ins.contaPadrao && ehMaoDeObra(ins.contaPadrao) ? ins.contaPadrao : "";
    let r;
    if (contaMO) {
      const c = contaDe(contaMO);
      r = pegar("conta:" + contaMO, etapaId, { contaId: contaMO, nome: c ? c.nome : contaMO, grupo: (ins && ins.grupo) || "" });
    } else if (ins) {
      r = pegar("ins:" + (ins.codigo || ins.id), etapaId, { insumoCodigo: ins.codigo || ins.id, nome: ins.nome || l.item || "",
        unidade: ins.unidade || l.unidade || "", grupo: typeof grupoDoItem === "function" ? grupoDoItem(ins, l.grupoMaterial) : (ins.grupo || "") });
    } else {
      const n = String(l.item || "").trim();
      r = pegar("linha:" + n.toLowerCase(), etapaId, { nome: n, unidade: l.unidade || "", grupo: l.grupoMaterial || "" });
    }
    r.orcado = red(r.orcado + valorDaLinha(l));
    if (!contaMO) r.qtdOrcada = redQ(r.qtdOrcada + (Number(l.qtd) || 0));
    r.linhasOrcamento++;
  }

  for (const c of contas) {
    if (fora(c.contaId)) continue;
    const ins = insDe(c.insumoCodigo);
    const etapaId = c.etapa || c.etapaId || "";
    const contaMO = ehMaoDeObra(c.contaId) ? c.contaId
      : (ins && ins.contaPadrao && ehMaoDeObra(ins.contaPadrao) ? ins.contaPadrao : "");
    let r;
    if (contaMO) {
      const cc = contaDe(contaMO);
      r = pegar("conta:" + contaMO, etapaId, { contaId: contaMO, nome: cc ? cc.nome : contaMO, grupo: "Prestadores de serviços" });
    } else if (ins) {
      r = pegar("ins:" + (ins.codigo || ins.id), etapaId, { insumoCodigo: ins.codigo || ins.id, nome: ins.nome || "",
        unidade: ins.unidade || c.unidade || "", grupo: typeof grupoDoItem === "function" ? grupoDoItem(ins, c.grupoMaterial) : (ins.grupo || "") });
    } else {
      const cc = contaDe(c.contaId);
      r = pegar("conta:" + (c.contaId || "?") + (porEtapa ? "@" + etapaId : ""), etapaId, { contaId: c.contaId || "",
        nome: (cc ? cc.nome : (c.descricao || "Sem conta")) + " (sem item)", grupo: c.grupoMaterial || "" });
    }
    const valor = valorNoRealizado(c);
    if (contaNoRealizado(c)) {
      r.realizado = red(r.realizado + valor);
      // compra a prazo: já está no realizado, ainda não saiu do caixa
      if (!c.pago && !(c.parcelaCartao && c.parcelaCartao.grupo)) r.aVencer = red(r.aVencer + valor);
      r.notas++;
      if (!contaMO) {
        let q = Number(c.quantidade) || 0;
        if (q && ins && c.unidade && typeof mesmaUnidade === "function" && mesmaUnidade(c.unidade, ins.unidade) === false
          && typeof fatorEntreUnidades === "function") {
          const f = fatorEntreUnidades(ins, c.unidade);
          if (f && f.fator > 0) q = q / f.fator;
        }
        r.qtdRealizada = redQ(r.qtdRealizada + q);
      }
    } else {
      r.aPagar = red(r.aPagar + valor);
    }
  }

  // mão de obra: a linha fica na etapa do orçado; sem orçado, na do pago
  const ordemEtapa = (id) => { const i = etapas.findIndex((e) => e.id === id); return i < 0 ? 990 : i; };
  const etapaInfo = (id) => {
    const e = etapas.find((x) => x.id === id);
    return e ? { nome: e.nome, macro: e.macro || e.nome, pavimento: e.pavimento || null }
      : { nome: id ? id : "Sem etapa", macro: id ? id : "Sem etapa", pavimento: null };
  };
  const itens = Object.keys(linhas).map((k) => {
    const r = linhas[k];
    return { ...r,
      saldo: red(r.orcado - r.realizado),
      saldoQtd: redQ(r.qtdOrcada - r.qtdRealizada),
      pct: r.orcado > 0 ? Math.round((r.realizado / r.orcado) * 1000) / 10 : null };
  });

  const macros = [];
  const porMacro = {};
  const porEtapaDe = {};
  for (const it of itens) {
    const id = porEtapa ? it.etapaId : "";
    const info = porEtapa ? etapaInfo(id) : { nome: "Todas as etapas", macro: "Todas as etapas", pavimento: null };
    if (!porMacro[info.macro]) {
      porMacro[info.macro] = { macro: info.macro, ordem: porEtapa ? ordemEtapa(id) : 0, orcado: 0, realizado: 0, aPagar: 0, etapas: [] };
      macros.push(porMacro[info.macro]);
    }
    const m = porMacro[info.macro];
    m.ordem = Math.min(m.ordem, porEtapa ? ordemEtapa(id) : 0);
    const ke = info.macro + "|" + id;
    if (!porEtapaDe[ke]) {
      porEtapaDe[ke] = { etapaId: id, nome: info.nome, pavimento: info.pavimento, ordem: porEtapa ? ordemEtapa(id) : 0,
        orcado: 0, realizado: 0, aPagar: 0, itens: [] };
      m.etapas.push(porEtapaDe[ke]);
    }
    const e = porEtapaDe[ke];
    e.itens.push(it);
    e.orcado = red(e.orcado + it.orcado); e.realizado = red(e.realizado + it.realizado); e.aPagar = red(e.aPagar + it.aPagar);
    m.orcado = red(m.orcado + it.orcado); m.realizado = red(m.realizado + it.realizado); m.aPagar = red(m.aPagar + it.aPagar);
  }
  macros.sort((a, b) => a.ordem - b.ordem);
  for (const m of macros) {
    m.saldo = red(m.orcado - m.realizado);
    m.etapas.sort((a, b) => a.ordem - b.ordem);
    for (const e of m.etapas) {
      e.saldo = red(e.orcado - e.realizado);
      e.itens.sort((a, b) => (b.orcado || b.realizado) - (a.orcado || a.realizado));
    }
  }
  const soma = (campo) => red(itens.reduce((s, x) => s + (Number(x[campo]) || 0), 0));
  return { macros, itens,
    totais: { orcado: soma("orcado"), realizado: soma("realizado"), aPagar: soma("aPagar"),
      saldo: red(soma("orcado") - soma("realizado")) },
    temOrcamento: linhasOrc.length > 0 };
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

  const semEtapaOrc = typeof etapasDoOrcamentoSemMapa === "function" ? etapasDoOrcamentoSemMapa(linhas, insumos) : [];
  if (semEtapaOrc.length) furos.push(furo("Orçamento com etapa que a obra não conhece",
    "A etapa destas linhas não tem correspondente: " + semEtapaOrc.map((x) => x.etapa).join(", ") + ".",
    semEtapaOrc.reduce((s, x) => s + x.linhas, 0), 0));

  const pagas = contas.filter((c) => contaNoRealizado(c));
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
    if (!contaNoRealizado(c) || c.contaId !== contaId) continue;
    const k = chaveReal(c);
    real[k] = Math.round(((real[k] || 0) + valorNoRealizado(c)) * 100) / 100;
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
function numerarPedidosAntigos(obra, obras, lancamentos) {
  const cots = (obra && obra.cotacoes) || [];
  const faltando = cots.filter((c) => c && c.contaGeradaId && !c.numeroPedido);
  if (!faltando.length) return null;
  // a série é a mesma dos lançamentos do escritório: sem eles, o número podia
  // repetir o de um lançamento já feito lá
  let n = parseInt(String(proximoNumeroDoc(obras, lancamentos)).replace(/\D/g, ""), 10);
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
// Que contas são UMA transação para o número do papel. A mesma nota (mesma
// referência e mesmo pedido) paga no mesmo dia é uma; as parcelas de uma
// compra a prazo, pagas em meses diferentes, são transações diferentes
// (cada boleto tem o seu comprovante e a sua linha no banco). Pagamentos
// feitos juntos, num débito só (vários pedidos da loja de uma vez), levam
// a marca `pagamentoConjunto` e ficam com um número só.
function cpChaveDoPapel(c) {
  const x = c || {};
  if (x.pagamentoConjunto) return "pg:" + x.pagamentoConjunto;
  const dia = String(x.pagoEm || "").slice(0, 10);
  return String(x.numeroDoc || "") + "|" + String(x.pedidoId || (x.numeroDoc ? "" : x.id)) + "|" + dia;
}
function numerarPapeisDasPagas(contas, proximo, elegivel, numeros) {
  const lista = (contas || []).slice();
  let n = Number(proximo) || 1;
  const pode = typeof elegivel === "function" ? elegivel : () => true;
  const chave = cpChaveDoPapel;
  const grupos = {};
  lista.forEach((c, i) => { if (c && c.pago) (grupos[chave(c)] = grupos[chave(c)] || []).push(i); });
  // Que transações já usam cada número. Uma conta desfeita guarda o número
  // (e o papel) de quando foi paga; paga de novo em outro dia ou junto com
  // outras, vira outra transação — e levaria o mesmo número de outra que
  // continua paga. Aí ela ganha número novo.
  const gruposDoNumero = {};
  for (const k of Object.keys(grupos)) for (const i of grupos[k]) {
    const d = String(lista[i].doc || "").trim();
    if (d) (gruposDoNumero[d] = gruposDoNumero[d] || new Set()).add(k);
  }
  for (const k of Object.keys(grupos)) {
    const idx = grupos[k];
    if (!idx.some((i) => pode(lista[i]))) continue;
    const comDoc = idx.map((i) => lista[i]).find((c) => String(c.doc || "").trim());
    let numero = comDoc ? String(comDoc.doc).trim() : "";
    // o número é de outra transação que segue paga (e esta não é a dona
    // dele: a dona é a que não acabou de mudar) → número novo
    const doOutro = numero && gruposDoNumero[numero] && [...gruposDoNumero[numero]].some((g) => g !== k
      && !grupos[g].some((i) => pode(lista[i])));
    if (doOutro) {
      numero = (numeros && numeros[k]) ? String(numeros[k]) : String(n++);
      for (const i of idx) if (String(lista[i].doc || "").trim()) lista[i] = { ...lista[i], doc: "" };
    }
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
  // o nome da planilha que é o mesmo item do catálogo (confirmado por quem usa)
  apelidos: [{ codigo: "HID-237", apelido: "PVC -  Alimentação - Engate Flexível 40cm" }],
};

// O código do item novo: o prefixo que o grupo já usa no catálogo e o
// próximo número dele (IMP-013 depois do IMP-012).
function cpCodigoNovo(grupo, lista) {
  if (typeof codigoDoGrupo === "function") {
    const c = codigoDoGrupo(grupo, lista, typeof proximoCodigoInsumo === "function" ? proximoCodigoInsumo : null);
    if (c) return c;
  }
  const g = cpSemAcento(grupo);
  const conta = {}, maior = {};
  for (const i of lista || []) {
    const m = /^([A-Z]{3})-(\d{3,})$/.exec((i && i.codigo) || "");
    if (!m) continue;
    maior[m[1]] = Math.max(maior[m[1]] || 0, Number(m[2]));
    if (cpSemAcento(i.grupo) === g) conta[m[1]] = (conta[m[1]] || 0) + 1;
  }
  const pre = Object.keys(conta).sort((a, b) => conta[b] - conta[a])[0] || "NOV";
  return pre + "-" + String((maior[pre] || 0) + 1).padStart(3, "0");
}

// O grupo do item novo: o da planilha, se o catálogo usa esse nome; senão o
// do item mais parecido do catálogo ("Tê 40mm" fica junto dos outros Tês).
function cpGrupoDoNovo(nome, grupoPlanilha, grupoConta, lista) {
  const grupos = new Set((lista || []).map((m) => cpSemAcento((m && m.grupo) || "")).filter(Boolean));
  const deVerdade = (g) => {
    const k = cpSemAcento(g || "");
    if (!k || !grupos.has(k)) return "";
    return ((lista || []).find((m) => m && cpSemAcento(m.grupo || "") === k) || {}).grupo || g;
  };
  if (deVerdade(grupoPlanilha)) return deVerdade(grupoPlanilha);
  const toks = (t) => cpSemAcento(t).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  const alvo = toks(nome);
  let melhor = null, nota = 0;
  for (const m of lista || []) {
    if (!m || !m.grupo || cpSemAcento(m.grupo) === "outros") continue;
    const tm = toks(m.nome);
    const n = alvo.filter((w) => tm.indexOf(w) >= 0).length / Math.max(alvo.length, tm.length, 1);
    if (n > nota) { nota = n; melhor = m; }
  }
  if (melhor && nota >= 0.2) return melhor.grupo;
  return deVerdade(grupoConta) || String(grupoPlanilha || grupoConta || "Outros").trim();
}
// A planilha de controle da obra (a "Base de dados" do Excel): cada linha é
// um item, com o papel em "Nota / Comprovante", o valor do item em "Valor"
// e o insumo do catálogo em "Itens da nota fiscal". A importação antiga
// trouxe só a descrição — é daqui que o item volta para o catálogo.
function linhasDaPlanilhaDaObra(tabela) {
  const linhas = (tabela || []).map((l) => (l || []).map((c) => String(c == null ? "" : c).trim()));
  const k = (t) => cpSemAcento(t).replace(/\s+/g, " ").trim();
  const iCab = linhas.slice(0, 20).findIndex((l) => l.some((c) => k(c) === "itens da nota fiscal"));
  if (iCab < 0) return [];
  const cab = linhas[iCab].map(k);
  const col = (...nomes) => { for (const n of nomes) { const i = cab.indexOf(n); if (i >= 0) return i; } return -1; };
  const iNota = col("nota / comprovante", "nota/comprovante", "nota");
  const iItem = col("itens da nota fiscal");
  const iValor = col("valor", "valor total nota");
  const iQtd = col("quantidade");
  const iUn = col("unidade");
  const iGrupo = col("grupo materiais", "grupo");
  if (iNota < 0 || iItem < 0 || iValor < 0) return [];
  const num = (t) => {
    let x = String(t || "").replace(/\s|R\$/g, "");
    if (/,\d{1,2}$/.test(x)) x = x.replace(/\./g, "").replace(",", ".");
    const n = Number(x); return Number.isFinite(n) ? n : 0;
  };
  const saida = [];
  for (const l of linhas.slice(iCab + 1)) {
    const nota = String(l[iNota] || "").replace(/\.0+$/, "").trim();
    const item = String(l[iItem] || "").trim();
    if (!nota || !item) continue;
    saida.push({ nota, item, valor: Math.round(num(l[iValor]) * 100) / 100,
      quantidade: iQtd >= 0 ? num(l[iQtd]) : 0, unidade: iUn >= 0 ? String(l[iUn] || "").trim() : "",
      grupo: iGrupo >= 0 ? String(l[iGrupo] || "").trim() : "" });
  }
  return saida;
}

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
  // Aberto de dentro de uma obra, mexe só nela (o catálogo fica com a base
  // do escritório).
  const so = o.obraId || "";
  const daVez = (ob) => !so || ob.id === so;
  const lancs = d.lancamentos || [];
  const materiais = (d.materiais || []).filter(Boolean);
  const ativos = materiais.filter((m) => m.ativo !== false);
  const grupos = { papel: [], escritorio: [], novos: [], planilha: [], outros: [], catalogo: [], unidade: [], ajuste: [], insumos: [] };
  const daPlanilha = Array.isArray(o.planilha) ? o.planilha : [];
  // Quem confere pode deixar um grupo de fora: só os marcados são aplicados.
  const quer = (g) => !Array.isArray(o.grupos) || o.grupos.indexOf(g) >= 0;
  const nomeObra = (ob) => ob.nome || ob.id;
  const reg = (c, det) => (typeof registrarAto === "function" ? registrarAto(c, "editada", quem, agora, det) : c);

  // 1. números do papel, na ordem do pagamento
  const chave = cpChaveDoPapel;
  const pend = [];
  for (const ob of (quer("papel") ? obras.filter(daVez) : [])) {
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

  // 0. o catálogo aprende com a planilha da obra: o apelido combinado e o
  // item que a planilha usa e o catálogo ainda não tem. Vem antes de ligar,
  // para as contas desses itens já saírem ligadas.
  let materiaisBase = materiais.slice();
  if (quer("novos") && daPlanilha.length) {
    for (const a of ajustes.apelidos || []) {
      const i = materiaisBase.findIndex((m) => m && m.codigo === a.codigo);
      const kk = cpChaveDoNome(a.apelido);
      if (i < 0 || !kk || !daPlanilha.some((r) => cpChaveDoNome(r.item) === kk)) continue;
      const m = materiaisBase[i];
      if (cpChaveDoNome(m.nome) === kk || (m.aliases || []).some((x) => cpChaveDoNome(x) === kk)) continue;
      const novo = { ...m, aliases: (m.aliases || []).concat([String(a.apelido).trim()]) };
      materiaisBase[i] = novo;
      porNome.set(kk, novo);
      grupos.novos.push({ texto: `${m.codigo} ${m.nome} ganha o apelido “${String(a.apelido).trim()}”` });
    }
    const faltam = new Map();
    for (const ob of obras.filter(daVez)) for (const c of ob.contasPagar || []) {
      if (!c || c.insumoCodigo || c.contratoId || !String(c.doc || "").trim()) continue;
      const v = Math.round((Number(c.valor) || 0) * 100) / 100;
      const rs = daPlanilha.filter((r) => r.nota === String(c.doc).trim() && Math.abs(r.valor - v) <= 0.02);
      const nomes = [...new Set(rs.map((r) => cpChaveDoNome(r.item)))];
      if (nomes.length !== 1 || !nomes[0] || nomes[0] === "outros" || porNome.has(nomes[0])) continue;
      const f = faltam.get(nomes[0]) || { nome: String(rs[0].item).trim().replace(/\s+$/, ""), grupoPlanilha: rs[0].grupo || "",
        grupoConta: c.grupoMaterial || "", unidade: rs[0].unidade || c.unidade || "Unidades", etapa: c.etapa || "", conta: c.contaId || "", n: 0 };
      f.n++;
      faltam.set(nomes[0], f);
    }
    for (const [kk, f] of faltam) {
      const grupo = cpGrupoDoNovo(f.nome, f.grupoPlanilha, f.grupoConta, materiaisBase);
      const codigo = cpCodigoNovo(grupo, materiaisBase);
      const unidade = grafia[String(f.unidade).toLowerCase()] || f.unidade;
      const novo = { id: typeof uid === "function" ? uid() : "ins_" + codigo, codigo, nome: f.nome, grupo, unidade, tipo: "material",
        etapaPadrao: f.etapa || "", contaPadrao: f.conta || "", ativo: true, aliases: [f.nome],
        precoManual: null, precoFonte: null, precoNCompras: 0, precoFatorInccAplicado: 1, observacao: "", precoAtualizadoEm: agora };
      materiaisBase.push(novo);
      porNome.set(kk, novo);
      grupos.novos.push({ texto: `${codigo} · ${f.nome} · ${grupo} · ${unidade} — ${f.n} ${f.n === 1 ? "conta" : "contas"}` });
    }
  }

  const obrasNovas = obras.map((ob) => {
    if (!daVez(ob)) return ob;
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
      for (const a of (quer("ajuste") ? ajustes.contas || [] : [])) {
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
      // 2a. o item que a planilha da obra diz, pelo papel e pelo valor: só
      // quando a planilha aponta UM item do catálogo para esta conta.
      if (quer("planilha") && !x.insumoCodigo && !x.contratoId && daPlanilha.length && String(x.doc || "").trim()) {
        const valor = Math.round((Number(x.valor) || 0) * 100) / 100;
        const doPapel = daPlanilha.filter((r) => r.nota === String(x.doc).trim());
        // Papel E valor: o número sozinho não basta — a mesma numeração pode
        // ter sido usada para coisas diferentes no VICKE e na planilha.
        const mesmas = doPapel.filter((r) => Math.abs(r.valor - valor) <= 0.02);
        const itens = [...new Set(mesmas.map((r) => cpChaveDoNome(r.item)))];
        const m0 = itens.length === 1 ? porNome.get(itens[0]) : null;
        // "Outros" (pedágio, taxa, gasolina) também tem item no catálogo, mas
        // ligar a ele não diz nada novo: vai num grupo à parte.
        const ehOutros = !!m0 && cpChaveDoNome(m0.grupo) === "outros";
        const m = m0 && (!ehOutros || quer("outros")) ? m0 : null;
        if (m) {
          const linha = mesmas[0];
          const muda = { insumoCodigo: m.codigo };
          if (!x.grupoMaterial || x.grupoMaterial === "Outros") muda.grupoMaterial = m.grupo || x.grupoMaterial || "";
          if (!(Number(x.quantidade) > 0) && linha.quantidade > 0) muda.quantidade = linha.quantidade;
          if (!String(x.unidade || "").trim() && (linha.unidade || m.unidade)) muda.unidade = linha.unidade || m.unidade;
          x = reg({ ...x, ...muda }, "item da planilha: " + m.codigo + " " + m.nome);
          grupos[ehOutros ? "outros" : "planilha"].push({ obraId: ob.id, texto: `${nomeObra(ob)} · papel ${x.doc} · ${x.descricao || ""} · ${valor.toFixed(2).replace(".", ",")} → ${m.codigo} ${m.nome}` });
        }
      }
      // 2. ligar ao catálogo pelo nome
      if (quer("catalogo") && !x.insumoCodigo && !x.contratoId) {
        const m = porNome.get(cpChaveDoNome(x.descricao));
        if (m) {
          x = reg({ ...x, insumoCodigo: m.codigo }, "ligado ao catálogo " + m.codigo);
          grupos.catalogo.push({ obraId: ob.id, texto: `${nomeObra(ob)} · Ref ${x.numeroDoc || "—"} · ${x.descricao} → ${m.codigo}` });
        }
      }
      // 3. unidade com a grafia do catálogo
      const u = String(x.unidade || "").trim();
      if (quer("unidade") && u && grafia[u.toLowerCase()] && grafia[u.toLowerCase()] !== u) {
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
  const materiaisNovos = materiaisBase.map((m) => {
    const a = (ajustes.catalogo || []).find((x) => x.codigo === m.codigo);
    if (so || !quer("insumos") || !a || m.nome !== a.de) return m;
    grupos.insumos.push({ texto: `${m.codigo} · ${a.de} → ${a.para} (o nome antigo fica como apelido)` });
    return { ...m, nome: a.para, aliases: [...new Set((m.aliases || []).concat([a.de]))] };
  });

  const total = Object.values(grupos).reduce((t, g) => t + g.length, 0);
  return { dados: { ...d, obras: obrasNovas, lancamentos: lancsNovos, materiais: materiaisNovos }, grupos, total };
}

// O lançamento do escritório que representa esta conta (a ponte grava a
// origem: a conta, o pedido inteiro ou o papel da planilha antiga).
function cpLancamentoDaConta(lancamentos, obraId, c) {
  // A regra de quem liga a quem é uma só, a do escritório: a parcela
  // estornada leva "#n" no refId e o pagamento conjunto leva "pg:" — a
  // comparação feita aqui à parte não via nenhum dos dois.
  if (typeof ligaContaAoLancamento === "function") {
    return (lancamentos || []).find((l) => l && ligaContaAoLancamento(l, obraId, c)) || null;
  }
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
      // carimbos com hora (UTC): o dia é o local — depois das 21h o corte
      // da string já dá amanhã
      const primeiro = regs.map((r) => cpDiaLocal(r.em)).sort()[0] || "";
      // Pedido na conta da loja: a data é a do PEDIDO. A conta da loja é uma
      // cotação só, e o `lancadoEm` dela anda a cada pedido novo — usá-lo
      // punha todos os pedidos antigos com a data do último lançado.
      const ped = c.pedidoId && cot ? (cot.pedidos || []).find((p) => p && p.id === c.pedidoId) : null;
      const entradaEm = cpDiaLocal((criada && criada.em) || c.importadoEm || c.lancadoEm
        || (ped && (ped.lancadoEm || ped.data))
        || (cot && !cot.contaLoja && cot.lancadoEm)
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

// A base do escritório é o extrato do escritório: uma linha por
// transação — todo lançamento que entrou lá, do próprio escritório ou vindo
// de uma obra pela ponte. O item a item das notas fica na base da obra.
// Obra cujo cliente paga direto (Reforma Loja Cobop) não passa pelo extrato
// e não aparece. É também aqui que se lança, edita e exclui (a tela
// "Lançamentos" virou esta).
// O dia (aaaa-mm-dd) de um carimbo ISO no fuso local: 21h de Ourinhos já é
// o dia seguinte em UTC, e cortar a string jogaria o lançamento para amanhã.
function cpDiaLocal(iso) {
  const t = String(iso || "");
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  if (isNaN(d)) return t.slice(0, 10);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// O lançamento importado não tem carimbo de entrada, mas o id tem: a
// importação gera "imp_<instante em base 36>_<linha>". É o dia em que ele
// entrou no VICKE — o mesmo que a base da obra mostra para a conta irmã.
function cpDiaDoIdImportado(id) {
  const m = /^imp_([0-9a-z]{7,9})_/.exec(String(id || ""));
  if (!m) return "";
  const ms = parseInt(m[1], 36);
  if (!(ms > Date.UTC(2020, 0, 1) && ms < Date.UTC(2100, 0, 1))) return "";
  return cpDiaLocal(new Date(ms).toISOString());
}
// Quando o lançamento entrou no VICKE: carimbado ao gravar; importado, pelo
// carimbo da importação. A data do movimento no banco NÃO é isso.
function cpEntradaDoLancamento(l) {
  const x = l || {};
  return cpDiaLocal(x.criadoEm) || cpDiaLocal(x.importadoEm) || cpDiaDoIdImportado(x.id);
}

function linhasDoEscritorio(obras, lancamentos, opcoes) {
  const o = opcoes || {};
  const porId = new Map((obras || []).filter(Boolean).map((ob) => [ob.id, ob]));
  const titulo = (t) => { const x = String(t || "").toLowerCase(); return x ? x.charAt(0).toUpperCase() + x.slice(1) : ""; };
  const saida = [];
  for (const l of lancamentos || []) {
    if (!l || (l.tipo && l.tipo !== "escritorio")) continue;
    const conta = (typeof o.contaDoEscritorio === "function" && o.contaDoEscritorio(l.contaId)) || null;
    const grupo = conta && typeof o.grupoDoEscritorio === "function" ? o.grupoDoEscritorio(conta.grupo) : null;
    // entrada ou saída no extrato: o grupo da conta diz; sem conta, o sinal do valor.
    // O estorno (valor negativo) vai no sentido contrário do grupo: a
    // receita devolvida é dinheiro que SAIU.
    const estorno = Number(l.valor) < 0;
    const sinal = grupo && grupo.sinal ? (grupo.sinal < 0 ? -1 : 1) * (estorno ? -1 : 1) : (estorno ? -1 : 1);
    const valor = Math.round(Math.abs(Number(l.valor) || 0) * 100) / 100;
    const dia = String(l.lancadoEm || "").slice(0, 10);
    // Data do lançamento = o dia em que entrou no sistema (como na base da
    // obra), no fuso de quem olha. `lancadoEm` é o dia do movimento no
    // banco e não serve para isto; o importado da planilha antiga entrou no
    // dia da importação, que está no id.
    const entrou = cpEntradaDoLancamento(l) || dia;
    const ob = l.origem && l.origem.obraId ? porId.get(l.origem.obraId) : null;
    const nomeConta = (conta && conta.nome) || l.contaOriginal || l.contaId || "";
    const obraNome = l.projeto || (ob && ob.nome) || "";
    const obraId = (l.origem && l.origem.obraId) || l.obraId || l.empreendimentoId || (obraNome ? "p:" + cpSemAcento(obraNome) : "");
    const anexos = (Array.isArray(l.anexos) ? l.anexos : []).filter(Boolean).concat(l.comprovante ? [l.comprovante] : []);
    // por onde o dinheiro passou: Sicoob, Cora, o cartão (quem diz é o escritório)
    const meio = (typeof o.meioDoLancamento === "function" && o.meioDoLancamento(l)) || "";
    // Afeta o saldo? A transferência entre as suas contas não (as duas pontas
    // se anulam); a fatura do cartão inteira e a compra no cartão também não
    // (quem afeta são as compras da fatura, cada uma na linha dela). Somando
    // só o "Sim", o Excel dá o mesmo resultado do extrato, sem contar duas vezes.
    const afetaSaldo = l._afetaSaldo === false || !!(conta && conta.interna) ? "Não" : "Sim";
    const pseudo = { id: "lanc:" + l.id, numeroDoc: l.numeroDoc || "", descricao: l.descricao || "", favorecido: l.fornecedor || "",
      numeroNota: l.documento || "", valor, valorPago: valor, pago: true, pagoEm: dia, vencimento: dia, contaId: l.contaId || "",
      observacao: [nomeConta, l.cliente, obraNome, l.observacao, meio].filter(Boolean).join(" "), anexos };
    saida.push({
      id: pseudo.id, lancId: l.id, lanc_: l, obraId, obra: obraNome, cliente: l.cliente || "",
      unidadeNegocio: CP_UNIDADES_NEGOCIO[l.unidadeId] || l.unidadeOriginal || "",
      ref: l.numeroDoc || "", nota: String(l.documento || ""), arquivo: "",
      fornecedor: l.fornecedor || "", descricaoLanc: l.descricao || "", item: l.descricao || "",
      insumoCodigo: "", insumo: "", insumoNome: nomeConta || "Outros",
      quantidade: 1, unidade: "Unidades", unitario: valor, total: valor, valorNota: valor,
      grupo: titulo(grupo && grupo.titulo), etapaId: "", etapa: "",
      contaId: l.contaId || "", conta: nomeConta, meio, afetaSaldo,
      pago: true, pagoEm: dia, vencimento: dia, competencia: String(l.competencia || dia.slice(0, 7)).slice(0, 7),
      dataLanc: entrou, entradaEm: entrou, origem: "escritorio", papeis: anexos.length, conta_: pseudo, sinal,
      ...(estorno ? { estorno: true } : {}),
    });
  }
  // como era na tela de lançamentos: competência mais nova primeiro e, no
  // mês, o lançado por último na frente — quem acabou de lançar o vê no topo
  const quando = (r) => String((r.lanc_ && (r.lanc_.criadoEm || r.dataLanc || r.lanc_.lancadoEm)) || "");
  return saida.sort((a, b) => String(b.competencia).localeCompare(String(a.competencia)) || quando(b).localeCompare(quando(a)));
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
// A base do escritório: as colunas da planilha BASE DE DADOS ESCRITÓRIO —
// uma linha por transação.
const BASE_COLUNAS_ESCRITORIO = [
  ["ref", "Ref"], ["cliente", "Nome Cliente"], ["unidadeNegocio", "Unidade negócio"], ["obra", "Projeto / obra"],
  ["fornecedor", "Fornecedor"], ["descricaoLanc", "Descrição Lançamento"], ["conta", "Conta contábil"],
  ["nota", "Nota / Comprovante"], ["valorNota", "Valor total nota"],
  ["competencia", "Período Contábil"], ["dataLanc", "Data do lançamento"], ["meio", "Meio"], ["afetaSaldo", "Afeta saldo"],
];
// No Excel do escritório o estorno sai NEGATIVO (a receita de gestão
// devolvida abate a receita, a loja que devolveu abate a despesa): a tabela
// dinâmica por conta dá o mesmo número do extrato do VICKE. Na tela o valor
// continua sem sinal, com a cor dizendo entrada ou saída.
function linhasParaExportar(linhas) {
  return (linhas || []).map((l) => (l && l.estorno && l.origem === "escritorio"
    ? { ...l, valorNota: -Math.abs(Number(l.valorNota) || 0), total: -Math.abs(Number(l.total) || 0), unitario: -Math.abs(Number(l.unitario) || 0) }
    : l));
}
function tabelaDaBase(linhas, colunas) {
  const cols = colunas || BASE_COLUNAS;
  return [cols.map((c) => c[1])].concat((linhas || []).map((l) => cols.map(([k]) => {
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
  ["Ref", "numeroTexto", "0", "center"], ["Nome Cliente", "texto", "", "center"], ["Projeto / obra", "texto", "", "center"],
  ["Unidade negócio", "texto", "", "center"], ["Fornecedor", "texto", "", "center"], ["Descrição Lançamento", "texto", "", ""],
  ["Conta contábil", "texto", "", "center"], ["Nota / Comprovante", "numeroTexto", "0", "center"], ["Valor total nota", "moeda", CP_MOEDA_XL, ""],
  ["Período Contábil", "mes", "[$-416]mmm\\-yy;@", "center"], ["Data do lançamento", "data", "[$-416]d\\-mmm\\-yy;@", "center"],
  ["Nome Insumo (catálogo)", "texto", "", ""], ["Unidade", "texto", "", "center"],
  ["Quantidade", "numero", '_-* #,##0.00_-;\\-* #,##0.00_-;_-* "-"??_-;_-@_-', ""], ["Preço", "moeda", CP_MOEDA_XL, ""],
  ["Valor", "moeda", CP_MOEDA_XL, ""], ["Etapa", "texto", "", "center"], ["Grupo Materiais", "texto", "", "center"],
];
// O texto que o Excel mostra na célula, com os mesmos formatos do
// relatório — é o que a tela da base exibe, para as duas lerem igual.
const CP_MESES_XL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function textoDaCelula(valor, coluna) {
  const v = valor;
  if (v === "" || v == null) return "";
  const tipo = (coluna || {}).tipo || "texto";
  const br = (x, casas) => Number(x).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  const m = String(v).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (tipo === "moeda") return "R$ " + br(v, 2);
  if (tipo === "numero") return br(v, 2);
  if (tipo === "mes" && m) return CP_MESES_XL[+m[2] - 1] + "-" + m[1].slice(2);
  if (tipo === "data" && m) return (m[3] ? +m[3] : 1) + "-" + CP_MESES_XL[+m[2] - 1] + "-" + m[1].slice(2);
  if (tipo === "numeroTexto" && /^\d{1,9}$/.test(String(v).trim())) return String(Number(String(v).trim()));
  return String(v);
}
// número fica à direita, como no Excel, quando a coluna não diz outra coisa
function alinhamentoDaCelula(coluna) {
  const c = coluna || {};
  if (c.alinhar) return c.alinhar;
  return ["moeda", "numero"].indexOf(c.tipo) >= 0 ? "right" : "left";
}

// O filtro do título da coluna, como o do Excel: em cada coluna, os
// valores (como aparecem na tela) que ficam; e a ordem por uma coluna.
// Devolve os índices das linhas que passam, já na ordem.
function filtrarPorColunas(relat, filtros, ordem) {
  const r = relat || { colunas: [], linhas: [] };
  const cols = r.colunas || [];
  const j = (t) => cols.findIndex((c) => c.titulo === t);
  const ativos = Object.keys(filtros || {}).filter((t) => Array.isArray(filtros[t]) && j(t) >= 0);
  const idx = (r.linhas || []).map((_, i) => i).filter((i) => ativos.every((t) =>
    filtros[t].indexOf(textoDaCelula(r.linhas[i][j(t)], cols[j(t)])) >= 0));
  const k = ordem ? j(ordem.titulo) : -1;
  if (k >= 0) {
    const c = cols[k];
    const numerico = ["moeda", "numero", "numeroTexto"].indexOf(c.tipo) >= 0;
    const vazio = (v) => v === "" || v == null;
    idx.sort((a, b) => {
      const va = r.linhas[a][k], vb = r.linhas[b][k];
      if (vazio(va) || vazio(vb)) return vazio(va) === vazio(vb) ? a - b : (vazio(va) ? 1 : -1);
      const d = numerico && !isNaN(Number(va)) && !isNaN(Number(vb)) ? Number(va) - Number(vb)
        : String(va).localeCompare(String(vb), "pt-BR", { numeric: true, sensitivity: "base" });
      return d * (ordem.dir < 0 ? -1 : 1) || a - b;
    });
  }
  return idx;
}
// Os valores de uma coluna para a lista do filtro, com quantas linhas têm
// cada um — contando só as linhas que passam nos filtros das outras colunas.
function valoresDaColuna(relat, titulo, filtros) {
  const r = relat || { colunas: [], linhas: [] };
  const j = (r.colunas || []).findIndex((c) => c.titulo === titulo);
  if (j < 0) return [];
  const outros = { ...(filtros || {}) };
  delete outros[titulo];
  const conta = new Map();
  const ordemCrua = new Map();
  for (const i of filtrarPorColunas(r, outros, null)) {
    const v = r.linhas[i][j];
    const t = textoDaCelula(v, r.colunas[j]);
    conta.set(t, (conta.get(t) || 0) + 1);
    if (!ordemCrua.has(t)) ordemCrua.set(t, v);
  }
  const numerico = ["moeda", "numero", "numeroTexto"].indexOf(r.colunas[j].tipo) >= 0;
  return [...conta.entries()].map(([texto, n]) => ({ texto, n, cru: ordemCrua.get(texto) }))
    .sort((a, b) => (a.texto === "" ? 1 : b.texto === "" ? -1
      : numerico && !isNaN(Number(a.cru)) && !isNaN(Number(b.cru)) ? Number(a.cru) - Number(b.cru)
        : String(a.cru).localeCompare(String(b.cru), "pt-BR", { numeric: true, sensitivity: "base" })));
}

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
const BASE_RELATORIO_ESCRITORIO = [
  ["Ref", "numeroTexto", "0", "center"], ["Nome Cliente", "texto", "", "center"], ["Unidade negócio", "texto", "", "center"],
  ["Projeto / obra", "texto", "", "center"], ["Fornecedor", "texto", "", "center"], ["Descrição Lançamento", "texto", "", ""],
  ["Conta contábil", "texto", "", "center"], ["Nota / Comprovante", "numeroTexto", "0", "center"],
  ["Valor total nota", "moeda", CP_MOEDA_XL, ""], ["Período Contábil", "mes", "[$-416]mmm\\-yy;@", "center"],
  ["Data do lançamento", "data", "[$-416]d\\-mmm\\-yy;@", "center"], ["Meio", "texto", "", "center"],
  ["Afeta saldo", "texto", "", "center"],
];
function planilhaDaBase(tabela, especificacao) {
  const SPEC = especificacao || BASE_RELATORIO;
  const cab = (tabela || [])[0] || [];
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const br = (v, casas) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  const idx = SPEC.map(([t]) => cab.indexOf(t));
  const linhas = (tabela || []).slice(1).map((l) => idx.map((j) => (j >= 0 ? l[j] : "")));
  const colunas = SPEC.map(([titulo, tipo, formato, alinhar], k) => {
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
// Os papéis de uma conta, separados pelo que são. O comprovante da baixa
// pode estar no campo próprio (`comprovante`) ou já ter ido para a lista de
// anexos — é o que acontece quando um segundo papel entra depois. Nos dois
// casos ele é comprovante; nota é só o que veio marcado como nota.
function cpPapeisDaConta(c) {
  const x = c || {};
  const lista = (Array.isArray(x.anexos) ? x.anexos.filter(Boolean) : []);
  const todos = x.comprovante ? [x.comprovante].concat(lista) : lista;
  const vistos = new Set();
  const r = { comprovantes: [], notas: [], boletos: [], entregas: [] };
  for (const a of todos) {
    const k = (a && (a.public_id || a.url)) || "";
    if (!k || vistos.has(k)) continue;
    vistos.add(k);
    const t = a.tipo || "";
    if (t === "nota") r.notas.push(a);
    else if (t === "boleto") r.boletos.push(a);
    else if (t === "entrega") r.entregas.push(a);
    else if (t === "pedido" || t === "proposta") continue;
    else r.comprovantes.push(a);
  }
  return r;
}

const cpEhPdf = (a) => !!a && (a.formato === "pdf" || a.resourceType === "raw" || /\.pdf$/i.test(String(a.nome || "")));

function folhaDeComprovantes(contas, titulo) {
  const red = (x) => Math.round(x * 100) / 100;
  const pagas = (contas || []).filter((c) => c && c.pago);
  // Uma linha por PAGAMENTO, não por item: o pedido de seis itens pago com
  // um Pix só é um pagamento, com um comprovante — repeti-lo seis vezes
  // fazia a loja conferir o mesmo papel seis vezes.
  const grupos = new Map();
  for (const c of pagas) {
    const k = String(c.numeroDoc || c.pedidoId || c.id);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(c);
  }
  const nomeDoTitulo = String(titulo || "").trim().toLowerCase();
  const linhas = [...grupos.values()].map((cs) => {
    const c0 = cs[0];
    const vistos = new Set();
    const comprovantes = [], notas = [], boletos = [], entregas = [];
    for (const c of cs) {
      const p = cpPapeisDaConta(c);
      for (const a of p.comprovantes) { const k = a.public_id || a.url; if (!vistos.has(k)) { vistos.add(k); comprovantes.push(a); } }
      for (const a of p.notas) { const k = a.public_id || a.url; if (!vistos.has(k)) { vistos.add(k); notas.push(a); } }
      for (const a of p.boletos) { const k = a.public_id || a.url; if (!vistos.has(k)) { vistos.add(k); boletos.push(a); } }
      for (const a of p.entregas) { const k = a.public_id || a.url; if (!vistos.has(k)) { vistos.add(k); entregas.push(a); } }
    }
    const a = comprovantes[0] || null;
    const ehPdf = cpEhPdf(a);
    // A folha inteira já é de um fornecedor: repetir o nome dele no título e
    // no apoio de cada pagamento é dizer a mesma coisa três vezes.
    const apoioBruto = typeof apoioCurtoConta === "function" ? apoioCurtoConta(c0) : (c0.favorecido || "");
    const numeroDoPedido = String(c0.numeroLoja || c0.numeroPedido || "").trim();
    const tituloDoItem = String(c0.descricao || "").trim()
      || (typeof tituloConta === "function" ? tituloConta(c0) : "Pagamento");
    const titulo1 = cs.length > 1
      ? (numeroDoPedido ? `Pedido ${numeroDoPedido}` : tituloDoItem) + ` · ${cs.length} itens`
      : tituloDoItem;
    const pagoEm = cs.map((c) => c.pagoEm || "").filter(Boolean).sort()[0] || "";
    const rotular = (x, rotulo, tipoDoPapel) => ({ ...x, rotulo, tipoDoPapel, ehPdf: cpEhPdf(x) });
    return {
      id: c0.id,
      contaIds: cs.map((c) => c.id),
      titulo: titulo1,
      apoio: String(apoioBruto || "").trim().toLowerCase() === nomeDoTitulo ? "" : apoioBruto,
      pagoEm,
      valor: red(cs.reduce((t, c) => t + (Number(c.valorPago) || Number(c.valor) || 0), 0)),
      comprovante: a,
      comprovantes,
      notas,
      boletos,
      entregas,
      // todos os papéis da linha, na ordem em que a loja confere: o que pagou,
      // o que ela emitiu e o boleto que ela mandou cobrar. Quem exporta
      // escolhe quais tipos vão (ver PAPEIS_DA_FOLHA).
      papeis: comprovantes.map((x) => rotular(x, "Comprovante", "comprovante"))
        .concat(notas.map((x) => rotular(x, "Nota fiscal", "nota")))
        .concat(boletos.map((x) => rotular(x, "Boleto", "boleto")))
        .concat(entregas.map((x) => rotular(x, "Entrega conferida", "entrega"))),
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
    notas: linhas.reduce((t, l) => t + l.notas.length, 0),
    boletos: linhas.reduce((t, l) => t + l.boletos.length, 0),
    entregas: linhas.reduce((t, l) => t + l.entregas.length, 0),
    periodo: {
      de: (linhas.find((l) => l.pagoEm) || {}).pagoEm || "",
      ate: (linhas.filter((l) => l.pagoEm).pop() || {}).pagoEm || "",
    },
    vazio: linhas.length === 0,
  };
}

// Os arquivos para baixar de uma vez (o .zip que vai para a loja conferir):
// cada papel uma vez, com nome que não se repete — o número do papel já
// vem no nome; o que vier igual ganha (2), (3).
// Os tipos de papel que a folha e o zip podem levar, e o que vai marcado de
// saída: o que a loja confere é o que foi pago e a nota que ela emitiu.
const PAPEIS_DA_FOLHA = [
  { id: "comprovante", nome: "Comprovantes", padrao: true },
  { id: "nota", nome: "Notas fiscais", padrao: true },
  { id: "boleto", nome: "Boletos", padrao: false },
  { id: "entrega", nome: "Entregas conferidas", padrao: false },
];

// A foto da entrega assinada: o material chegou e foi conferido. É ela que
// acende o "✓ Entregue" na conta — e o cliente vê que alguém conferiu.
function entregaConferida(contas) {
  for (const c of contas || []) {
    const p = cpPapeisDaConta(c);
    if (p.entregas.length) return p.entregas[0];
  }
  return null;
}

function papelVaiNaFolha(a, tipos) {
  if (!tipos) return true;
  return !!tipos[(a && a.tipoDoPapel) || "comprovante"];
}

function arquivosDaFolha(folha, tipos) {
  const usados = new Map();
  const r = [];
  for (const [i, l] of ((folha || {}).linhas || []).entries()) {
    for (const a of l.papeis || []) {
      if (!a || !a.url || !papelVaiNaFolha(a, tipos)) continue;
      let nome = String(a.nome || "").trim();
      if (!nome) nome = `${String(i + 1).padStart(2, "0")} ${a.rotulo || "papel"}${a.ehPdf ? ".pdf" : ""}`;
      nome = nome.replace(/[\\/:*?"<>|]+/g, "-");
      const n = (usados.get(nome) || 0) + 1;
      usados.set(nome, n);
      if (n > 1) nome = nome.replace(/(\.[^.]+)?$/, (ext) => ` (${n})${ext || ""}`);
      r.push({ url: a.url, nome, rotulo: a.rotulo, pagamento: l.titulo });
    }
  }
  return r;
}

// ── Prestação de contas ─────────────────────────────────────────
// O pacote que vai para quem paga a obra: o resumo por conta contábil, a
// lista das notas (uma linha por transação paga, pelo número do papel) e os
// arquivos, um por um, com o nome do número — "4226.pdf" é a linha 4226.
// Entra só o que foi pago: a pagar não é conta prestada. O que estiver sem
// número ou sem arquivo vai junto, marcado — a prestação mostra o buraco
// em vez de escondê-lo.
// Venda do imóvel, depósito, liberação do financiamento: dinheiro que
// ENTRA. Na prestação ficam à parte — somá-los às despesas inflaria o custo.
function cpContaEhEntrada(contaId) {
  if (!contaId) return false;
  const plano = typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : null;
  const c = plano && plano.find((x) => x && x.id === contaId);
  if (c) return c.grupo === "receitas";
  return ["deposito_proprio", "liberacao_financ", "venda_imovel"].indexOf(contaId) >= 0;
}
function prestacaoDeContas(linhas) {
  const red = (x) => Math.round(x * 100) / 100;
  const pagas = (linhas || []).filter((l) => l && l.pago);
  const porTransacao = new Map();
  for (const l of pagas) {
    const c = l.conta_ || {};
    const numero = String(c.doc || "").trim();
    const k = numero ? "n:" + numero : "r:" + String(l.ref || c.numeroDoc || c.pedidoId || l.id);
    if (!porTransacao.has(k)) {
      porTransacao.set(k, { numero, ref: l.ref || "", data: l.pagoEm || "", fornecedor: l.fornecedor || "", obra: l.obra || "",
        nf: String(c.numeroNota || "").trim(), itens: [], contas: [], valor: 0, papeis: [], _vistos: new Set() });
    }
    const t = porTransacao.get(k);
    if (t.itens.length === 0) t.entrada = cpContaEhEntrada(l.contaId || c.contaId);
    t.itens.push(l.item || l.descricaoLanc || "");
    if (l.conta && t.contas.indexOf(l.conta) < 0) t.contas.push(l.conta);
    t.valor = red(t.valor + (Number(l.total) || 0));
    if (!t.data || (l.pagoEm && l.pagoEm < t.data)) t.data = l.pagoEm || t.data;
    if (!t.nf && c.numeroNota) t.nf = String(c.numeroNota).trim();
    // na ordem em que o número os batizou (anexos, depois o comprovante
    // antigo): o segundo papel da transação é o "-2" na pasta também
    const todos = (Array.isArray(c.anexos) ? c.anexos.filter(Boolean) : []).concat(c.comprovante ? [c.comprovante] : []);
    for (const a of todos) {
      // a proposta (antes da compra) e a foto da entrega não provam o
      // pagamento; o resto vai — o papel lançado pelo extrato chega como
      // "pedido" e é ele o documento da transação
      if (["proposta", "entrega"].indexOf(a.tipo || "") >= 0) continue;
      const chave = a.public_id || a.url;
      if (!a.url || t._vistos.has(chave)) continue;
      t._vistos.add(chave);
      t.papeis.push(a);
    }
  }
  const transacoes = [...porTransacao.values()].sort((a, b) => {
    if (a.numero && b.numero) return Number(a.numero) - Number(b.numero) || a.numero.localeCompare(b.numero);
    if (a.numero !== b.numero) return a.numero ? -1 : 1;
    return String(a.data).localeCompare(String(b.data));
  });
  // os arquivos, com o nome do número e sem repetir nome
  const usados = new Map();
  const arquivos = [];
  const notas = transacoes.map((t) => {
    const nomes = t.papeis.map((a, i) => {
      let nome = t.numero
        ? (cpNomeJaENumero(a.nome) && String(a.nome).indexOf(t.numero) === 0 ? String(a.nome) : cpNomeDoPapel(t.numero, i, a.nome || (cpEhPdf(a) ? "x.pdf" : "")))
        // sem número, o nome vai curto: a referência e a extensão — nome
        // original comprido estoura o limite de caminho do Windows ao extrair
        : "sem-numero-ref" + (t.ref || "x") + (i > 0 ? "-" + (i + 1) : "")
          + ((String(a.nome || "").match(/\.[A-Za-z0-9]{2,5}$/) || [cpEhPdf(a) ? ".pdf" : ""])[0]).toLowerCase();
      nome = nome.replace(/[\\/:*?"<>|]+/g, "-");
      // foto ou print vira PDF na prestação: quem recebe abre tudo igual.
      // O nome já sai .pdf aqui, para o relatório e a planilha baterem.
      const ehImagem = !cpEhPdf(a) && (/\.(jpe?g|png|webp|gif|bmp)$/i.test(nome)
        || /^(jpe?g|png|webp|gif|bmp)$/i.test(String(a.formato || "")) || a.resourceType === "image");
      if (ehImagem) nome = nome.replace(/\.[A-Za-z0-9]{2,5}$/, "") + ".pdf";
      const n = (usados.get(nome) || 0) + 1;
      usados.set(nome, n);
      if (n > 1) nome = nome.replace(/(\.[^.]+)?$/, (ext) => ` (${n})${ext || ""}`);
      arquivos.push({ url: a.url, nome, numero: t.numero, tipo: a.tipo === "nota" ? "nota" : "comprovante", ...(ehImagem ? { daImagem: true } : {}) });
      return nome;
    });
    const descricao = t.itens.length === 1 ? t.itens[0] : `${t.itens[0] || "Itens"} e mais ${t.itens.length - 1}`;
    return { numero: t.numero, ref: t.ref, data: t.data, fornecedor: t.fornecedor, descricao, itens: t.itens.length,
      conta: t.contas.join(" / "), nf: t.nf, valor: t.valor, arquivos: nomes, entrada: t.entrada,
      // Pagamento e estorno que se anulam (o Pix devolvido): nenhum dinheiro
      // saiu, não há papel a cobrar.
      semNumero: !t.numero, semArquivo: !nomes.length && Math.abs(t.valor) >= 0.01 };
  });
  const porConta = new Map();
  for (const l of pagas) {
    const nome = l.conta || "Sem conta";
    const r = porConta.get(nome) || { conta: nome, valor: 0, _t: new Set(), entrada: cpContaEhEntrada(l.contaId || (l.conta_ || {}).contaId) };
    r.valor = red(r.valor + (Number(l.total) || 0));
    const c = l.conta_ || {};
    r._t.add(String(c.doc || "").trim() || "r:" + String(l.ref || c.numeroDoc || c.pedidoId || l.id));
    porConta.set(nome, r);
  }
  const resumo = [...porConta.values()].map((r) => ({ conta: r.conta, transacoes: r._t.size, valor: r.valor, entrada: r.entrada }))
    .sort((a, b) => (a.entrada - b.entrada) || b.valor - a.valor || a.conta.localeCompare(b.conta));
  const datas = notas.map((n) => n.data).filter(Boolean).sort();
  return {
    resumo, notas, arquivos,
    total: red(resumo.filter((r) => !r.entrada).reduce((t, r) => t + r.valor, 0)),
    entradas: red(resumo.filter((r) => r.entrada).reduce((t, r) => t + r.valor, 0)),
    nSaidas: notas.filter((n) => !n.entrada).length, nEntradas: notas.filter((n) => n.entrada).length,
    de: datas[0] || "", ate: datas[datas.length - 1] || "",
    semNumero: notas.filter((n) => n.semNumero).length,
    semArquivo: notas.filter((n) => n.semArquivo).length,
    aPagarFora: (linhas || []).filter((l) => l && !l.pago).length,
  };
}

// ── Prestação de contas da obra: físico-financeiro, a pagar, recebimento ──
// A prestação de UMA obra leva, além das notas, o que a tela Execução do
// Físico-Financeiro mostra — pelas mesmas regras, para os números baterem:
// só o custo de executar (sem venda, terreno e IR sobre a receita), o
// realizado como a tela conta (pago, e a compra no cartão desde a compra),
// e o que ainda falta pagar. E o fluxo de recebimento: o que o cliente já
// depositou e o cronograma que se espera dele, mês a mês.
const CP_FF_CONTAS_FORA = ["ir_receita"];
function cpContaForaDoFF(contaId, plano) {
  const c = (plano || (typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : [])).find((x) => x && x.id === contaId);
  if (CP_FF_CONTAS_FORA.indexOf((c && c.pai) || contaId) >= 0) return true;
  return !!c && (c.grupo === "receitas" || c.grupo === "terreno");
}
function cpGruposDoFF() {
  return (typeof GRUPOS_PL !== "undefined" ? GRUPOS_PL : []).filter((g) => g.id !== "receitas" && g.id !== "terreno");
}
// O topo do eixo do gráfico num número redondo (1, 2, 2,5 ou 5 × 10ⁿ)
function cpTopoDoEixo(v) {
  const x = Math.max(1, Number(v) || 0);
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  for (const f of [1, 2, 2.5, 5, 10]) if (x <= f * p) return f * p;
  return 10 * p;
}
// quantas divisões dão passos redondos (25 mil → 5 de 5 mil; 20 mil → 4 de 5 mil)
function cpDivisoesDoEixo(topo) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, topo))));
  const f = Math.round(topo / p * 10) / 10;
  return f === 2 ? 4 : 5;
}
function cpRotuloDoEixo(v) {
  return v >= 1000 ? (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil" : String(Math.round(v));
}
function cpMesDe(iso) { const m = String(iso || "").match(/^(\d{4})-(\d{2})/); return m ? m[1] + "-" + m[2] : ""; }
function cpMesesEntre(de, ate) {
  const out = [];
  if (!de || !ate || de > ate) return out;
  let [a, m] = de.split("-").map(Number);
  for (let i = 0; i < 600; i++) {
    const k = a + "-" + String(m).padStart(2, "0");
    out.push(k);
    if (k === ate) break;
    m += 1; if (m > 12) { m = 1; a += 1; }
  }
  return out;
}
// Os parâmetros da prestação: o regime das despesas e o das entradas
// (caixa = pela data em que o dinheiro saiu/entrou; competência = pela
// data da despesa/parcela, pago ou não), o início da obra (o que veio antes
// é "pré-obra") e o término estimado (para o fluxo de caixa).
function cpParametrosPadrao(obra) {
  const o = obra || {};
  const dia = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || "")) ? String(v).slice(0, 10) : "");
  return { despesa: "caixa", entrada: "caixa", inicio: dia(o.dataInicio), termino: dia(o.dataFim) };
}
function cpHoje(o) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String((o || {}).hoje || "")) ? o.hoje : new Date().toISOString().slice(0, 10);
}
// Em que coluna do mês cai uma data: antes do início da obra, "pré-obra".
// Com `hoje`, só o que já passou vira pré-obra: o que ainda vai vencer antes
// do início (obra que começa no futuro) fica no mês dele.
function cpBalde(dataIso, inicio, hoje) {
  const d = String(dataIso || "").slice(0, 10);
  if (inicio && d && d < inicio && !(hoje && d.slice(0, 7) >= String(hoje).slice(0, 7))) return "pre";
  return cpMesDe(d);
}
function cpRotuloBalde(chave) {
  if (chave === "pre") return "Pré-obra";
  const x = String(chave || "").match(/^(\d{4})-(\d{2})$/);
  return x ? ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(x[2]) - 1] + "/" + x[1].slice(2) : "—";
}
// Os meses de uma série, em ordem, sem buracos, com a pré-obra na frente.
function cpMesesDaSerie(chaves, extras) {
  const meses = chaves.concat(extras || []).filter((k) => /^\d{4}-\d{2}$/.test(String(k || ""))).sort();
  const lista = meses.length ? cpMesesEntre(meses[0], meses[meses.length - 1]) : [];
  return (chaves.indexOf("pre") >= 0 ? ["pre"] : []).concat(lista);
}
// A despesa da obra que entra no físico-financeiro (o custo de executar).
function cpContasDoCusto(obra, plano) {
  return ((obra || {}).contasPagar || []).filter((c) => c && !c.vendaId && !cpContaEhEntrada(c.contaId) && !cpContaForaDoFF(c.contaId, plano));
}
function cpValorLancado(c) { return Math.round(((c && c.pago ? (Number(c.valorPago) || Number(c.valor)) : Number((c || {}).valor)) || 0) * 100) / 100; }
// A data da despesa em cada regime: caixa, quando saiu (ou sai) do banco;
// competência, o vencimento — como a coluna Competência da base.
function cpDataDaDespesa(c, regime) {
  // competência: o mês em que o custo foi contabilizado — a compra (no
  // cartão, todas as parcelas no mês da compra); sem data de compra, o vencimento
  if (regime === "competencia") {
    const compra = String(c.compraEm || (c.parcelaCartao && c.parcelaCartao.compraEm) || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(compra) ? compra : String(c.vencimento || c.pagoEm || "").slice(0, 10);
  }
  return String((c.pago ? c.pagoEm : c.vencimento) || c.vencimento || c.pagoEm || "").slice(0, 10);
}
function fisicoFinanceiroDaPrestacao(obra, opcoes) {
  const o = opcoes || {};
  const ob = obra || {};
  const regime = o.regime === "competencia" ? "competencia" : "caixa";
  const plano = o.plano || (typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : []);
  const grupos = o.grupos || cpGruposDoFF();
  const hoje = cpHoje(o);
  const red = (x) => Math.round(x * 100) / 100;
  const itens = (ob.estimativaPL || []).filter((i) => i && !cpContaForaDoFF(i.contaId, plano));
  const contas = cpContasDoCusto(ob, plano);
  const est = estimativaPorConta(itens);
  // caixa: realizado é o que saiu do banco; competência: o custo lançado —
  // a mesma régua do físico-financeiro da obra (contaNoRealizado): pago,
  // cartão e toda conta a pagar; a parcela de contrato ainda por fazer, não
  const realizou = (c) => (regime === "competencia" ? contaNoRealizado(c) : !!c.pago);
  const real = {}, aPagar = {};
  for (const c of contas) {
    const k = c.contaId || "mo_diversos";
    if (realizou(c)) real[k] = red((real[k] || 0) + cpValorLancado(c));
    else aPagar[k] = red((aPagar[k] || 0) + cpValorLancado(c));
  }
  const blocos = [];
  for (const g of grupos) {
    const linhas = [];
    for (const c of plano.filter((x) => x && x.grupo === g.id)) {
      const e = Number(est[c.id]) || 0, r = Number(real[c.id]) || 0, p = Number(aPagar[c.id]) || 0;
      if (!e && !r && !p) continue;
      linhas.push({ contaId: c.id, conta: c.nome || c.id, estimado: red(e), realizado: red(r), aPagar: red(p), saldo: red(e - r - p) });
    }
    if (!linhas.length) continue;
    const soma = (k) => red(linhas.reduce((t, l) => t + l[k], 0));
    blocos.push({ grupoId: g.id, titulo: g.titulo || g.id, noTotal: g.sinal < 0 && g.entra_no_resultado !== false, linhas,
      estimado: soma("estimado"), realizado: soma("realizado"), aPagar: soma("aPagar"), saldo: soma("saldo") });
  }
  const noTotal = blocos.filter((b) => b.noTotal);
  const tot = (k) => red(noTotal.reduce((t, b) => t + b[k], 0));
  const contaNoTotal = new Set(noTotal.reduce((t, b) => t.concat(b.linhas.map((l) => l.contaId)), []));
  const nomeDaConta = (id) => ((plano.find((x) => x && x.id === id) || {}).nome) || id || "";
  const aPagarLista = (ob.contasPagar || []).filter((c) => c && !c.vendaId && !c.pago && !cpContaEhEntrada(c.contaId))
    .map((c) => ({ id: c.id, vencimento: String(c.vencimento || "").slice(0, 10), fornecedor: c.favorecido || "",
      descricao: c.descricao || "", conta: nomeDaConta(c.contaId), valor: red(Number(c.valor) || 0),
      parcela: Number(c.parcelasTotal) > 1 ? `${c.parcela}/${c.parcelasTotal}` : (c.parcelaCartao ? `${c.parcelaCartao.k}/${c.parcelaCartao.de}` : ""),
      foraDoFF: !contaNoTotal.has(c.contaId || "mo_diversos"), atrasada: !!c.vencimento && String(c.vencimento).slice(0, 10) < hoje }))
    .sort((a, b) => String(a.vencimento || "9999").localeCompare(String(b.vencimento || "9999")) || b.valor - a.valor);
  const custoPrevisto = red(Math.max(tot("estimado"), tot("realizado") + tot("aPagar")));
  return { regime, blocos, total: { estimado: tot("estimado"), realizado: tot("realizado"), aPagar: tot("aPagar"), saldo: tot("saldo") },
    custoPrevisto, aPagarLista, totalAPagar: red(aPagarLista.reduce((t, x) => t + x.valor, 0)),
    pago: red(contas.filter((c) => c.pago && contaNoTotal.has(c.contaId || "mo_diversos")).reduce((t, c) => t + cpValorLancado(c), 0)),
    // as contas do realizado do total — para a conferência com as notas
    realizadas: contas.filter((c) => realizou(c) && contaNoTotal.has(c.contaId || "mo_diversos"))
      .map((c) => ({ id: c.id, valor: cpValorLancado(c), pago: !!c.pago })) };
}
// A conferência: o realizado do físico-financeiro e as notas pagas desta
// prestação são o mesmo dinheiro visto de dois lados. O que difere tem
// motivo, e a diferença que sobra sem motivo aparece (em vermelho).
function conferenciaDaPrestacao(ff, linhas) {
  const red = (x) => Math.round(x * 100) / 100;
  const notas = (linhas || []).filter((l) => l && l.pago && !cpContaEhEntrada(l.contaId || (l.conta_ || {}).contaId));
  const idsNotas = new Set(notas.map((l) => l.id));
  const idsFF = new Set(((ff || {}).realizadas || []).map((c) => c.id));
  const totalNotas = red(notas.reduce((t, l) => t + (Number(l.total) || 0), 0));
  const soNoFF = ((ff || {}).realizadas || []).filter((c) => !idsNotas.has(c.id));
  const foraDoPeriodo = red(soNoFF.filter((c) => c.pago).reduce((t, c) => t + c.valor, 0));
  const naoPago = red(soNoFF.filter((c) => !c.pago).reduce((t, c) => t + c.valor, 0));
  const foraDoFF = red(notas.filter((l) => !idsFF.has(l.id)).reduce((t, l) => t + (Number(l.total) || 0), 0));
  const realizado = red(((ff || {}).total || {}).realizado || 0);
  const explicado = red(totalNotas + foraDoPeriodo + naoPago - foraDoFF);
  return { realizado, totalNotas, foraDoPeriodo, naoPago, foraDoFF, diferenca: red(realizado - explicado), confere: Math.abs(realizado - explicado) < 0.01 };
}
// O custo mês a mês, no formato do gráfico do contas a pagar: no caixa,
// pago / vencido / a pagar; na competência, uma barra só (o lançado).
function custosMensais(obra, opcoes) {
  const o = opcoes || {};
  const regime = o.regime === "competencia" ? "competencia" : "caixa";
  const plano = o.plano || (typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : []);
  const hoje = cpHoje(o);
  const red = (x) => Math.round(x * 100) / 100;
  const por = {};
  for (const c of cpContasDoCusto(obra, plano)) {
    const k = cpBalde(cpDataDaDespesa(c, regime), o.inicio, hoje);
    if (!k) continue;
    const m = por[k] || (por[k] = { pago: 0, vencido: 0, aberto: 0, custo: 0 });
    const v = cpValorLancado(c);
    // competência: o custo lançado (a mesma régua do realizado); a parcela de
    // contrato ainda por fazer fica no que falta realizar
    if (regime === "competencia") { if (contaNoRealizado(c)) m.custo = red(m.custo + v); }
    else if (c.pago) m.pago = red(m.pago + v);
    else if (String(c.vencimento || "").slice(0, 10) < hoje) m.vencido = red(m.vencido + v);
    else m.aberto = red(m.aberto + v);
  }
  const meses = cpMesesDaSerie(Object.keys(por), o.inicio ? [o.inicio.slice(0, 7)] : []).map((k) => ({ chave: k, rotulo: cpRotuloBalde(k), ...(por[k] || { pago: 0, vencido: 0, aberto: 0, custo: 0 }) }));
  const soma = (k) => red(meses.reduce((t, m) => t + (m[k] || 0), 0));
  return { regime, meses, series: regime === "competencia" ? ["custo"] : ["pago", "vencido", "aberto"],
    total: { pago: soma("pago"), vencido: soma("vencido"), aberto: soma("aberto"), custo: soma("custo"), geral: red(soma("pago") + soma("vencido") + soma("aberto") + soma("custo")) } };
}
// O recebimento mês a mês: o que já entrou, o que os contratos assinados
// ainda vão pagar, o que se espera dos contratos a assinar e da venda
// futura (o cronograma digitado na obra). No caixa, a parcela paga cai no
// dia em que entrou; na competência, no vencimento dela.
// No gráfico e nas tabelas: contrato firme é a venda feita (assinada ou com o
// contrato pendente, que o cliente já está pagando) e o cronograma marcado como
// contrato; venda estimada é a projeção das unidades e o resto do cronograma.
const CP_FAIXAS_RECEB = [["recebido", "#cbd5e1", "Recebido"], ["firme", "#0474f4", "Contratos firmes"],
  ["estimativa", "#93c5fd", "Vendas estimadas"]];
function recebimentosMensais(obra, opcoes) {
  const o = opcoes || {};
  const ob = obra || {};
  const regime = o.regime === "competencia" ? "competencia" : "caixa";
  const red = (x) => Math.round(x * 100) / 100;
  const hoje = cpHoje(o);
  const por = {};
  const somar = (k, faixa, v) => { if (!k || !v) return; const m = por[k] || (por[k] = { recebido: 0, assinado: 0, assinar: 0, estimativa: 0 }); m[faixa] = red(m[faixa] + v); };
  // venda com o contrato ainda sem assinatura: o que falta receber dela é "a assinar"
  const pendentes = new Set((ob.vendas || []).filter((v) => v && v.contratoPendente).map((v) => v.id));
  for (const e of ob.entradas || []) if (e) somar(cpBalde(e.data, o.inicio, hoje), "recebido", Number(e.valor) || 0);
  for (const c of ob.contasPagar || []) {
    if (!c || !cpContaEhEntrada(c.contaId) || c.contaId === "documentacao_comprador") continue;
    const v = cpValorLancado(c);
    const aReceber = pendentes.has(c.vendaId) ? "assinar" : "assinado";
    if (regime === "competencia") somar(cpBalde(c.vencimento || c.pagoEm, o.inicio, hoje), c.pago ? "recebido" : aReceber, v);
    else if (c.pago) somar(cpBalde(c.pagoEm || c.vencimento, o.inicio, hoje), "recebido", v);
    else somar(cpBalde(c.vencimento, o.inicio, hoje), aReceber, v);
  }
  // a projeção de venda das unidades ainda disponíveis: venda futura
  const vendidas = new Set((ob.vendas || []).filter(Boolean).map((v) => v.unidadeId));
  let temProjecao = false;
  for (const u of ob.unidadesVenda || []) {
    if (!u || vendidas.has(u.id) || !u.projecao) continue;
    for (const p of u.projecao.parcelas || []) { somar(cpBalde(p.vencimento, o.inicio, hoje), "estimativa", Number(p.valor) || 0); temProjecao = true; }
  }
  for (const p of ob.cronogramaRecebimento || []) {
    if (!p || !/^\d{4}-\d{2}$/.test(String(p.mes || ""))) continue;
    somar(cpBalde(p.mes + "-01", o.inicio, hoje), p.tipo === "assinar" ? "assinar" : "estimativa", Number(p.valor) || 0);
  }
  const meses = cpMesesDaSerie(Object.keys(por), o.inicio ? [o.inicio.slice(0, 7)] : []).map((k) => {
    const m = por[k] || { recebido: 0, assinado: 0, assinar: 0, estimativa: 0 };
    return { chave: k, rotulo: cpRotuloBalde(k), ...m, firme: red(m.assinado + m.assinar) };
  });
  const soma = (k) => red(meses.reduce((t, m) => t + (m[k] || 0), 0));
  const total = { recebido: soma("recebido"), assinado: soma("assinado"), assinar: soma("assinar"), firme: soma("firme"), estimativa: soma("estimativa") };
  total.geral = red(total.recebido + total.assinado + total.assinar + total.estimativa);
  return { regime, meses, total, temCronograma: (ob.cronogramaRecebimento || []).length > 0 || temProjecao };
}
// O fluxo de caixa da obra até o término estimado: o custo pago mês a mês;
// o que falta realizar (o custo previsto menos o pago) dividido igual
// pelos meses que faltam até o término; o recebimento (o que entrou e o
// que se espera); e o resultado do mês e o acumulado.
function fluxoDeCaixaDaObra(obra, opcoes) {
  const o = opcoes || {};
  const red = (x) => Math.round(x * 100) / 100;
  const hoje = cpHoje(o);
  const mesHoje = hoje.slice(0, 7);
  const termino = /^\d{4}-\d{2}-\d{2}$/.test(String(o.termino || "")) ? o.termino : "";
  if (!termino) return { erro: "Informe o término estimado da obra." };
  const mesFim = termino.slice(0, 7) < mesHoje ? mesHoje : termino.slice(0, 7);
  // custo no regime escolhido: no caixa, o pago no mês em que saiu (o a
  // pagar fica no que falta realizar); na competência, o lançado no mês em que
  // foi contabilizado (pago ou não) — o que falta é o previsto menos o lançado
  const comp = o.regime === "competencia";
  const ff = o.ff || fisicoFinanceiroDaPrestacao(obra, { ...o, regime: comp ? "competencia" : "caixa" });
  const custo = custosMensais(obra, { ...o, regime: comp ? "competencia" : "caixa" });
  const receb = recebimentosMensais(obra, { ...o, regime: "caixa" });
  const aRealizar = red(Math.max(0, ff.custoPrevisto - (comp ? ff.total.realizado : ff.pago)));
  // obra que ainda não começou: o custo que falta é dividido do início dela
  // até o término (e não de hoje)
  const comeco0 = String(o.comecoDoCusto != null ? o.comecoDoCusto : o.inicio || "").slice(0, 7);
  const comeco = /^\d{4}-\d{2}$/.test(comeco0) && comeco0 > mesHoje && comeco0 <= mesFim ? comeco0 : mesHoje;
  const futuros = cpMesesEntre(comeco, mesFim);
  const parcela = futuros.length ? Math.floor(aRealizar * 100 / futuros.length) / 100 : 0;
  const porMesC = {}, porMesR = {};
  let atraso = 0;
  for (const m of custo.meses) porMesC[m.chave] = comp ? m.custo : m.pago;
  for (const m of receb.meses) {
    const passado = m.chave === "pre" || m.chave < mesHoje;
    porMesR[m.chave] = { recebido: m.recebido, previsto: passado ? 0 : red(m.assinado + m.assinar + m.estimativa) };
    // parcela de contrato vencida e não recebida não some: entra no mês atual
    if (passado) atraso = red(atraso + m.assinado);
  }
  const chaves = cpMesesDaSerie(Object.keys(porMesC).concat(Object.keys(porMesR)), futuros);
  let acum = 0;
  const linhas = chaves.map((k) => {
    const futuro = k !== "pre" && k >= mesHoje;
    const realizado = red(porMesC[k] || 0);
    const noPrazo = futuro && k >= comeco && k <= mesFim;
    const aRealizarMes = noPrazo ? (k === futuros[futuros.length - 1] ? red(aRealizar - parcela * (futuros.length - 1)) : parcela) : 0;
    const r = porMesR[k] || { recebido: 0, previsto: 0 };
    const previsto = red(r.previsto + (k === mesHoje ? atraso : 0));
    const entra = red(r.recebido + previsto);
    const sai = red(realizado + aRealizarMes);
    acum = red(acum + entra - sai);
    return { chave: k, rotulo: cpRotuloBalde(k), futuro, custoRealizado: realizado, custoARealizar: aRealizarMes, recebido: red(r.recebido), recebimentoPrevisto: previsto,
      entradas: entra, saidas: sai, resultado: red(entra - sai), acumulado: acum };
  });
  const soma = (k) => red(linhas.reduce((t, l) => t + l[k], 0));
  return { linhas, mesHoje, mesFim, aRealizar, mesesRestantes: futuros.length, regime: comp ? "competencia" : "caixa",
    total: { custoRealizado: soma("custoRealizado"), custoARealizar: soma("custoARealizar"), recebido: soma("recebido"),
      recebimentoPrevisto: soma("recebimentoPrevisto"), entradas: soma("entradas"), saidas: soma("saidas"), resultado: soma("resultado") } };
}
// ── O empreendimento com vários módulos ─────────────────────────
// Cada módulo é uma obra do mesmo empreendimento (o mesmo cadastro). Para a
// prestação do empreendimento inteiro, os módulos viram uma obra só: as
// contas, a estimativa, as entradas, as unidades e as vendas de todos.
function obraDoEmpreendimento(modulos, nome) {
  const ms = (modulos || []).filter(Boolean);
  const junta = (k) => ms.reduce((t, o) => t.concat((o[k] || []).filter(Boolean)), []);
  const datas = (k) => ms.map((o) => String(o[k] || "").slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const ini = datas("dataInicio"), fim = datas("dataFim");
  return { id: "emp:" + ((ms[0] || {}).clienteId || "x"), nome: nome || "Empreendimento", clienteId: (ms[0] || {}).clienteId || "",
    contasPagar: junta("contasPagar"), estimativaPL: junta("estimativaPL"), entradas: junta("entradas"),
    unidadesVenda: ms.reduce((t, o) => t.concat((o.unidadesVenda || []).filter(Boolean).map((u) => (ms.length > 1 ? { ...u, nome: `${o.nome || "Módulo"} · ${u.nome || ""}` } : u))), []),
    vendas: junta("vendas"), cronogramaRecebimento: junta("cronogramaRecebimento"),
    dataInicio: ini[0] || "", dataFim: fim[fim.length - 1] || "", modulos: ms.map((o) => o.id) };
}
// As datas de cada módulo na prestação do empreendimento inteiro: as que
// foram digitadas nos parâmetros; sem elas, as do cadastro do módulo.
function cpDatasDosModulos(modulos, datas) {
  const d = datas || {};
  const dia = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || "")) ? String(v).slice(0, 10) : "");
  return (modulos || []).filter(Boolean).map((m) => {
    const x = d[m.id] || {};
    return { id: m.id, nome: m.nome || "Módulo", inicio: dia(x.inicio != null ? x.inicio : m.dataInicio), termino: dia(x.termino != null ? x.termino : m.dataFim) };
  });
}
// Junta as séries mês a mês de vários módulos: soma os campos pelo mês (a
// pré-obra de cada um, com o início dele, cai junta em "pre").
function cpSomarMensais(lista, campos, extras) {
  const red = (x) => Math.round(x * 100) / 100;
  const por = {};
  for (const r of lista || []) for (const m of (r && r.meses) || []) {
    if (!campos.some((c) => Math.abs(Number(m[c]) || 0) > 0.004)) continue;
    const t = por[m.chave] || (por[m.chave] = {});
    for (const c of campos) t[c] = red((t[c] || 0) + (Number(m[c]) || 0));
  }
  const vazio = () => campos.reduce((t, c) => { t[c] = 0; return t; }, {});
  const meses = cpMesesDaSerie(Object.keys(por), extras || []).map((k) => ({ chave: k, rotulo: cpRotuloBalde(k), ...vazio(), ...(por[k] || {}) }));
  const total = campos.reduce((t, c) => { t[c] = red(meses.reduce((a, m) => a + (m[c] || 0), 0)); return t; }, {});
  return { meses, total };
}
// Os marcos do recebimento: os meses em que entra um valor grande de um
// módulo (a liberação do financiamento pela Caixa). Mês com mais de um
// módulo junta os nomes ("Mód. 2 e 3").
function cpMarcosDoRecebimento(porModulo, somado) {
  const totalDoMes = (m) => (Number(m.recebido) || 0) + (Number(m.assinado) || 0) + (Number(m.assinar) || 0) + (Number(m.estimativa) || 0);
  const maior = Math.max(0, ...((somado && somado.meses) || []).map(totalDoMes));
  const corte = Math.max(50000, maior * 0.25);
  const curto = (nome) => { const m = String(nome || "").match(/m[oó]dulo\s*(\S+)/i); return m ? m[1] : String(nome || "").trim(); };
  const porMes = {};
  for (const { nome, rm } of porModulo || []) {
    for (const m of (rm && rm.meses) || []) {
      if (m.chave === "pre" || totalDoMes(m) < corte) continue;
      (porMes[m.chave] = porMes[m.chave] || []).push(curto(nome));
    }
  }
  return Object.keys(porMes).sort().map((chave) => {
    const nomes = porMes[chave].filter(Boolean);
    const juntos = nomes.length > 1 ? nomes.slice(0, -1).join(", ") + " e " + nomes[nomes.length - 1] : nomes[0] || "";
    return { chave, rotulo: "Liberação CEF" + (juntos ? " · Mód. " + juntos : "") };
  });
}
// As linhas de chamada do gráfico de recebimentos, postas à mão, mês a mês.
// Ficam no cadastro como { chave: [{ mes: "2027-04", texto }] } — a chave é
// "todos" (o empreendimento inteiro) ou o id da obra — e viram os marcos
// { chave: mês, rotulo } que o gráfico e o PDF desenham.
function cpMarcosManuais(guardados, chave) {
  const lista = ((guardados || {})[chave]) || [];
  return lista.filter((x) => x && /^\d{4}-\d{2}$/.test(String(x.mes || "")) && String(x.texto || "").trim())
    .map((x) => ({ chave: x.mes, rotulo: String(x.texto).trim(), dx: Number(x.dx) || 0, dy: Number(x.dy) || 0 }))
    .sort((a, b) => a.chave.localeCompare(b.chave));
}
// Põe, troca ou (texto vazio) tira a chamada de um mês.
function cpMudarMarco(lista, mes, texto) {
  const antes = (lista || []).find((x) => x && x.mes === mes) || {};
  const sem = (lista || []).filter((x) => x && x.mes !== mes);
  const t = String(texto || "").trim();
  // trocar o texto não tira a chamada do lugar para onde foi arrastada
  const lugar = (Number(antes.dx) || Number(antes.dy)) ? { dx: Number(antes.dx) || 0, dy: Number(antes.dy) || 0 } : {};
  return (t ? sem.concat([{ mes, texto: t, ...lugar }]) : sem).sort((a, b) => String(a.mes).localeCompare(String(b.mes)));
}
// Arrastar a chamada: dx em larguras de mês, dy em linhas de texto (para cima
// é negativo) — as mesmas unidades no gráfico da tela e no PDF.
function cpMoverMarco(lista, mes, dx, dy) {
  const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
  return (lista || []).map((x) => (x && x.mes === mes ? { ...x, dx: r2(dx), dy: Math.max(-6, Math.min(12, r2(dy))) } : x));
}
// Onde vai o nome de cada marco e em que linha. O nome fica à direita da
// linha de chamada; perto da borda direita, à esquerda dela. Um nome que
// passa por cima da linha de chamada de outro marco fica numa linha acima
// do nome desse outro (a linha de chamada começa no nome e desce até a
// barra) — assim nenhuma linha cruza um nome. `x` é a linha de chamada,
// `largura` o tamanho do nome, `limite` a borda direita, `folga` o espaço
// entre a linha e o nome.
function cpLinhasDosMarcos(posicoes, limite, folga) {
  const ps = (posicoes || []).map((p) => {
    const f = folga == null ? 0 : folga;
    const direita = limite == null || p.x + f + p.largura <= limite;
    const inicio = direita ? p.x + f : Math.max(0, p.x - f - p.largura);
    return { x: p.x, inicio, fim: inicio + p.largura };
  });
  const n = ps.length, linha = ps.map(() => 0);
  const cobre = (a, b) => a !== b && ps[b].x > ps[a].inicio && ps[b].x < ps[a].fim;
  const encosta = (a, b) => a !== b && ps[a].inicio < ps[b].fim && ps[b].inicio < ps[a].fim;
  for (let volta = 0; volta < n * 2 + 2; volta++) {
    let mudou = false;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      // o nome de a cobre a linha de b: a fica acima do nome de b
      if (cobre(a, b) && !cobre(b, a) && linha[b] < linha[a] + 1) { linha[b] = linha[a] + 1; mudou = true; }
      // dois nomes encostados não ficam na mesma linha
      else if (encosta(a, b) && a < b && linha[a] === linha[b] && !cobre(b, a)) { linha[b] += 1; mudou = true; }
    }
    if (!mudou) break;
  }
  return ps.map((p, k) => ({ linha: linha[k], inicio: p.inicio }));
}
// A prestação do empreendimento inteiro com as datas de cada módulo: os
// custos, os recebimentos e o fluxo de caixa de cada um (pré-obra pelo
// início dele, custo que falta dividido até o término dele), somados mês a mês.
function prestacaoMensalDosModulos(modulos, opcoes) {
  const o = opcoes || {};
  const red = (x) => Math.round(x * 100) / 100;
  const hoje = cpHoje(o);
  const datas = cpDatasDosModulos(modulos, o.datas);
  const ms = (modulos || []).filter(Boolean);
  const inicios = datas.map((d) => d.inicio).filter(Boolean).sort();
  const terminos = datas.map((d) => d.termino).filter(Boolean).sort();
  // o início do empreendimento: o que veio antes é pré-obra (sem ele, o
  // primeiro início entre os módulos)
  const inicioEmp = /^\d{4}-\d{2}-\d{2}$/.test(String(o.inicio || "")) ? o.inicio : (inicios[0] || "");
  const extras = inicioEmp ? [inicioEmp.slice(0, 7)] : [];
  // os gráficos do empreendimento: uma linha do tempo só, com pré-obra antes
  // do primeiro módulo; o início de cada módulo vale para dividir o custo
  // que falta dele (do início ao término)
  const op = (m) => { const d = datas.find((x) => x.id === m.id) || {}; return { hoje, inicio: inicioEmp, comecoDoCusto: d.inicio || "", termino: d.termino || "" }; };
  const despesa = o.despesa === "competencia" ? "competencia" : "caixa";
  const entrada = o.entrada === "competencia" ? "competencia" : "caixa";
  const cms = ms.map((m) => custosMensais(m, { ...op(m), regime: despesa }));
  const cmS = cpSomarMensais(cms, ["pago", "vencido", "aberto", "custo"], extras);
  cmS.total.geral = red(cmS.total.pago + cmS.total.vencido + cmS.total.aberto + cmS.total.custo);
  const cm = { regime: despesa, meses: cmS.meses, series: despesa === "competencia" ? ["custo"] : ["pago", "vencido", "aberto"], total: cmS.total };
  const rms = ms.map((m) => recebimentosMensais(m, { ...op(m), regime: entrada }));
  const rmS = cpSomarMensais(rms, ["recebido", "assinado", "assinar", "firme", "estimativa"], extras);
  rmS.total.geral = red(rmS.total.recebido + rmS.total.assinado + rmS.total.assinar + rmS.total.estimativa);
  const rm = { regime: entrada, meses: rmS.meses, total: rmS.total, temCronograma: rms.some((r) => r.temCronograma) };
  rm.marcos = cpMarcosDoRecebimento(ms.map((m, i) => ({ nome: m.nome || "", rm: rms[i] })), rm);
  // o fluxo: cada módulo até o término dele. Sem término, só passa se não
  // houver custo a distribuir (nada a dividir); senão, pede o término.
  const faltam = [];
  const fcs = ms.map((m) => {
    const d = op(m);
    if (d.termino) return fluxoDeCaixaDaObra(m, { ...d, regime: despesa });
    const ff = fisicoFinanceiroDaPrestacao(m, { ...d, regime: despesa });
    if (red(Math.max(0, ff.custoPrevisto - (despesa === "competencia" ? ff.total.realizado : ff.pago))) > 0) { faltam.push(m.nome || "Módulo"); return null; }
    return fluxoDeCaixaDaObra(m, { ...d, termino: hoje, regime: despesa });
  });
  let fc;
  if (faltam.length) fc = { erro: "Informe o término estimado de: " + faltam.join(", ") + "." };
  else {
    const campos = ["custoRealizado", "custoARealizar", "recebido", "recebimentoPrevisto", "entradas", "saidas", "resultado"];
    const somado = cpSomarMensais(fcs.map((f) => ({ meses: f.linhas })), campos, extras);
    const mesHoje = hoje.slice(0, 7);
    let acum = 0;
    const linhas = somado.meses.map((l) => { acum = red(acum + l.resultado); return { ...l, futuro: l.chave !== "pre" && l.chave >= mesHoje, acumulado: acum }; });
    fc = { linhas, mesHoje, mesFim: fcs.map((f) => f.mesFim).sort().pop() || mesHoje, aRealizar: red(fcs.reduce((t, f) => t + f.aRealizar, 0)),
      mesesRestantes: Math.max(0, ...fcs.map((f) => f.mesesRestantes)), porModulo: true, regime: despesa, total: somado.total };
  }
  return { cm, rm, fc, datas, inicio: inicioEmp, termino: terminos[terminos.length - 1] || "" };
}
// Os contratos firmes (as vendas registradas): o resumo de cada um — valor,
// desconto, juros e documentação, o total do contrato, o que já entrou e o
// que falta, como se paga (sinal, parcelas, financiamento) e a próxima parcela.
function contratosFirmes(obra, opcoes) {
  const ob = obra || {};
  const hoje = cpHoje(opcoes);
  const red = (x) => Math.round(x * 100) / 100;
  const unidade = (id) => ((ob.unidadesVenda || []).find((u) => u && u.id === id) || {}).nome || "";
  return (ob.vendas || []).filter(Boolean).map((v) => {
    const cs = (ob.contasPagar || []).filter((c) => c && c.vendaId === v.id && c.contaId !== "documentacao_comprador");
    const val = (c) => (c.pago ? Number(c.valorPago) || Number(c.valor) || 0 : Number(c.valor) || 0);
    const fin = cs.filter((c) => /financiamento/i.test(c.descricao || ""));
    const parc = cs.filter((c) => !/financiamento/i.test(c.descricao || "") && /parcela\s*\d+\s*\/\s*\d+/i.test(c.descricao || ""));
    const sinal = cs.filter((c) => fin.indexOf(c) < 0 && parc.indexOf(c) < 0);
    const abertas = cs.filter((c) => !c.pago && c.vencimento).sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));
    const prox = abertas[0] || null;
    const valor = Number(v.valor) || 0, desconto = Number(v.desconto) || 0, juros = Number(v.juros) || 0, doc = Number(v.provisaoDoc) || 0;
    // o período do que o comprador paga direto (sinal e parcelas): do
    // primeiro ao último mês
    const datasDireto = sinal.concat(parc).map((c) => String((c.pago && c.pagoEm) || c.vencimento || c.pagoEm || "").slice(0, 7)).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
    return { id: v.id, unidade: unidade(v.unidadeId), comprador: v.comprador || "", data: String(v.data || "").slice(0, 10),
      valor, desconto, juros, documentacao: doc, liquido: red(valor - desconto),
      total: red(cs.reduce((t, c) => t + val(c), 0)), recebido: red(cs.filter((c) => c.pago).reduce((t, c) => t + val(c), 0)),
      aReceber: red(cs.filter((c) => !c.pago).reduce((t, c) => t + val(c), 0)),
      sinal: red(sinal.reduce((t, c) => t + val(c), 0)), parcelas: { n: parc.length, soma: red(parc.reduce((t, c) => t + val(c), 0)) },
      financiamento: red(fin.reduce((t, c) => t + val(c), 0)), financiamentoEm: fin.length ? String(fin[0].vencimento || "").slice(0, 10) : "",
      diretoDe: datasDireto[0] || "", diretoAte: datasDireto[datasDireto.length - 1] || "",
      proxima: prox ? { vencimento: String(prox.vencimento).slice(0, 10), valor: val(prox), atrasada: String(prox.vencimento).slice(0, 10) < hoje } : null,
      pendente: !!v.contratoPendente, observacao: String(v.observacao || "").trim() };
  });
}
// "(09/2026)" ou "(09/2026 a 05/2028)": o mês do sinal e, com parcelas, até a última
function cpPeriodoDireto(c) {
  const f = (m) => (m ? m.slice(5, 7) + "/" + m.slice(0, 4) : "");
  if (!c || !c.diretoDe) return "";
  return c.diretoAte && c.diretoAte !== c.diretoDe ? ` (${f(c.diretoDe)} a ${f(c.diretoAte)})` : ` (${f(c.diretoDe)})`;
}
// O percentual realizado de cada módulo (realizado ÷ estimado), só para
// quem tem estimativa; o do empreendimento soma só esses módulos.
function cpPercentualRealizado(mods) {
  const com = (mods || []).filter((m) => m && Number(m.estimado) > 0.004);
  const porId = {};
  for (const m of com) porId[m.id] = Math.round(Number(m.realizado || 0) / Number(m.estimado) * 1000) / 10;
  const est = com.reduce((t, m) => t + Number(m.estimado), 0), real = com.reduce((t, m) => t + Number(m.realizado || 0), 0);
  return { porId, total: est > 0.004 ? Math.round(real / est * 1000) / 10 : null };
}
const cpPctTexto = (p) => (p == null ? "" : p.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%");
// O quadro por módulo: o custo e o recebimento de cada um, lado a lado.
// As colunas da tabela "Por módulo" (prévia e PDF): custo e vendas, nesta ordem.
const CP_COLUNAS_POR_MODULO = [["estimado", "Custo estimado"], ["realizado", "Custo realizado"],
  ["vendasEstimadas", "Vendas estimadas"], ["recebido", "Vendas recebidas"], ["aReceber", "Vendas a receber"]];
function resumoPorModulo(modulos, opcoes) {
  const o = opcoes || {};
  return (modulos || []).filter(Boolean).map((m) => {
    const ff = fisicoFinanceiroDaPrestacao(m, { ...o, regime: o.despesa });
    const rm = recebimentosMensais(m, { ...o, regime: o.entrada });
    const d = (o.datas && o.datas[m.id]) || {};
    return { id: m.id, nome: m.nome || "Módulo", inicio: d.inicio || "", termino: d.termino || "", estimado: ff.total.estimado, realizado: ff.total.realizado, aPagar: ff.total.aPagar,
      saldo: ff.total.saldo, vendasEstimadas: Math.round(rm.total.geral * 100) / 100,
      recebido: rm.total.recebido, aReceber: Math.round((rm.total.geral - rm.total.recebido) * 100) / 100 };
  });
}
// O recebimento do cliente na tela da obra usa o mesmo cálculo.
function fluxoDeRecebimento(obra, opcoes) { return recebimentosMensais(obra, opcoes); }

// O relatório da prestação de contas, em PDF (A4 em pé). Com a obra:
// resumo, físico-financeiro, custos e recebimentos mês a mês (no formato do
// gráfico do contas a pagar), fluxo de caixa até o término, contas a pagar
// e a conferência com as notas. Depois, as notas uma a uma pelo número do
// papel (o mesmo nome do arquivo na pasta Papeis) e as pendências.
function pdfDaPrestacaoDeContas(JsPDF, pc, info) {
  const i = info || {};
  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = 210, M = 14, X1 = W - M, LARG = X1 - M;
  const AZUL = [30, 58, 95], AZUL_VK = [4, 116, 244], CINZA = [107, 114, 128], TINTA = [17, 24, 39], VERM = [185, 28, 28],
    VERDE = [22, 101, 52], LINHA = [226, 232, 240], FUNDO = [246, 248, 251];
  const moeda = (v) => (v < -0.004 ? "-R$ " : "R$ ") + Math.abs(Number(v || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dia = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const cor = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const caber = (t, larg) => {
    let s0 = String(t == null ? "" : t).replace(/\s+/g, " ").trim();
    if (doc.getTextWidth(s0) <= larg) return s0;
    while (s0.length > 1 && doc.getTextWidth(s0 + "…") > larg) s0 = s0.slice(0, -1);
    return s0.replace(/\s+$/, "") + "…";
  };
  const par = i.parametros || null;
  let y = M;
  // a página no fundo cinza da tela; os blocos em cartões brancos
  const PAPEL = [245, 247, 250], BRANCO = [255, 255, 255];
  const fundo = () => { doc.setFillColor(PAPEL[0], PAPEL[1], PAPEL[2]); doc.rect(0, 0, W, 297, "F"); };
  fundo();
  const quebra = (alt, aoAbrir) => {
    if (y + alt <= 282) return false;
    doc.addPage(); fundo(); y = M + 2;
    if (aoAbrir) aoAbrir();
    return true;
  };
  // ── cabeçalho
  doc.setFillColor(AZUL[0], AZUL[1], AZUL[2]); doc.rect(0, 0, W, 3, "F");
  y = M + 2;
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); cor(TINTA);
  doc.text("Prestação de contas", M, y + 5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); cor(CINZA);
  if (i.escritorio) doc.text(caber(i.escritorio, 80), X1, y + 1.5, { align: "right" });
  doc.text("Emitido em " + (i.emitidoEm || dia(new Date().toISOString())), X1, y + 5.5, { align: "right" });
  y += 12;
  doc.setFontSize(11); cor(TINTA); doc.setFont("helvetica", "bold");
  doc.text(caber(i.obra || "Obra", 130), M, y);
  doc.setFont("helvetica", "normal"); cor(CINZA); doc.setFontSize(8.5);
  const sub = [i.tipo || "", i.cliente ? "Cliente: " + i.cliente : "", (pc.de || pc.ate) ? `Notas de ${dia(i.de || pc.de)} a ${dia(i.ate || pc.ate)}` : ""].filter(Boolean).join("   ·   ");
  if (sub) doc.text(caber(sub, LARG), M, y + 4.6);
  y += 8;
  if (par) {
    doc.setFillColor(BRANCO[0], BRANCO[1], BRANCO[2]); doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]); doc.setLineWidth(0.2);
    doc.roundedRect(M, y, LARG, 7, 1.6, 1.6, "FD");
    doc.setFontSize(7.6); cor(TINTA);
    const reg = (r) => (r === "competencia" ? "competência" : "caixa");
    const itens = [`Despesas: regime de ${reg(par.despesa)}`, `Entradas: regime de ${reg(par.entrada)}`,
      ...(par.datasModulos ? [par.inicio ? `Início do empreendimento: ${dia(par.inicio)}` : ""]
        : [par.inicio ? `Início da obra: ${dia(par.inicio)}` : "", par.termino ? `Término estimado: ${dia(par.termino)}` : ""])].filter(Boolean);
    doc.text(caber(itens.join("     ·     "), LARG - 6), M + 3, y + 4.6);
    y += 11;
  } else y += 3;
  // ── títulos numerados: o selo azul com o número e o título, como na tela
  let nSec = 0;
  const selo = (x, yy, titulo) => {
    nSec += 1;
    doc.setFillColor(AZUL_VK[0], AZUL_VK[1], AZUL_VK[2]); doc.roundedRect(x, yy, 5.4, 5.4, 1.1, 1.1, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255, 255, 255); doc.text(String(nSec), x + 2.7, yy + 3.85, { align: "center" });
    doc.setFontSize(11.5); cor(TINTA); doc.text(titulo, x + 7.6, yy + 4.1);
    doc.setFont("helvetica", "normal");
  };
  const linhasDaNota = (nota, larg) => { if (!nota) return []; doc.setFontSize(7.6); return doc.splitTextToSize(nota, larg); };
  // cartão branco com título, nota e um conteúdo de altura conhecida (o gráfico)
  const cartao = (titulo, nota, alturaConteudo, desenhar) => {
    const PAD = 5, IW = LARG - 2 * PAD;
    const ls = linhasDaNota(nota, IW);
    const h = PAD + 6 + (ls.length ? ls.length * 3.3 + 2 : 1) + alturaConteudo + PAD;
    quebra(h + 2);
    doc.setFillColor(BRANCO[0], BRANCO[1], BRANCO[2]); doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]); doc.setLineWidth(0.25);
    doc.roundedRect(M, y, LARG, h, 2.6, 2.6, "FD");
    selo(M + PAD, y + PAD, titulo);
    let yy = y + PAD + 6;
    if (ls.length) { doc.setFontSize(7.6); cor(CINZA); doc.text(ls, M + PAD, yy + 2.8); yy += ls.length * 3.3 + 2; } else yy += 1;
    desenhar(M + PAD, yy, IW);
    y += h + 4;
  };
  // seção de tabela: o topo do cartão (título e nota), e a tabela encosta embaixo
  const secao = (titulo, nota, reservar) => {
    const PAD = 5;
    const ls = linhasDaNota(nota, LARG - 2 * PAD);
    const h = PAD + 6 + (ls.length ? ls.length * 3.3 + 2.5 : 1.5);
    quebra(Math.max(reservar || 24, h + 14));
    doc.setFillColor(BRANCO[0], BRANCO[1], BRANCO[2]); doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]); doc.setLineWidth(0.25);
    doc.roundedRect(M, y, LARG, h + 3, 2.6, 2.6, "FD");
    doc.rect(M, y + h - 0.2, LARG, 3.4, "F");
    selo(M + PAD, y + PAD, titulo);
    if (ls.length) { doc.setFontSize(7.6); cor(CINZA); doc.text(ls, M + PAD, y + PAD + 6 + 2.8); }
    y += h;
  };
  const notaPe = (t) => { doc.setFontSize(6.8); cor(CINZA); const ls = doc.splitTextToSize(t, LARG); quebra(ls.length * 3 + 2); doc.text(ls, M, y + 2.4); y += ls.length * 3 + 3; };
  // ── a tabela: compacta nas listas longas (fonte e linha menores)
  const tabela = (cols, linhas, opcoes) => {
    const o = opcoes || {};
    const fs = o.compacta ? 6.6 : 7.6, alt = o.compacta ? 4.4 : 5.2, altCab = o.compacta ? 5.4 : 6;
    const tot = cols.reduce((t, c) => t + c.w, 0);
    const k = LARG / tot;
    const cs = cols.map((c) => ({ ...c, w: c.w * k }));
    const cab = () => {
      doc.setFillColor(AZUL[0], AZUL[1], AZUL[2]); doc.rect(M, y, LARG, altCab, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(fs); doc.setTextColor(255, 255, 255);
      let x = M;
      for (const c of cs) {
        const tx = c.alinhar === "right" ? x + c.w - 1.5 : c.alinhar === "center" ? x + c.w / 2 : x + 1.5;
        doc.text(c.t, tx, y + altCab / 2 + fs * 0.13, { align: c.alinhar || "left" });
        x += c.w;
      }
      y += altCab;
      doc.setFont("helvetica", "normal");
    };
    quebra(altCab + alt * 2);
    cab();
    doc.setFontSize(fs);
    let zebra = 0;
    linhas.forEach((l) => {
      if (quebra(alt, () => { cab(); doc.setFontSize(fs); })) zebra = 0;
      if (l.corrido != null) {
        doc.setFillColor(255, 255, 255); doc.rect(M, y, LARG, alt, "F");
        doc.setFontSize(fs - 0.6); cor(CINZA); doc.text(caber(l.corrido, LARG - 3), M + 1.5, y + alt / 2 + fs * 0.13); doc.setFontSize(fs);
        doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]); doc.setLineWidth(0.15); doc.line(M, y + alt, X1, y + alt);
        y += alt; return;
      }
      if (l.grupo) { doc.setFillColor(234, 240, 248); doc.rect(M, y, LARG, alt, "F"); doc.setFont("helvetica", "bold"); zebra = 0; }
      else if (l.total) { doc.setFont("helvetica", "bold"); doc.setFillColor(FUNDO[0], FUNDO[1], FUNDO[2]); doc.rect(M, y, LARG, alt, "F");
        doc.setDrawColor(AZUL[0], AZUL[1], AZUL[2]); doc.setLineWidth(0.3); doc.line(M, y, X1, y); }
      else { if (zebra % 2 === 1) doc.setFillColor(248, 250, 252); else doc.setFillColor(255, 255, 255); doc.rect(M, y, LARG, alt, "F"); zebra += 1; }
      let x = M;
      cs.forEach((c, j) => {
        const v = l.celulas[j];
        cor(l.vermelho && l.vermelho.indexOf(j) >= 0 ? VERM : l.verde && l.verde.indexOf(j) >= 0 ? VERDE : l.cinza ? CINZA : TINTA);
        // o anel do percentual: cinza por baixo, azul até o percentual
        if (l.anel && l.anel.col === j && l.anel.pct != null) {
          const r = alt * 0.3, cx0 = x + 1.5 + r, cy0 = y + alt / 2, f = Math.max(0, Math.min(1, l.anel.pct / 100));
          doc.setLineWidth(0.75); doc.setDrawColor(229, 231, 235); doc.circle(cx0, cy0, r, "S");
          if (f > 0) {
            const c2 = l.anel.pct > 100 ? [239, 68, 68] : AZUL_VK; doc.setDrawColor(c2[0], c2[1], c2[2]);
            const n2 = Math.max(2, Math.ceil(f * 48));
            for (let q = 0; q < n2; q++) {
              const a1 = -Math.PI / 2 + 2 * Math.PI * f * q / n2, a2 = -Math.PI / 2 + 2 * Math.PI * f * (q + 1) / n2;
              doc.line(cx0 + r * Math.cos(a1), cy0 + r * Math.sin(a1), cx0 + r * Math.cos(a2), cy0 + r * Math.sin(a2));
            }
          }
          doc.text(caber(v, c.w - 3 - 2 * r - 1.5), x + 1.5 + 2 * r + 1.5, y + alt / 2 + fs * 0.13);
          x += c.w;
          return;
        }
        const t = caber(v, c.w - 3);
        const tx = c.alinhar === "right" ? x + c.w - 1.5 : c.alinhar === "center" ? x + c.w / 2 : x + 1.5;
        doc.text(t, tx, y + alt / 2 + fs * 0.13, { align: c.alinhar || "left" });
        x += c.w;
      });
      if (l.total || l.grupo) doc.setFont("helvetica", "normal");
      y += alt;
    });
    doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]); doc.setLineWidth(0.2); doc.line(M, y, X1, y);
    y += o.depois != null ? o.depois : 7;
  };
  // ── as barras, como na tela (o gráfico do contas a pagar): barras de
  // largura fixa a partir da esquerda, empilhadas, topo arredondado, o valor
  // do mês em negrito em cima, o mês embaixo (o atual em negrito) e a
  // legenda em quadradinhos. Muitos meses: as barras estreitam para caber.
  const curto = (v) => { const a = Math.abs(v); const t = a >= 1000000 ? (a / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "mi" : a >= 1000 ? Math.round(a / 1000) + "k" : a > 0 ? String(Math.round(a)) : ""; return v < 0 && t ? "-" + t : t; };
  const ALT_BARRAS = 32;
  const alturaDoGrafico = (alt) => alt + 5 + 7 + 8;
  const barras = (meses, faixas, x0, y0, larg, opcoes) => {
    const o = opcoes || {};
    const n = meses.length;
    const ALT = o.altura || ALT_BARRAS;
    // proporção da tela: barra larga (40 de barra para 16 de vão)
    const slot = Math.min(14, larg / Math.max(1, n)), bw = slot * 0.71;
    const valor = (m) => faixas.reduce((t, f) => t + (Number(m[f[0]]) || 0), 0);
    const vals = meses.map(valor);
    const maxPos = Math.max(0, ...vals), maxNeg = Math.max(0, ...vals.map((v) => -v));
    const total = Math.max(1, maxPos + maxNeg);
    const hPos = maxNeg > 0 && maxPos > 0 ? ALT * 0.62 : maxNeg > 0 ? 0 : ALT;
    const hNeg = ALT - hPos;
    const base = y0 + 5 + hPos;
    // o valor negativo vai embaixo da barra: sobra lugar para ele antes do mês
    // muitos meses: o valor vai deitado em cima de todas as barras, com a
    // letra do tamanho que cabe na largura da barra (sem encavalar)
    const vertical = Math.ceil(6.4 / Math.min(14, larg / Math.max(1, n))) > 1;
    // os marcos (liberação da Caixa): reservam duas linhas no topo
    const temMarcos = !!(o.marcos && o.marcos.length);
    let posMarcosPdf = [];
    if (temMarcos) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(6.2);
      const sl = Math.min(14, larg / Math.max(1, n));
      posMarcosPdf = cpLinhasDosMarcos(o.marcos.map((z) => { const k = meses.findIndex((m) => m.chave === z.chave);
        return { x: x0 + k * sl + sl / 2, largura: 0.6 + doc.getTextWidth(z.rotulo) }; }), x0 + larg, 0.8);
      doc.setFont("helvetica", "normal");
    }
    // chamada arrastada para cima ganha espaço no topo
    const sobeV = temMarcos ? Math.max(0, ...o.marcos.map((z) => -(Number(z.dy) || 0))) * 3.6 : 0;
    const topoV = temMarcos ? 2 + sobeV + (Math.max(0, ...posMarcosPdf.map((pm) => pm.linha)) + 1) * 3.6 : 0;
    const escP = maxPos > 0 ? Math.max(1, hPos - topoV) / maxPos : 0, escN = maxNeg > 0 ? Math.max(1, hNeg - 4.5) / maxNeg : 0;
    void total;
    doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]); doc.setLineWidth(0.3); doc.line(x0, base, x0 + Math.min(larg, slot * n + 2), base);
    const fsVal = slot < 6 ? 5 : slot < 8 ? 5.8 : slot < 11 ? 6.6 : 7.2, fsMes = slot < 6 ? 5 : slot < 8 ? 5.8 : slot < 11 ? 6.6 : 7.2;
    // muitos meses: o rótulo (mês e valor) vai a cada tantos, para não encavalar
    const pulo = Math.max(1, Math.ceil(6.4 / slot));
    const mostra = (k, m) => pulo === 1 || k % pulo === 0 || m.chave === (o.mesHoje || "") || m.chave === "pre";
    meses.forEach((m, k) => {
      const x = x0 + k * slot + (slot - bw) / 2, cx = x + bw / 2;
      const v = vals[k];
      if (o.sinal) {
        const h = v > 0 ? Math.max(0.6, v * escP) : v < 0 ? Math.max(0.6, -v * escN) : 0;
        if (h > 0) { const c = v < 0 ? VERM : AZUL_VK; doc.setFillColor(c[0], c[1], c[2]); doc.roundedRect(x, v > 0 ? base - h : base, bw, h, Math.min(0.9, bw * 0.12), Math.min(0.9, bw * 0.12), "F"); }
        if (Math.abs(v) > 0.004 && mostra(k, m)) { doc.setFont("helvetica", "bold"); doc.setFontSize(fsVal); cor(v < 0 ? VERM : TINTA);
          doc.text(curto(v), cx, v >= 0 ? base - h - 1.2 : base + h + 2.6, { align: "center" }); doc.setFont("helvetica", "normal"); }
      } else {
        let yy = base;
        const segs = faixas.map((f) => ({ cor: hex(f[1]), v: Number(m[f[0]]) || 0 })).filter((sg) => sg.v > 0.004);
        segs.forEach((sg, j) => {
          const h = Math.max(0.5, sg.v * escP);
          yy -= h;
          doc.setFillColor(sg.cor[0], sg.cor[1], sg.cor[2]);
          const r = Math.min(0.9, bw * 0.12, h / 2);
          // o topo arredondado e o corpo reto: a emenda fica junto do topo (no
          // meio da barra aparecia uma linha fina)
          if (j === segs.length - 1 && r > 0.2) { doc.roundedRect(x, yy, bw, h, r, r, "F"); doc.rect(x, yy + r, bw, h - r, "F"); }
          else doc.rect(x, yy, bw, h, "F");
        });
        if (v > 0.004 && vertical) {
          doc.setFont("helvetica", "bold"); cor(TINTA);
          let fs = fsVal;
          doc.setFontSize(fs);
          while (fs > 3.6 && doc.getTextWidth(curto(v)) > slot - 0.3) { fs -= 0.2; doc.setFontSize(fs); }
          doc.text(curto(v), cx, yy - 1, { align: "center" }); doc.setFont("helvetica", "normal");
        } else if (v > 0.004 && mostra(k, m)) { doc.setFont("helvetica", "bold"); doc.setFontSize(fsVal); cor(TINTA); doc.text(curto(v), cx, yy - 1.2, { align: "center" }); doc.setFont("helvetica", "normal"); }
      }
      // o marco: uma linha fina saindo do topo da barra até o nome, em cima
      const mc = temMarcos ? o.marcos.find((z) => z.chave === m.chave) : null;
      if (mc) {
        const ordem = o.marcos.indexOf(mc), linha = (posMarcosPdf[ordem] || {}).linha || 0;
        // o lugar para onde a chamada foi arrastada na prévia (mesmas unidades)
        const slM = Math.min(14, larg / Math.max(1, n));
        const yTxt = Math.max(y0 + 1.5, y0 + 2.6 + sobeV + linha * 3.6 + (Number(mc.dy) || 0) * 3.6), yBarra = base - Math.max(0, v * escP) - (vertical ? 4.2 : 4.6);
        doc.setFont("helvetica", "bold"); doc.setFontSize(6.2);
        const lgT = doc.getTextWidth(mc.rotulo);
        const ini = Math.max(x0, Math.min(x0 + larg - lgT, (posMarcosPdf[ordem] ? posMarcosPdf[ordem].inicio : cx + 0.8) + (Number(mc.dx) || 0) * slM));
        const deLado = cx < ini - 0.5 || cx > ini + lgT;
        const xPonta = cx < ini ? ini - 0.6 : ini + lgT + 0.3;
        const yL = deLado ? yTxt - 0.9 : yTxt + 0.9;
        doc.setDrawColor(156, 163, 175); doc.setLineWidth(0.15); doc.line(cx, yL, cx, Math.max(yL + 0.1, yBarra));
        if (deLado) doc.line(cx, yL, xPonta, yL);
        cor(TINTA); doc.text(mc.rotulo, ini, yTxt); doc.setFont("helvetica", "normal");
      }
      const atual = m.chave === (o.mesHoje || "");
      if (mostra(k, m) && !(pulo > 1 && !atual && meses.some((z, j) => z.chave === (o.mesHoje || "") && j !== k && Math.abs(j - k) < pulo))) {
        doc.setFont("helvetica", atual ? "bold" : "normal"); doc.setFontSize(fsMes); cor(atual ? TINTA : CINZA);
        doc.text(m.rotulo, cx, y0 + 5 + ALT + 4.2, { align: "center" });
      }
      doc.setFont("helvetica", "normal");
    });
    let lx = x0;
    const ly = y0 + 5 + ALT + 11;
    const usadas = o.sinal ? faixas : faixas.filter((f) => meses.some((m) => (Number(m[f[0]]) || 0) > 0.004));
    for (const f of usadas) {
      const c = hex(f[1]);
      doc.setFillColor(c[0], c[1], c[2]); doc.roundedRect(lx, ly - 2.5, 2.8, 2.8, 0.6, 0.6, "F");
      doc.setFontSize(7.4); cor(TINTA); doc.text(f[2], lx + 4, ly - 0.2); lx += 4 + doc.getTextWidth(f[2]) + 6;
    }
  };
  // o fluxo de caixa: barras = resultado do mês (azul / vermelho vivo),
  // linha = saldo acumulado do dinheiro, com o valor em cada ponto
  const VIVO = [239, 68, 68], NAVY = [17, 24, 39];
  const graficoFluxo = (linhas, x0, y0, larg, mesHoje) => {
    const n = linhas.length;
    const ALT = 38;
    const slot = Math.min(14, larg / Math.max(1, n)), bw = slot * 0.6;
    const vals = linhas.reduce((t, l) => t.concat([l.resultado, l.acumulado]), []);
    const maxPos = Math.max(0, ...vals), maxNeg = Math.max(0, ...vals.map((v) => -v));
    const tot = Math.max(1, maxPos + maxNeg);
    // o lado negativo tem um mínimo, senão some quando o positivo é bem maior
    const hNeg = maxNeg > 0 ? Math.max(ALT * maxNeg / tot, 13) : 0, hPos = ALT - hNeg;
    const base = y0 + 5 + hPos;
    // o valor do ponto negativo vai embaixo dele: sobra lugar antes do mês
    const esc = (v) => (v >= 0 ? (maxPos ? v / maxPos * hPos : 0) : (maxNeg ? v / maxNeg * Math.max(0, hNeg - 4) : 0));
    const pulo = Math.max(1, Math.ceil(7 / slot));
    doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]); doc.setLineWidth(0.3); doc.line(x0, base, x0 + Math.min(larg, slot * n + 2), base);
    const cx = (k) => x0 + k * slot + slot / 2;
    linhas.forEach((l, k) => {
      const v = l.resultado, h = Math.abs(esc(v));
      if (h > 0.2) { const c = v < 0 ? VIVO : AZUL_VK; doc.setFillColor(c[0], c[1], c[2]);
        doc.roundedRect(cx(k) - bw / 2, v >= 0 ? base - h : base, bw, h, Math.min(0.8, bw * 0.12), Math.min(0.8, bw * 0.12), "F"); }
      const atual = l.chave === mesHoje;
      if (pulo === 1 || k % pulo === 0 || atual || l.chave === "pre") {
        doc.setFont("helvetica", atual ? "bold" : "normal"); doc.setFontSize(slot < 8 ? 5.6 : 6.6); cor(atual ? TINTA : CINZA);
        doc.text(l.rotulo, cx(k), y0 + 5 + ALT + 4.2, { align: "center" }); doc.setFont("helvetica", "normal");
      }
    });
    // a linha do acumulado por cima
    doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]); doc.setLineWidth(0.55);
    for (let k = 1; k < n; k++) doc.line(cx(k - 1), base - esc(linhas[k - 1].acumulado), cx(k), base - esc(linhas[k].acumulado));
    linhas.forEach((l, k) => {
      const py = base - esc(l.acumulado);
      doc.setFillColor(255, 255, 255); doc.circle(cx(k), py, 0.95, "F");
      const c = l.acumulado < 0 ? VIVO : NAVY; doc.setFillColor(c[0], c[1], c[2]); doc.circle(cx(k), py, 0.65, "F");
      if (pulo === 1 || k % pulo === 0 || k === n - 1) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(slot < 8 ? 5.2 : 6.2); cor(l.acumulado < 0 ? VIVO : NAVY);
        doc.text(curto(l.acumulado), cx(k), l.acumulado < 0 ? py + 3.2 : py - 1.6, { align: "center" }); doc.setFont("helvetica", "normal");
      }
    });
    let lx = x0;
    const ly = y0 + 5 + ALT + 11;
    const legenda = [[AZUL_VK, "Resultado do mês (positivo)", "q"], [VIVO, "Resultado do mês (negativo)", "q"], [NAVY, "Saldo acumulado do dinheiro", "l"]];
    for (const [c, t, tipo] of legenda) {
      doc.setFillColor(c[0], c[1], c[2]);
      if (tipo === "q") doc.roundedRect(lx, ly - 2.5, 2.8, 2.8, 0.6, 0.6, "F");
      else { doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(0.55); doc.line(lx - 0.5, ly - 1.1, lx + 3.3, ly - 1.1); doc.circle(lx + 1.4, ly - 1.1, 0.65, "F"); }
      doc.setFontSize(7.4); cor(TINTA); doc.text(t, lx + 4.2, ly - 0.2); lx += 4.2 + doc.getTextWidth(t) + 6;
    }
  };
  const ff = i.ff, cf = i.conferencia, cm = i.custos, rm = i.recebimentos, fc = i.fluxoCaixa, ct = i.contratos, pr = i.procura;
  const comp = ff && ff.regime === "competencia";
  // 1. resumo
  const caixas = ff ? [["Custo estimado", moeda(ff.total.estimado)], [comp ? "Custo realizado" : "Custo pago", moeda(ff.total.realizado)]]
    .concat(comp ? [] : [["A pagar", moeda(ff.total.aPagar)]])
    .concat(rm ? [["Recebido", moeda(rm.total.recebido)]] : [])
    .concat(fc && !fc.erro ? [["Resultado projetado", moeda(fc.total.resultado)]] : [["Pendências", String(pc.semArquivo + pc.semNumero)]])
    : [["Total das saídas", moeda(pc.total)], ...(pc.nEntradas ? [["Total das entradas", moeda(pc.entradas)]] : []), ["Notas", String(pc.notas.length)],
      ["Arquivos", String(pc.arquivos.length)], ["Pendências", String(pc.semArquivo + pc.semNumero)]];
  const lc = (LARG - (caixas.length - 1) * 2.5) / caixas.length;
  caixas.forEach(([rot, val], k) => {
    const x = M + k * (lc + 2.5);
    doc.setFillColor(BRANCO[0], BRANCO[1], BRANCO[2]); doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]); doc.setLineWidth(0.25);
    doc.roundedRect(x, y, lc, 14, 2, 2, "FD");
    doc.setFontSize(6.6); cor(CINZA); doc.text(rot.toUpperCase(), x + 2.8, y + 4.6);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
    const neg = /^-R\$/.test(val);
    cor(neg || (rot === "Pendências" && val !== "0") ? VERM : rot === "Resultado projetado" ? VERDE : TINTA);
    doc.text(caber(val, lc - 4), x + 2.8, y + 10.6);
    doc.setFont("helvetica", "normal");
  });
  y += 19;
  // por módulo (o empreendimento inteiro)
  const mods = i.modulos;
  if (mods && mods.length) {
    const datasTxt = mods.filter((m) => m.inicio || m.termino).map((m) => `${m.nome}: ${m.inicio ? dia(m.inicio) : "—"} a ${m.termino ? dia(m.termino) : "—"}`).join(" · ");
    void datasTxt;
    secao("Por módulo");
    const ks = CP_COLUNAS_POR_MODULO.map((c) => c[0]);
    const vlr = (v) => (Math.abs(v) > 0.004 ? moeda(v) : "—");
    // % realizado (realizado ÷ estimado), com o anel, só para o módulo com estimativa
    const pr = cpPercentualRealizado(mods);
    tabela([{ t: "Módulo", w: 40 }, { t: "% realizado", w: 21 }].concat(CP_COLUNAS_POR_MODULO.map((c) => ({ t: c[1], w: 24.2, alinhar: "right" }))),
      mods.map((m) => ({ celulas: [m.nome, pr.porId[m.id] != null ? cpPctTexto(pr.porId[m.id]) : "—"].concat(ks.map((k) => vlr(m[k]))),
        anel: pr.porId[m.id] != null ? { col: 1, pct: pr.porId[m.id] } : null }))
        .concat([{ total: true, celulas: ["Empreendimento", pr.total != null ? cpPctTexto(pr.total) : "—"].concat(ks.map((k) => moeda(mods.reduce((t, m) => t + (Number(m[k]) || 0), 0)))),
          anel: pr.total != null ? { col: 1, pct: pr.total } : null }]));
  }
  // 2. físico-financeiro
  if (ff) {
    secao("Físico-financeiro (obra inteira)");
    const cols = [{ t: "Conta contábil", w: 70 }, { t: "Estimado", w: 28, alinhar: "right" }, { t: comp ? "Realizado (lançado)" : "Realizado (pago)", w: 30, alinhar: "right" }]
      .concat(comp ? [] : [{ t: "A pagar", w: 28, alinhar: "right" }]).concat([{ t: "Saldo", w: 28, alinhar: "right" }]);
    const lin = (rot, l, extra) => ({ ...extra, celulas: [rot, moeda(l.estimado), moeda(l.realizado)].concat(comp ? [] : [moeda(l.aPagar)]).concat([moeda(l.saldo)]),
      vermelho: l.saldo < -0.005 ? [comp ? 3 : 4] : [] });
    const linhasFF = [];
    for (const b of ff.blocos) {
      linhasFF.push(lin(b.titulo + (b.noTotal ? "" : " (fora do custo)"), b, { grupo: true }));
      for (const l of b.linhas) linhasFF.push(lin("    " + l.conta, l));
    }
    linhasFF.push(lin("Custo da obra", ff.total, { total: true }));
    // no caixa: o realizado mais o a pagar é o custo lançado
    if (!comp && ff.total.aPagar > 0.004) linhasFF.push({ total: true, celulas: ["Custo lançado (pago + a pagar)", "", moeda(ff.total.realizado + ff.total.aPagar), "", ""] });
    tabela(cols, linhasFF, { compacta: linhasFF.length > 22 });
  }
  // 3. custos mês a mês
  if (cm && cm.meses.length) {
    cartao(comp ? "Custos realizados mês a mês" : "Custos mês a mês", "", alturaDoGrafico(ALT_BARRAS),
      (x0, y0, lg) => barras(cm.meses, comp ? [["custo", "#0474f4", "Custo realizado"]] : CP_FAIXAS, x0, y0, lg, { mesHoje: (fc && fc.mesHoje) || "" }));
    const cols = [{ t: "Mês", w: 22 }].concat(comp ? [{ t: "Custo realizado", w: 40, alinhar: "right" }]
      : [{ t: "Pago", w: 30, alinhar: "right" }, { t: "Vencido", w: 30, alinhar: "right" }, { t: "A pagar", w: 30, alinhar: "right" }]).concat([{ t: "Total do mês", w: 34, alinhar: "right" }]);
    const vlr = (v) => (Math.abs(v) > 0.004 ? moeda(v) : "—");
    tabela(cols, cm.meses.map((m) => ({ celulas: [m.rotulo].concat(comp ? [vlr(m.custo)] : [vlr(m.pago), vlr(m.vencido), vlr(m.aberto)])
      .concat([vlr(m.pago + m.vencido + m.aberto + m.custo)]), vermelho: !comp && m.vencido > 0 ? [2] : [] }))
      .concat([{ total: true, celulas: ["Total"].concat(comp ? [moeda(cm.total.custo)] : [moeda(cm.total.pago), moeda(cm.total.vencido), moeda(cm.total.aberto)]).concat([moeda(cm.total.geral)]) }]),
      { compacta: true });
  }
  // 4. recebimentos mês a mês
  if (rm && rm.meses.length) {
    cartao("Recebimentos mês a mês", "Contratos realizados e vendas estimadas, baseadas na procura e nos novos cadastros de clientes.", alturaDoGrafico(ALT_BARRAS),
      (x0, y0, lg) => barras(rm.meses, CP_FAIXAS_RECEB, x0, y0, lg, { mesHoje: (fc && fc.mesHoje) || "", marcos: rm.marcos || [] }));
    const vlr = (v) => (Math.abs(v) > 0.004 ? moeda(v) : "—");
    tabela([{ t: "Mês", w: 34 }, { t: "Recebido", w: 37, alinhar: "right" }, { t: "Contratos firmes", w: 37, alinhar: "right" },
      { t: "Vendas estimadas", w: 37, alinhar: "right" }, { t: "Total do mês", w: 37, alinhar: "right" }],
      rm.meses.map((m) => ({ celulas: [m.rotulo, vlr(m.recebido), vlr(m.firme), vlr(m.estimativa), vlr(m.recebido + m.firme + m.estimativa)] }))
        .concat([{ total: true, celulas: ["Total", moeda(rm.total.recebido), moeda(rm.total.firme), moeda(rm.total.estimativa), moeda(rm.total.geral)] }]),
      { compacta: true });
  }
  // 5. fluxo de caixa
  if (fc) {
    if (fc.erro) {
      secao("Fluxo de Caixa Livre", "Sem o término estimado da obra não há como distribuir o custo que falta. Informe o término nos parâmetros da prestação.");
    } else {
      cartao("Fluxo de Caixa Livre",
        "Fluxo de caixa livre, demonstrando a dinâmica entre períodos de investimento e de vendas.",
        alturaDoGrafico(38), (x0, y0, lg) => graficoFluxo(fc.linhas, x0, y0, lg, fc.mesHoje));
      const vlr = (v) => (Math.abs(v) > 0.004 ? moeda(v) : "—");
      tabela([{ t: "Mês", w: 18 }, { t: "Custo realizado", w: 26, alinhar: "right" }, { t: "Custo a realizar", w: 26, alinhar: "right" },
        { t: "Recebido", w: 26, alinhar: "right" }, { t: "A receber previsto", w: 28, alinhar: "right" }, { t: "Resultado do mês", w: 27, alinhar: "right" }, { t: "Acumulado", w: 27, alinhar: "right" }],
        fc.linhas.map((l) => ({ celulas: [l.rotulo + (l.futuro ? "" : ""), vlr(l.custoRealizado), vlr(l.custoARealizar), vlr(l.recebido), vlr(l.recebimentoPrevisto), moeda(l.resultado), moeda(l.acumulado)],
          vermelho: [].concat(l.resultado < -0.004 ? [5] : []).concat(l.acumulado < -0.004 ? [6] : []), verde: l.acumulado > 0.004 ? [6] : [] }))
          .concat([{ total: true, celulas: ["Total", moeda(fc.total.custoRealizado), moeda(fc.total.custoARealizar), moeda(fc.total.recebido), moeda(fc.total.recebimentoPrevisto), moeda(fc.total.resultado), ""] }]),
        { compacta: true });
    }
  }
  // 6. contas a pagar
  if (ff && ff.aPagarLista.length) {
    secao("Contas a pagar", "Tudo o que foi lançado na obra e ainda não foi pago, por vencimento. Em vermelho: vencimento já passou.");
    tabela([{ t: "Vencimento", w: 19, alinhar: "center" }, { t: "Fornecedor", w: 40 }, { t: "Descrição", w: 58 },
      { t: "Parcela", w: 13, alinhar: "center" }, { t: "Conta", w: 32 }, { t: "Valor", w: 24, alinhar: "right" }],
      ff.aPagarLista.map((x) => ({ celulas: [dia(x.vencimento) || "—", x.fornecedor || "—", x.descricao + (x.foraDoFF ? " (fora do custo)" : ""), x.parcela, x.conta, moeda(x.valor)],
        vermelho: x.atrasada ? [0] : [] }))
        .concat([{ total: true, celulas: ["", "", "Total a pagar", "", "", moeda(ff.totalAPagar)] },
          ...(pc && pc.total > 0.004 ? [{ celulas: ["", "", "+ Já pago (notas e comprovantes)", "", "", moeda(pc.total)] },
            { total: true, celulas: ["", "", "Custo lançado (pago + a pagar)", "", "", moeda(pc.total + ff.totalAPagar)] }] : [])]), { compacta: true });
  }
  // 7. conferência
  if (cf) {
    secao("Conferência: físico-financeiro × notas desta prestação", "As duas pontas são o mesmo dinheiro; o que difere tem motivo. Diferença sem motivo aparece em vermelho.");
    tabela([{ t: "", w: 140 }, { t: "Valor", w: 46, alinhar: "right" }], [
      { celulas: ["Notas pagas desta prestação (saídas)", moeda(cf.totalNotas)] },
      ...(cf.foraDoPeriodo ? [{ celulas: ["+ pago fora do período ou do filtro escolhido", moeda(cf.foraDoPeriodo)] }] : []),
      ...(cf.naoPago ? [{ celulas: ["+ lançado e ainda não pago (competência)", moeda(cf.naoPago)] }] : []),
      ...(cf.foraDoFF ? [{ celulas: ["- notas fora do custo do físico-financeiro (terreno, IR, excluídas…)", moeda(cf.foraDoFF)] }] : []),
      { total: true, celulas: ["Realizado no físico-financeiro", moeda(cf.realizado)] },
      { celulas: [cf.confere ? "Confere." : "Diferença sem explicação", cf.confere ? "" : moeda(cf.diferenca)], vermelho: cf.confere ? [] : [0, 1], verde: cf.confere ? [0] : [] },
      // no caixa, o que foi lançado e não pago fica fora do realizado: soma
      // aqui para chegar no custo lançado (o mesmo total das outras tabelas)
      ...(!comp && ff && ff.total.aPagar > 0.004 ? [{ celulas: ["+ contas a pagar (lançado e ainda não pago)", moeda(ff.total.aPagar)] },
        { total: true, celulas: ["Custo lançado (pago + a pagar)", moeda(cf.realizado + ff.total.aPagar)] }] : []),
    ]);
  }
  // 8. resumo por conta (das notas)
  const saidas = pc.resumo.filter((r) => !r.entrada);
  const pct = (v) => (pc.total > 0 ? (v / pc.total * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%" : "");
  // com a obra: o que está a pagar entra junto, por conta, para o total
  // chegar no custo lançado (pago + a pagar)
  const aPagarPorConta = {}, aPagarQtd = {};
  for (const x of (ff && ff.aPagarLista) || []) {
    aPagarPorConta[x.conta || "—"] = Math.round(((aPagarPorConta[x.conta || "—"] || 0) + (Number(x.valor) || 0)) * 100) / 100;
    aPagarQtd[x.conta || "—"] = (aPagarQtd[x.conta || "—"] || 0) + 1;
  }
  const totalAPagarPC = ff ? ff.totalAPagar || 0 : 0;
  if (saidas.length && totalAPagarPC > 0.004) {
    const nomes = saidas.map((r) => r.conta).concat(Object.keys(aPagarPorConta).filter((c) => !saidas.some((r) => r.conta === c)));
    const geral = pc.total + totalAPagarPC;
    const pctG = (v) => (geral > 0 ? (v / geral * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%" : "");
    const vlr = (v) => (Math.abs(v) > 0.004 ? moeda(v) : "—");
    // tudo como pago: as notas e o que foi lançado e ainda vai vencer (as
    // parcelas do cartão e as outras) — o custo inteiro, numa coluna só
    void vlr;
    const nAPagar = Object.values(aPagarQtd).reduce((t, q) => t + q, 0);
    secao("Custos por conta contábil", "Pago: as notas desta prestação e o que foi lançado e ainda vai vencer (parcelas do cartão e outras, no quadro Contas a pagar).");
    tabela([{ t: "Conta contábil", w: 96 }, { t: "Notas", w: 24, alinhar: "center" }, { t: "Pago", w: 40, alinhar: "right" }, { t: "%", w: 22, alinhar: "right" }],
      nomes.map((c) => { const r = saidas.find((z) => z.conta === c) || { transacoes: 0, valor: 0 }; const ap = aPagarPorConta[c] || 0;
        return { celulas: [c, String((r.transacoes || 0) + (aPagarQtd[c] || 0)), moeda(r.valor + ap), pctG(r.valor + ap)], _v: r.valor + ap }; })
        .sort((a, b) => b._v - a._v)
        .concat([{ total: true, celulas: ["Custo lançado", String(pc.nSaidas + nAPagar), moeda(geral), geral > 0 ? "100,0%" : ""] }]),
      { compacta: nomes.length > 20 });
  } else if (saidas.length) {
    secao("Notas pagas por conta contábil");
    tabela([{ t: "Conta contábil", w: 96 }, { t: "Notas", w: 24, alinhar: "center" }, { t: "Valor", w: 40, alinhar: "right" }, { t: "% das saídas", w: 26, alinhar: "right" }],
      saidas.map((r) => ({ celulas: [r.conta, String(r.transacoes), moeda(r.valor), pct(r.valor)] }))
        .concat([{ total: true, celulas: ["Total das saídas", String(pc.nSaidas), moeda(pc.total), pc.total > 0 ? "100,0%" : ""] }]),
      { compacta: saidas.length > 20 });
  }
  if (pc.nEntradas) {
    tabela([{ t: "Entradas — conta contábil", w: 96 }, { t: "Lançamentos", w: 24, alinhar: "center" }, { t: "Valor", w: 40, alinhar: "right" }, { t: "", w: 26 }],
      pc.resumo.filter((r) => r.entrada).map((r) => ({ celulas: [r.conta, String(r.transacoes), moeda(r.valor), ""] }))
        .concat([{ total: true, celulas: ["Total das entradas", String(pc.nEntradas), moeda(pc.entradas), ""] }]));
  }
  // 9. as notas, uma a uma
  const colsNotas = [{ t: "Nº", w: 12, alinhar: "center" }, { t: "Data", w: 16, alinhar: "center" }, { t: "Fornecedor", w: 38 },
    { t: "Descrição", w: 66 }, { t: "Conta", w: 32 }, { t: "Valor", w: 22, alinhar: "right" }];
  const linhaDaNota = (n) => ({ celulas: [n.numero || "—", dia(n.data), n.fornecedor || "—", n.descricao, n.conta, moeda(n.valor)],
    vermelho: [].concat(n.semNumero || n.semArquivo ? [0] : []) });
  const notasSaida = pc.notas.filter((n) => !n.entrada);
  if (notasSaida.length) {
    secao("Notas e comprovantes", "O número de cada nota é o nome do arquivo na pasta Papeis (nota 4226 = arquivo 4226.pdf). Em vermelho: sem arquivo ou sem número.");
    tabela(colsNotas, notasSaida.map(linhaDaNota).concat([{ total: true, celulas: ["", "", "", totalAPagarPC > 0.004 ? "Total pago (notas)" : "Total das saídas", "", moeda(pc.total)] }])
      .concat(totalAPagarPC > 0.004 ? [{ celulas: ["", "", "", "+ Contas a pagar (lançado e ainda não pago)", "", moeda(totalAPagarPC)] },
        { total: true, celulas: ["", "", "", "Custo lançado (pago + a pagar)", "", moeda(pc.total + totalAPagarPC)] }] : []), { compacta: true });
  }
  const notasEntrada = pc.notas.filter((n) => n.entrada);
  if (notasEntrada.length) {
    secao("Entradas — lançamentos");
    tabela(colsNotas, notasEntrada.map(linhaDaNota).concat([{ total: true, celulas: ["", "", "", "Total das entradas", "", moeda(pc.entradas)] }]), { compacta: true });
  }
  // 9b. os contratos firmes: um cartão por venda — quem comprou, o valor do
  // contrato, quanto já entrou (a barra), como se paga e a próxima parcela
  if (ct && ct.length) {
    const soma = (k) => ct.reduce((t, c) => t + (Number(c[k]) || 0), 0);
    const GAP = 4, CH = 27, por = 2;
    const linhasDeCartoes = Math.ceil(ct.length / por);
    cartao("Contratos firmes", "Vendas feitas, com o comprador pagando. Valor do contrato = venda - desconto + juros + documentação.",
      11 + linhasDeCartoes * (CH + GAP) - GAP, (x0, y0, lg) => {
        // o resumo: quantos, valor, recebido, a receber
        const resumo = [[`${ct.length} ${ct.length === 1 ? "contrato" : "contratos"}`, ""], ["Valor dos contratos", moeda(soma("total"))],
          ["Recebido", moeda(soma("recebido"))], ["A receber", moeda(soma("aReceber"))]];
        void resumo;
        const cw = lg / resumo.length;
        resumo.forEach(([rot, v], q) => {
          const xx = x0 + q * cw;
          if (!v) { doc.setFont("helvetica", "bold"); doc.setFontSize(10); cor(TINTA); doc.text(rot, xx, y0 + 6.2); return; }
          doc.setFont("helvetica", "normal"); doc.setFontSize(6.6); cor(CINZA); doc.text(rot.toUpperCase(), xx, y0 + 2.6);
          doc.setFont("helvetica", "bold"); doc.setFontSize(9.6); cor(TINTA); doc.text(v, xx, y0 + 7.4);
        });
        doc.setFont("helvetica", "normal");
        const w = (lg - GAP * (por - 1)) / por;
        ct.forEach((c, q) => {
          const xx = x0 + (q % por) * (w + GAP), yy = y0 + 11 + Math.floor(q / por) * (CH + GAP), PX = 3.5;
          doc.setFillColor(FUNDO[0], FUNDO[1], FUNDO[2]); doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]); doc.setLineWidth(0.2);
          doc.roundedRect(xx, yy, w, CH, 2, 2, "FD");
          // a unidade e quem comprou, numa linha
          const uni = String(c.unidade || "").split(" · ").pop() || "—";
          doc.setFont("helvetica", "bold"); doc.setFontSize(9.4); cor(TINTA); doc.text(uni, xx + PX, yy + 5.6);
          const uw = doc.getTextWidth(uni);
          doc.setFont("helvetica", "normal"); doc.setFontSize(7.6); cor(CINZA);
          doc.text(caber(c.comprador || "", w - 2 * PX - uw - 2), xx + PX + uw + 2, yy + 5.6);
          // o valor do contrato e a barra do que já entrou
          doc.setFont("helvetica", "bold"); doc.setFontSize(11.5); cor(TINTA); doc.text(moeda(c.total), xx + PX, yy + 12.2);
          const f = c.total > 0 ? Math.max(0, Math.min(1, c.recebido / c.total)) : 0, bw = w - 2 * PX;
          doc.setFont("helvetica", "normal"); doc.setFontSize(6.6); cor(CINZA);
          doc.text(`${Math.round(f * 100)}% recebido`, xx + w - PX, yy + 12.1, { align: "right" });
          doc.setFillColor(226, 232, 240); doc.roundedRect(xx + PX, yy + 14, bw, 1.4, 0.7, 0.7, "F");
          if (f > 0.002) { doc.setFillColor(AZUL_VK[0], AZUL_VK[1], AZUL_VK[2]); doc.roundedRect(xx + PX, yy + 14, Math.max(1.4, bw * f), 1.4, 0.7, 0.7, "F"); }
          // como se paga: o direto (sinal e parcelas) e o financiamento
          const direto = c.sinal + c.parcelas.soma;
          const comoPaga = [direto > 0.004 ? [(c.parcelas.n ? `Sinal e ${c.parcelas.n} parcelas` : "Sinal") + cpPeriodoDireto(c), moeda(direto)] : null,
            c.financiamento > 0.004 ? [`Financiamento${c.financiamentoEm ? " (" + dia(c.financiamentoEm).slice(3) + ")" : ""}`, moeda(c.financiamento)] : null].filter(Boolean);
          const pw = bw / Math.max(1, comoPaga.length);
          comoPaga.forEach(([rot, v], z) => {
            doc.setFont("helvetica", "normal"); doc.setFontSize(6.4); cor(CINZA); doc.text(caber(rot, pw - 2), xx + PX + z * pw, yy + 19.6);
            doc.setFont("helvetica", "bold"); doc.setFontSize(8); cor(TINTA); doc.text(v, xx + PX + z * pw, yy + 23.4);
          });
          doc.setFont("helvetica", "normal");
        });
      });
  }
  // 9c. a procura: os cadastros do site — números, a curva acumulada e o dia a dia
  if (pr && pr.serie && pr.serie.length) {
    const dd = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
    const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    cartao("Cadastros de novos Clientes no site", `Simulações feitas no site, por data de cadastro, de ${dia(pr.de)} a ${dia(pr.ate)}. Alto potencial em conversão de vendas.`,
      12 + 40 + 9 + 22 + 6, (x0, y0, lg) => {
      const st = [["Cadastros", String(pr.total)], ["Últimos 7 dias", String(pr.ultimos7)], ["Últimos 14 dias", String(pr.ultimos14)], ["Melhor dia", `${pr.melhorDia.n} em ${dd(pr.melhorDia.iso)}`]];
      const cw = lg / st.length;
      st.forEach(([rot, v], q) => {
        doc.setFont("helvetica", "normal"); doc.setFontSize(6.6); cor(CINZA); doc.text(rot.toUpperCase(), x0 + q * cw, y0 + 2.6);
        doc.setFont("helvetica", "bold"); doc.setFontSize(10); cor(TINTA); doc.text(v, x0 + q * cw, y0 + 7.6);
      });
      doc.setFont("helvetica", "normal");
      const sr = pr.serie, n = sr.length, DIR = 10, passo = (lg - DIR) / n;
      const cx = (i) => x0 + i * passo + passo / 2;
      // a curva acumulada
      const t1 = y0 + 14, h1 = 34, b1 = t1 + h1, maxA = Math.max(1, sr[n - 1].acumulado);
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.4); cor(TINTA); doc.text("Acumulado", x0, t1 - 1);
      doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]); doc.setLineWidth(0.2); doc.line(x0, b1, x0 + lg - DIR, b1);
      doc.setDrawColor(AZUL_VK[0], AZUL_VK[1], AZUL_VK[2]); doc.setLineWidth(0.6);
      for (let k = 1; k < n; k++) doc.line(cx(k - 1), b1 - sr[k - 1].acumulado / maxA * (h1 - 4), cx(k), b1 - sr[k].acumulado / maxA * (h1 - 4));
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.4); cor(CINZA);
      sr.forEach((d, k) => { if (k < n - 1 && sr[k + 1].iso.slice(8) === "01") {
        const yy = b1 - d.acumulado / maxA * (h1 - 4);
        doc.setFillColor(AZUL_VK[0], AZUL_VK[1], AZUL_VK[2]); doc.circle(cx(k), yy, 0.7, "F"); doc.text(String(d.acumulado), cx(k), yy - 1.6, { align: "center" }); } });
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); cor(TINTA); doc.text(String(sr[n - 1].acumulado), cx(n - 1) + 1.5, b1 - (h1 - 4) + 1);
      // o dia a dia
      const t2 = b1 + 9, h2 = 20, b2 = t2 + h2, maxD = Math.max(1, ...sr.map((d) => d.n));
      doc.setFontSize(7.4); doc.text("Por dia", x0, t2 - 1);
      doc.setFont("helvetica", "normal");
      doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]); doc.setLineWidth(0.2); doc.line(x0, b2, x0 + lg - DIR, b2);
      doc.setFillColor(AZUL_VK[0], AZUL_VK[1], AZUL_VK[2]);
      sr.forEach((d, k) => { if (d.n > 0) { const h = Math.max(0.4, d.n / maxD * (h2 - 2)); doc.rect(cx(k) - passo * 0.36, b2 - h, passo * 0.72, h, "F"); } });
      const im = sr.findIndex((d) => d.iso === pr.melhorDia.iso);
      doc.setFontSize(6.4); cor(TINTA); doc.text(`${pr.melhorDia.n} em ${dd(pr.melhorDia.iso)}`, cx(im) + passo, b2 - (h2 - 2) + 2);
      cor(CINZA);
      sr.forEach((d, k) => { if (d.iso.slice(8) === "01" || k === 0) doc.text(MES[Number(d.iso.slice(5, 7)) - 1] + "/" + d.iso.slice(2, 4), cx(k), b2 + 3.6); });
    });
  }
  // 10. pendências
  const pend = pc.notas.filter((n) => n.semArquivo || n.semNumero);
  if (pend.length) {
    secao("Pendências");
    tabela([{ t: "Nº", w: 13, alinhar: "center" }, { t: "Data", w: 17, alinhar: "center" }, { t: "Fornecedor", w: 46 },
      { t: "Descrição", w: 60 }, { t: "Valor", w: 22, alinhar: "right" }, { t: "Falta", w: 28 }],
      pend.map((n) => ({ celulas: [n.numero || "—", dia(n.data), n.fornecedor || "—", n.descricao, moeda(n.valor),
        [n.semNumero ? "número" : "", n.semArquivo ? "arquivo" : ""].filter(Boolean).join(" e ")], vermelho: [5] })), { compacta: true });
  }
  void notaPe;
  // rodapé em todas as páginas
  const total = doc.getNumberOfPages();
  for (let k = 1; k <= total; k++) {
    doc.setPage(k);
    doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]); doc.setLineWidth(0.2); doc.line(M, 287, X1, 287);
    doc.setFontSize(7); cor(CINZA); doc.setFont("helvetica", "normal");
    doc.text(caber(["Prestação de contas", i.obra, i.escritorio].filter(Boolean).join("  ·  "), 150), M, 291);
    doc.text(`Página ${k} de ${total}`, X1, 291, { align: "right" });
  }
  return doc;
}

// A foto do comprovante numa página A4 (em pé ou deitada, como a foto
// for), centrada com margem. Passa pelo canvas: qualquer formato que o
// navegador abre (jpg, png, webp) sai como JPEG dentro do PDF, já girado
// como a foto foi tirada.
async function imagemEmPdf(JsPDF, blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((ok, falha) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = () => falha(new Error("imagem ilegível"));
      im.src = url;
    });
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!(w > 0 && h > 0)) throw new Error("imagem vazia");
    const escala = Math.min(1, 2400 / Math.max(w, h));
    const cv = document.createElement("canvas");
    cv.width = Math.round(w * escala); cv.height = Math.round(h * escala);
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const dados = cv.toDataURL("image/jpeg", 0.85);
    const deitada = w > h;
    const doc = new JsPDF({ unit: "mm", format: "a4", orientation: deitada ? "landscape" : "portrait" });
    const PW = deitada ? 297 : 210, PH = deitada ? 210 : 297, M = 8;
    const k = Math.min((PW - 2 * M) / cv.width, (PH - 2 * M) / cv.height);
    const iw = cv.width * k, ih = cv.height * k;
    doc.addImage(dados, "JPEG", (PW - iw) / 2, (PH - ih) / 2, iw, ih);
    return doc.output("blob");
  } finally {
    URL.revokeObjectURL(url);
  }
}

// O jsPDF entra pela página (shared.jsx o carrega na abertura); se ainda
// não chegou, espera um pouco e, sem ele, busca de novo.
function carregarJsPDF() {
  if (typeof window === "undefined") return Promise.reject(new Error("sem janela"));
  if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  return new Promise((ok, falha) => {
    let n = 0;
    const tique = setInterval(() => {
      if (window.jspdf && window.jspdf.jsPDF) { clearInterval(tique); ok(window.jspdf.jsPDF); return; }
      if (++n === 20 && !document.getElementById("jspdf-script-2")) {
        const s = document.createElement("script");
        s.id = "jspdf-script-2";
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        document.head.appendChild(s);
      }
      if (n > 80) { clearInterval(tique); falha(new Error("a biblioteca de PDF não carregou")); }
    }, 150);
  });
}

let cpCargaZip = null;
function carregarJSZip() {
  if (typeof window !== "undefined" && window.JSZip) return Promise.resolve(window.JSZip);
  if (cpCargaZip) return cpCargaZip;
  cpCargaZip = new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = () => (window.JSZip ? ok(window.JSZip) : falha(new Error("sem JSZip")));
    s.onerror = () => { cpCargaZip = null; falha(new Error("não carregou")); };
    document.head.appendChild(s);
  });
  return cpCargaZip;
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
// (antes dele, o ícone do papel, que as telas de contas usam todas: a folha
// com o canto dobrado e o visto — "tem papel aqui". No lugar do clipe 📎,
// que cada sistema desenha de um jeito.)
function IconePapel({ tamanho, estilo }) {
  const t = Number(tamanho) || 11;
  return (
    <svg width={t} height={Math.round(t * 13 / 11)} viewBox="0 0 11 13" fill="none" stroke="currentColor" strokeWidth="1.3"
      strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-2px", flex: "none", ...(estilo || {}) }} aria-hidden="true">
      <path d="M1.2 1.2h5.4l3.2 3.2v7.4H1.2z" /><path d="M6.6 1.2v3.2h3.2" /><path d="M3.3 8.1l1.5 1.5 2.9-3" />
    </svg>
  );
}
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
function GraficoFluxoMensal({ fluxo, hojeIso, onEscolherMes, mesSelecionado, uid: idGrafico, series, faixas: faixasProp, marcos, aoClicarMarco, aoMoverMarco }) {
  // a chamada sendo arrastada: { chave, ddx, ddy } (pixels desde o início)
  const [arrasto, setArrasto] = useState(null);
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
  const todasFaixas = faixasProp || CP_FAIXAS;
  const chaves = series && series.length ? series : (faixasProp ? faixasProp.map((f) => f[0]) : ["aberto"]);
  const faixasDaVez = todasFaixas.filter((f) => chaves.indexOf(f[0]) >= 0);
  const valorDoMes = (m) => chaves.reduce((a, k) => a + (Number(m[k]) || 0), 0);
  const maior = fluxo.meses.reduce((a, m) => Math.max(a, valorDoMes(m)), 0);
  // os marcos (liberação da Caixa) ganham duas linhas no topo
  const listaMarcos = (marcos || []).filter((z) => fluxo.meses.some((m) => m.chave === z.chave));
  const xMarco = (z) => fluxo.meses.findIndex((m) => m.chave === z.chave) * (40 + 16) + 16 / 2 + 40 / 2;
  const larguraBarras = Math.max(fluxo.meses.length * (40 + 16), 220);
  const posMarcos = cpLinhasDosMarcos(listaMarcos.map((z) => ({ x: xMarco(z), largura: 4 + z.rotulo.length * 5.7 })), larguraBarras, 6);
  // chamada arrastada para cima ganha espaço no topo
  const SOBE = Math.max(0, ...listaMarcos.map((z) => -(Number(z.dy) || 0))) * 15;
  const TOPO = listaMarcos.length ? 8 + SOBE + (Math.max(0, ...posMarcos.map((pm) => pm.linha)) + 1) * 15 : 0;
  const LARG = 40, ESPACO = 16, ALT = 130, BASE = TOPO + ALT + 16;
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
      <svg width={largura} height={TOPO + ALT + 46} role="img" style={{ display: "block" }}>
        {listaMarcos.map((z, q) => {
          const i = fluxo.meses.findIndex((m) => m.chave === z.chave);
          const m = fluxo.meses[i];
          const cx = i * (LARG + ESPACO) + ESPACO / 2 + LARG / 2;
          const vivo = arrasto && arrasto.chave === z.chave ? arrasto : null;
          const dxPx = (Number(z.dx) || 0) * (LARG + ESPACO) + (vivo ? vivo.ddx : 0);
          const dyPx = (Number(z.dy) || 0) * 15 + (vivo ? vivo.ddy : 0);
          const larg = 4 + z.rotulo.length * 5.7;
          const ini = Math.max(0, Math.min(largura - larg, posMarcos[q].inicio + dxPx));
          const yTxt = Math.max(2, 11 + SOBE + posMarcos[q].linha * 15 + dyPx);
          const yBarra = BASE - altura(valorDoMes(m)) - 19;
          // a linha sai do topo da barra; se o nome foi para o lado, dobra
          // e chega na ponta mais perto do nome
          const deLado = cx < ini - 2 || cx > ini + larg;
          const xPonta = cx < ini ? ini - 3 : ini + larg + 1;
          const yLinha = deLado ? yTxt - 1 : yTxt + 4;
          const pegar = aoMoverMarco ? (e) => {
            e.preventDefault(); e.stopPropagation();
            const x0 = e.clientX, y0 = e.clientY;
            let ultimo = { ddx: 0, ddy: 0 };
            const mover = (ev) => { ultimo = { ddx: ev.clientX - x0, ddy: ev.clientY - y0 }; setArrasto({ chave: z.chave, ...ultimo }); };
            const soltar = () => {
              window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", soltar);
              setArrasto(null);
              if (Math.abs(ultimo.ddx) < 4 && Math.abs(ultimo.ddy) < 4) { if (aoClicarMarco) aoClicarMarco(z.chave); return; }
              aoMoverMarco(z.chave, (Number(z.dx) || 0) + ultimo.ddx / (LARG + ESPACO), (Number(z.dy) || 0) + ultimo.ddy / 15);
            };
            window.addEventListener("pointermove", mover); window.addEventListener("pointerup", soltar);
          } : undefined;
          return (
            <g key={"marco" + z.chave} data-vk-marco={z.chave}
              onClick={aoClicarMarco && !aoMoverMarco ? (e) => { e.stopPropagation(); aoClicarMarco(z.chave); } : undefined}
              style={{ cursor: aoMoverMarco ? (vivo ? "grabbing" : "grab") : aoClicarMarco ? "pointer" : "default" }}>
              {(aoClicarMarco || aoMoverMarco) && <title>{aoMoverMarco ? "Arraste para mudar de lugar; clique para mudar o texto ou apagar" : "Clique para mudar o texto ou apagar"}</title>}
              <polyline points={deLado ? `${cx},${Math.max(yLinha + 1, yBarra)} ${cx},${yLinha} ${xPonta},${yLinha}` : `${cx},${Math.max(yLinha + 1, yBarra)} ${cx},${yLinha}`}
                fill="none" stroke="#9ca3af" strokeWidth="1" />
              <circle cx={deLado ? xPonta : cx} cy={yLinha} r="2" fill="#9ca3af" />
              {aoMoverMarco && <rect data-vk-marco-pegar="1" x={ini - 3} y={yTxt - 9} width={larg + 6} height={15} fill="transparent"
                onPointerDown={pegar} style={{ touchAction: "none" }} />}
              <text x={ini} y={yTxt + 3} fontSize="11" fontWeight="600" fill={vivo ? "#0474f4" : "#374151"} onPointerDown={pegar}
                style={{ touchAction: aoMoverMarco ? "none" : undefined, userSelect: "none" }}>{z.rotulo}</text>
            </g>
          );
        })}
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
              <title>{`${m.chave === "pre" ? "Pré-obra" : rotuloMes(m.chave)} — ${fmtMoedaCtr(valorMes)}`}</title>
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

// ── UI — os parâmetros da prestação de contas ────────────────────
// Abre ao clicar em Prestação de contas: o regime das despesas e o das
// entradas, o início da obra (o que veio antes vira "pré-obra") e o término
// estimado (o fluxo de caixa distribui o que falta até lá). Fecha só por
// Cancelar.
function JanelaParametrosPrestacao({ valor, obra, aoMudar, aoCancelar, aoGerar, modulos, nomeEmpreendimento }) {
  const v = valor || {};
  const mudar = (campo, x) => aoMudar({ ...v, [campo]: x, erro: "" });
  const todos = !!(modulos && modulos.length > 1 && v.abrangencia === "todos");
  const datasMods = todos ? cpDatasDosModulos(modulos, v.datasModulos) : [];
  const mudarData = (id, campo, x) => {
    const atual = (v.datasModulos || {})[id] || {};
    const d = datasMods.find((y) => y.id === id) || {};
    aoMudar({ ...v, datasModulos: { ...(v.datasModulos || {}), [id]: { inicio: d.inicio, termino: d.termino, ...atual, [campo]: x } }, erro: "" });
  };
  const semTermino = datasMods.filter((d) => !d.termino);
  const opcao = (campo, id, rot, desc) => {
    const on = v[campo] === id;
    return (
      <button type="button" key={id} data-vk-param={campo + ":" + id} aria-pressed={on} onClick={() => mudar(campo, id)}
        style={{ flex: "1 1 160px", textAlign: "left", padding: "9px 12px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
          border: on ? "1.5px solid #0474f4" : "1px solid rgba(38,36,33,0.16)", background: on ? "#f2f7ff" : "#fff" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{rot}</div>
        <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2, lineHeight: 1.4 }}>{desc}</div>
      </button>
    );
  };
  const rot = { fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 };
  const inp = { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(38,36,33,0.2)", fontSize: 13, fontFamily: "inherit" };
  return (
    <div role="dialog" aria-modal="true" aria-label="Parâmetros da prestação de contas" data-vk-param-prestacao="1"
      style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "calc(100vh - 32px)", overflowY: "auto",
        boxSizing: "border-box", padding: 20, boxShadow: "0 18px 40px rgba(0,0,0,0.18)", fontFamily: "inherit" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Prestação de contas</div>
        <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 4, marginBottom: 16 }}>{(obra && obra.nome) || ""} · defina como os números são montados.</div>
        {modulos && modulos.length > 1 && <>
          <div style={rot}>Abrangência</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {opcao("abrangencia", "modulo", "Só este módulo", (obra && obra.nome) || "")}
            {opcao("abrangencia", "todos", "Todo o empreendimento", `${nomeEmpreendimento || "Empreendimento"} — ${modulos.length} módulos juntos, com um quadro por módulo`)}
          </div>
        </>}
        <div style={rot}>Despesas</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {opcao("despesa", "caixa", "Regime de caixa", "Pela data em que o dinheiro saiu. Mostra o que ainda está a pagar.")}
          {opcao("despesa", "competencia", "Competência", "Pelo mês em que o custo foi contabilizado (a compra), pago ou não. Sem a coluna A pagar.")}
        </div>
        <div style={rot}>Entradas</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {opcao("entrada", "caixa", "Regime de caixa", "Pela data em que o dinheiro entrou; o resto no vencimento.")}
          {opcao("entrada", "competencia", "Competência", "Cada parcela no mês do vencimento, recebida ou não.")}
        </div>
        {todos && (
          <div data-vk-param-datas-modulos="1">
            <label style={{ display: "block", marginBottom: 14 }}>
              <div style={rot}>Início do empreendimento</div>
              <input type="date" style={{ ...inp, maxWidth: 260 }} value={v.inicioEmp || ""} data-vk-param-inicio-emp="1" onChange={(e) => mudar("inicioEmp", e.target.value)} />
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>O que veio antes entra junto, em Despesas pré-obra; daí em diante, mês a mês.</div>
            </label>
            <div style={rot}>Datas de cada módulo</div>
            <div style={{ fontSize: 11.5, color: "#6b7280", marginBottom: 8, lineHeight: 1.4 }}>
              O custo que falta de cada módulo é dividido do início ao término dele (o que já começou, de hoje ao término).
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {datasMods.map((d) => (
                <div key={d.id} data-vk-param-modulo={d.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 8,
                  padding: "8px 10px", border: "1px solid rgba(38,36,33,0.12)", borderRadius: 10 }}>
                  <div style={{ gridColumn: "1 / -1", fontSize: 12.5, fontWeight: 600, color: "#111827" }}>{d.nome}</div>
                  <label style={{ display: "block", minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 3 }}>Início</div>
                    <input type="date" style={inp} value={d.inicio || ""} data-vk-param-modulo-inicio={d.id} onChange={(e) => mudarData(d.id, "inicio", e.target.value)} />
                  </label>
                  <label style={{ display: "block", minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 3 }}>Término estimado</div>
                    <input type="date" style={inp} value={d.termino || ""} data-vk-param-modulo-termino={d.id} onChange={(e) => mudarData(d.id, "termino", e.target.value)} />
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
        {!todos && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <label style={{ display: "block" }}>
            <div style={rot}>Início da obra</div>
            <input type="date" style={inp} value={v.inicio || ""} data-vk-param-inicio="1" onChange={(e) => mudar("inicio", e.target.value)} />
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>O que veio antes entra junto, em Despesas pré-obra.</div>
          </label>
          <label style={{ display: "block" }}>
            <div style={rot}>Término estimado</div>
            <input type="date" style={inp} value={v.termino || ""} data-vk-param-termino="1" onChange={(e) => mudar("termino", e.target.value)} />
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>O fluxo de caixa divide o custo que falta até aqui.</div>
          </label>
        </div>}
        {v.erro && <div style={{ fontSize: 12.5, color: "#b91c1c", marginTop: 12 }} data-vk-param-erro="1">{v.erro}</div>}
        {!todos && !v.termino && <div style={{ fontSize: 12, color: "#92400e", marginTop: 12 }}>Sem o término estimado, a prestação sai sem o fluxo de caixa.</div>}
        {todos && semTermino.length > 0 && <div style={{ fontSize: 12, color: "#92400e", marginTop: 12 }}>
          Sem término: {semTermino.map((d) => d.nome).join(", ")}. Se algum deles ainda tiver custo a realizar, a prestação sai sem o fluxo de caixa.</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button type="button" onClick={aoCancelar} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(38,36,33,0.2)",
            background: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
          <button type="button" data-vk-param-gerar="1" onClick={aoGerar} style={{ padding: "8px 16px", borderRadius: 10, border: "none",
            background: "#0474f4", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Ver prévia →</button>
        </div>
      </div>
    </div>
  );
}

// ── UI — a prévia da prestação ───────────────────────────────────
// Os números e os gráficos, antes de baixar os comprovantes (que demora).
// Confirmada, gera o pacote. Voltar reabre os parâmetros; Cancelar fecha.
function GraficoSaldoAcumulado({ linhas, mesHoje }) {
  if (!linhas || !linhas.length) return null;
  // barras: o resultado do mês (azul / vermelho vivo); linha: o saldo
  // acumulado do dinheiro, com o valor em cada ponto
  const LARG = 40, ESPACO = 16, ALT = 170, TOPO = 22;
  const vals = linhas.reduce((t, l) => t.concat([l.resultado, l.acumulado]), []);
  const maxPos = Math.max(0, ...vals), maxNeg = Math.max(0, ...vals.map((v) => -v));
  const tot = Math.max(1, maxPos + maxNeg);
  // o lado negativo tem um mínimo, senão some quando o positivo é bem maior
  const hNeg = maxNeg > 0 ? Math.max(ALT * maxNeg / tot, 60) : 0, hPos = ALT - hNeg;
  const base = TOPO + hPos;
  const esc = (v) => (v >= 0 ? (maxPos ? v / maxPos * hPos : 0) : (maxNeg ? v / maxNeg * Math.max(0, hNeg - 14) : 0));
  const largura = Math.max(linhas.length * (LARG + ESPACO), 220);
  const cx = (i) => i * (LARG + ESPACO) + ESPACO / 2 + LARG / 2;
  const curto = (v) => { const a = Math.abs(v); const t = a >= 1000 ? Math.round(a / 1000) + "k" : a > 0 ? String(Math.round(a)) : "0"; return v < 0 && a > 0 ? "-" + t : t; };
  const VIVO = "#ef4444", NAVY = "#111827";
  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <svg width={largura} height={TOPO + ALT + 34} role="img" style={{ display: "block" }}>
          {linhas.map((l, i) => {
            const h = Math.abs(esc(l.resultado));
            return (
              <g key={l.chave}>
                <title>{`${l.rotulo} — resultado do mês ${fmtMoedaCtr(l.resultado)} · saldo acumulado ${fmtMoedaCtr(l.acumulado)}`}</title>
                {h > 0.5 && <rect x={cx(i) - LARG * 0.42} y={l.resultado >= 0 ? base - h : base} width={LARG * 0.84} height={h} rx="4" fill={l.resultado < 0 ? VIVO : "#0474f4"} opacity="0.9" />}
                <text x={cx(i)} y={TOPO + ALT + 22} textAnchor="middle" fontSize="11" fill={l.chave === mesHoje ? "#111827" : "#4b5563"} fontWeight={l.chave === mesHoje ? 700 : 400}>{l.rotulo}</text>
              </g>
            );
          })}
          <line x1="0" y1={base + 0.5} x2={largura} y2={base + 0.5} stroke="rgba(38,36,33,0.25)" strokeWidth="1" />
          <polyline fill="none" stroke={NAVY} strokeWidth="2.2" strokeLinejoin="round" points={linhas.map((l, i) => `${cx(i)},${base - esc(l.acumulado)}`).join(" ")} />
          {linhas.map((l, i) => {
            const py = base - esc(l.acumulado);
            const cor = l.acumulado < 0 ? VIVO : NAVY;
            return (
              <g key={"p" + l.chave}>
                <circle cx={cx(i)} cy={py} r="4" fill="#fff" stroke={cor} strokeWidth="2" />
                <text x={cx(i)} y={l.acumulado < 0 ? py + 17 : py - 9} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={cor}
                  stroke="#fff" strokeWidth="3" paintOrder="stroke">{curto(l.acumulado)}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: "#374151", marginTop: 6 }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#0474f4", borderRadius: 2, marginRight: 5 }} />Resultado do mês (positivo)</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: VIVO, borderRadius: 2, marginRight: 5 }} />Resultado do mês (negativo)</span>
        <span><span style={{ display: "inline-block", width: 16, height: 2.5, background: NAVY, marginRight: 5, verticalAlign: "middle" }} />Saldo acumulado do dinheiro</span>
      </div>
    </div>
  );
}
// O anel do percentual realizado (tela da prévia)
function AnelRealizado({ pct, tam }) {
  if (pct == null) return <span style={{ color: "#9ca3af" }}>—</span>;
  const t = tam || 22, r = t / 2 - 3, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, pct / 100));
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }} data-vk-anel-realizado={pct}>
      <svg width={t} height={t} viewBox={`0 0 ${t} ${t}`} style={{ flex: "0 0 auto" }} role="img" aria-label={cpPctTexto(pct) + " realizado"}>
        <circle cx={t / 2} cy={t / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        {f > 0 && <circle cx={t / 2} cy={t / 2} r={r} fill="none" stroke={pct > 100 ? "#ef4444" : "#0474f4"} strokeWidth="4"
          strokeDasharray={`${c * f} ${c}`} transform={`rotate(-90 ${t / 2} ${t / 2})`} strokeLinecap="butt" />}
      </svg>
      <span>{cpPctTexto(pct)}</span>
    </span>
  );
}
// A janela de uma linha de chamada: o texto do mês, Salvar, Apagar (se já
// existe) e Cancelar. Não fecha clicando fora.
function JanelaMarcoDoGrafico({ marco, aoSalvar, aoApagar, aoCancelar }) {
  const [texto, setTexto] = useState((marco && marco.texto) || "");
  const mes = marco && marco.mes ? cpRotuloBalde(marco.mes) : "";
  const btn = { padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
  return (
    <div role="dialog" aria-modal="true" aria-label="Linha de chamada" data-vk-janela-marco="1"
      style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 420, boxSizing: "border-box", padding: 18, boxShadow: "0 18px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Linha de chamada · {mes}</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, marginBottom: 12 }}>O texto aparece em cima da barra do mês, no gráfico e no PDF.</div>
        <input autoFocus value={texto} maxLength={60} data-vk-marco-texto="1" placeholder="Digite o texto da chamada"
          onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && texto.trim()) aoSalvar(texto); if (e.key === "Escape") aoCancelar(); }}
          style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 10, border: "1px solid rgba(38,36,33,0.2)", fontSize: 14, fontFamily: "inherit" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {marco && marco.existe && <button type="button" data-vk-marco-apagar="1" onClick={aoApagar}
            style={{ ...btn, marginRight: "auto", background: "#fff", color: "#b91c1c", border: "1px solid #fca5a5" }}>Apagar</button>}
          <button type="button" data-vk-marco-cancelar="1" onClick={aoCancelar} style={{ ...btn, background: "#fff", color: "#374151", border: "1px solid rgba(38,36,33,0.2)" }}>Cancelar</button>
          <button type="button" data-vk-marco-salvar="1" disabled={!texto.trim()} onClick={() => aoSalvar(texto)}
            style={{ ...btn, background: texto.trim() ? "#0474f4" : "#93c5fd", color: "#fff", border: "1px solid transparent" }}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

function PreviaDaPrestacao({ previa, obra, isMobile, aoVoltar, aoCancelar, aoGerar, aoGerarPdf, aoMudarMarco, aoMoverMarco }) {
  const p = previa.param || {};
  // a linha de chamada sendo posta ou editada: { mes, texto, existe }
  const [marcoEmEdicao, setMarcoEmEdicao] = useState(null);
  const { pc, ffPC: ff, cfPC: cf, cmPC: cm, rmPC: rm, fcPC: fc, modulosPC: mods, ctPC: ct, prPC: pr } = previa.dados || {};
  const comp = ff && ff.regime === "competencia";
  const moeda = (v) => (v < -0.004 ? "-R$ " : "R$ ") + Math.abs(Number(v || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dia = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : "—"; };
  const reg = (r) => (r === "competencia" ? "competência" : "caixa");
  const hoje = new Date().toISOString().slice(0, 10);
  const caixa = { border: "1px solid rgba(38,36,33,0.12)", borderRadius: 12, padding: "14px 16px", background: "#fff", minWidth: 0 };
  const titulo = (n, t, nota) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ background: "#0474f4", color: "#fff", borderRadius: 6, width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{n}</span>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: "#111827" }}>{t}</span>
      </div>
      {nota && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, lineHeight: 1.45 }}>{nota}</div>}
    </div>
  );
  const legenda = (faixas, meses) => (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: "#374151", marginTop: 6 }}>
      {faixas.filter((f) => (meses || []).some((m) => Number(m[f[0]]) > 0)).map((f) => (
        <span key={f[0]}><span style={{ display: "inline-block", width: 10, height: 10, background: f[1], borderRadius: 2, marginRight: 5 }} />{f[2]}</span>
      ))}
    </div>
  );
  const cartao = (rot, v, cor) => (
    <div style={{ ...caixa, padding: "10px 12px" }}>
      <div style={{ fontSize: 10.5, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 }}>{rot}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: cor || "#111827", marginTop: 2 }}>{moeda(v)}</div>
    </div>
  );
  const th = { padding: "6px 8px", fontWeight: 600, color: "#fff", background: "#1e3a5f", whiteSpace: "nowrap", fontSize: 11.5 };
  const td = { padding: "5px 8px", whiteSpace: "nowrap", fontSize: 11.5, borderBottom: "1px solid #f1f5f9" };
  const n = (v) => (Math.abs(v) > 0.004 ? moeda(v) : "—");
  let k = 0;
  const botoes = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
      <button type="button" onClick={aoCancelar} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(38,36,33,0.2)", background: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
      <button type="button" data-vk-previa-voltar="1" onClick={aoVoltar} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(38,36,33,0.2)", background: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>← Parâmetros</button>
      {aoGerarPdf && <button type="button" data-vk-previa-pdf="1" onClick={aoGerarPdf} title="Só o relatório em PDF, sem baixar os comprovantes (rápido)"
        style={{ padding: "8px 16px", borderRadius: 10, border: "1.5px solid #0474f4", background: "#fff", color: "#0474f4", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Gerar PDF</button>}
      <button type="button" data-vk-previa-gerar="1" onClick={aoGerar} title="O pacote completo: o PDF, a planilha e todos os comprovantes"
        style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#0474f4", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Gerar com comprovantes</button>
    </div>
  );
  return (
    <div role="dialog" aria-modal="true" aria-label="Prévia da prestação de contas" data-vk-previa-prestacao="1"
      style={{ position: "fixed", inset: 0, zIndex: 1200, background: "#f5f7fa", overflowY: "auto" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "14px 12px 40px" : "20px 24px 48px", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: "#111827" }}>Prévia da prestação de contas</div>
            <div style={{ fontSize: 12.5, color: "#4b5563", marginTop: 3 }}>{(obra && obra.nome) || ""} · Despesas: {reg(p.despesa)} · Entradas: {reg(p.entrada)} · {p.datasModulos ? `Início do empreendimento: ${dia(p.inicio)}` : `Início: ${dia(p.inicio)} · Término: ${dia(p.termino)}`}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>Confira os números. Gerar PDF baixa só o relatório (rápido); Gerar com comprovantes baixa o pacote completo, com a planilha e os arquivos.</div>
          </div>
          {botoes}
        </div>
        {ff && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, minmax(0, 1fr))", gap: 10 }}>
            {cartao("Custo estimado", ff.total.estimado)}
            {cartao(comp ? "Custo realizado" : "Custo pago", ff.total.realizado)}
            {!comp && cartao("A pagar", ff.total.aPagar, "#0474f4")}
            {rm && cartao("Recebido", rm.total.recebido)}
            {fc && !fc.erro && cartao("Resultado projetado", fc.total.resultado, fc.total.resultado < 0 ? "#b91c1c" : "#166534")}
          </div>
        )}
        {mods && mods.length > 0 && (
          <div style={caixa} data-vk-previa-modulos="1">
            {titulo(++k, "Por módulo")}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 780, borderCollapse: "collapse" }}>
                <thead><tr>{["Módulo", "% realizado"].concat(CP_COLUNAS_POR_MODULO.map((c) => c[1])).map((t, j) =>
                  <th key={t} style={{ ...th, textAlign: j > 1 ? "right" : "left" }}>{t}</th>)}</tr></thead>
                <tbody>
                  {mods.map((m) => (
                    <tr key={m.id} data-vk-modulo-linha={m.id}>
                      <td style={td}>{m.nome}</td>
                      <td style={{ ...td, paddingTop: 3, paddingBottom: 3 }}><AnelRealizado pct={cpPercentualRealizado(mods).porId[m.id]} /></td>
                      {CP_COLUNAS_POR_MODULO.map((c) => <td key={c[0]} style={{ ...td, textAlign: "right" }}>{n(m[c[0]])}</td>)}
                    </tr>
                  ))}
                  <tr style={{ background: "#f6f8fb" }}>
                    <td style={{ ...td, fontWeight: 700 }}>Empreendimento</td>
                    <td style={{ ...td, fontWeight: 700, paddingTop: 3, paddingBottom: 3 }}><AnelRealizado pct={cpPercentualRealizado(mods).total} /></td>
                    {CP_COLUNAS_POR_MODULO.map((c) =>
                      <td key={c[0]} style={{ ...td, textAlign: "right", fontWeight: 700 }}>{moeda(mods.reduce((t, m) => t + (Number(m[c[0]]) || 0), 0))}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
        {cm && cm.meses.length > 0 && (
          <div style={caixa} data-vk-previa-custos="1">
            {titulo(++k, comp ? "Custos realizados mês a mês" : "Custos mês a mês")}
            <GraficoFluxoMensal fluxo={{ meses: cm.meses }} hojeIso={hoje} series={cm.series}
              faixas={comp ? [["custo", "#0474f4", "Custo realizado"]] : CP_FAIXAS} />
            {legenda(comp ? [["custo", "#0474f4", "Custo realizado"]] : CP_FAIXAS, cm.meses)}
          </div>
        )}
        {rm && rm.meses.length > 0 && (
          <div style={caixa} data-vk-previa-receb="1">
            {titulo(++k, "Recebimentos mês a mês", "Contratos realizados e vendas estimadas, baseadas na procura e nos novos cadastros de clientes.")}
            <GraficoFluxoMensal fluxo={{ meses: rm.meses }} hojeIso={hoje} faixas={CP_FAIXAS_RECEB} marcos={rm.marcos || []}
              onEscolherMes={aoMudarMarco ? (mes) => { if (mes === "pre") return; const z = (rm.marcos || []).find((x) => x.chave === mes);
                setMarcoEmEdicao({ mes, texto: z ? z.rotulo : "", existe: !!z }); } : undefined}
              aoClicarMarco={aoMudarMarco ? (mes) => { const z = (rm.marcos || []).find((x) => x.chave === mes);
                setMarcoEmEdicao({ mes, texto: z ? z.rotulo : "", existe: !!z }); } : undefined}
              aoMoverMarco={aoMoverMarco || undefined} />
            {legenda(CP_FAIXAS_RECEB, rm.meses)}
            {aoMudarMarco && <div data-vk-marco-dica="1" style={{ fontSize: 11.5, color: "#6b7280", marginTop: 6 }}>
              Clique num mês para pôr uma linha de chamada; arraste a chamada para mudar de lugar; clique nela para mudar o texto ou apagar.</div>}
            {marcoEmEdicao && <JanelaMarcoDoGrafico marco={marcoEmEdicao} aoCancelar={() => setMarcoEmEdicao(null)}
              aoSalvar={(texto) => { aoMudarMarco(marcoEmEdicao.mes, texto); setMarcoEmEdicao(null); }}
              aoApagar={() => { aoMudarMarco(marcoEmEdicao.mes, ""); setMarcoEmEdicao(null); }} />}
          </div>
        )}
        {fc && (
          <div style={caixa} data-vk-previa-fluxo="1">
            {fc.erro ? titulo(++k, "Fluxo de Caixa Livre", fc.erro + " Volte aos parâmetros para informar.") : <>
              {titulo(++k, "Fluxo de Caixa Livre", "Fluxo de caixa livre, demonstrando a dinâmica entre períodos de investimento e de vendas.")}
              <GraficoSaldoAcumulado linhas={fc.linhas} mesHoje={fc.mesHoje} />
              <div style={{ overflowX: "auto", marginTop: 10 }}>
                <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse" }}>
                  <thead><tr>{["Mês", "Custo realizado", "Custo a realizar", "Recebido", "A receber previsto", "Resultado do mês", "Acumulado"].map((t, j) =>
                    <th key={t} style={{ ...th, textAlign: j ? "right" : "left" }}>{t}</th>)}</tr></thead>
                  <tbody>{fc.linhas.map((l) => (
                    <tr key={l.chave}>
                      <td style={{ ...td, fontWeight: l.chave === fc.mesHoje ? 700 : 400 }}>{l.rotulo}</td>
                      {[l.custoRealizado, l.custoARealizar, l.recebido, l.recebimentoPrevisto].map((v, j) => <td key={j} style={{ ...td, textAlign: "right" }}>{n(v)}</td>)}
                      <td style={{ ...td, textAlign: "right", color: l.resultado < 0 ? "#b91c1c" : "#111827" }}>{moeda(l.resultado)}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 600, color: l.acumulado < 0 ? "#b91c1c" : "#166534" }}>{moeda(l.acumulado)}</td>
                    </tr>))}
                    <tr style={{ background: "#f6f8fb" }} data-vk-fluxo-total="1">
                      <td style={{ ...td, fontWeight: 700 }}>Total</td>
                      {[fc.total.custoRealizado, fc.total.custoARealizar, fc.total.recebido, fc.total.recebimentoPrevisto, fc.total.resultado].map((v, j) =>
                        <td key={j} style={{ ...td, textAlign: "right", fontWeight: 700 }}>{moeda(v)}</td>)}
                      <td style={td}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>}
          </div>
        )}
        {ff && (
          <div style={caixa} data-vk-previa-ff="1">
            {titulo(++k, "Físico-financeiro")}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: comp ? 520 : 640, borderCollapse: "collapse" }}>
                <thead><tr>{["Conta", "Estimado", comp ? "Realizado (lançado)" : "Realizado (pago)"].concat(comp ? [] : ["A pagar"]).concat(["Saldo"]).map((t, j) =>
                  <th key={t} style={{ ...th, textAlign: j ? "right" : "left" }}>{t}</th>)}</tr></thead>
                <tbody>
                  {ff.blocos.map((b) => [
                    <tr key={b.grupoId} style={{ background: "#eef3fa" }}>
                      <td style={{ ...td, fontWeight: 700 }}>{b.titulo}{b.noTotal ? "" : " (fora do custo)"}</td>
                      {[b.estimado, b.realizado].concat(comp ? [] : [b.aPagar]).concat([b.saldo]).map((v, j) => <td key={j} style={{ ...td, textAlign: "right", fontWeight: 700 }}>{moeda(v)}</td>)}
                    </tr>,
                    ...b.linhas.map((l) => (
                      <tr key={b.grupoId + l.contaId}>
                        <td style={{ ...td, paddingLeft: 18 }}>{l.conta}</td>
                        {[l.estimado, l.realizado].concat(comp ? [] : [l.aPagar]).map((v, j) => <td key={j} style={{ ...td, textAlign: "right" }}>{moeda(v)}</td>)}
                        <td style={{ ...td, textAlign: "right", color: l.saldo < -0.004 ? "#b91c1c" : "#111827" }}>{moeda(l.saldo)}</td>
                      </tr>)),
                  ])}
                  <tr style={{ background: "#f6f8fb" }}>
                    <td style={{ ...td, fontWeight: 700 }}>Custo da obra</td>
                    {[ff.total.estimado, ff.total.realizado].concat(comp ? [] : [ff.total.aPagar]).concat([ff.total.saldo]).map((v, j) => <td key={j} style={{ ...td, textAlign: "right", fontWeight: 700 }}>{moeda(v)}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
            {cf && (
              <div data-vk-previa-confere="1" style={{ fontSize: 12.5, marginTop: 10, color: cf.confere ? "#166534" : "#b91c1c" }}>
                {cf.confere ? "✓ Confere com as notas desta prestação" : `Diferença sem explicação entre o físico-financeiro e as notas: ${moeda(cf.diferenca)}`}
                <span style={{ color: "#6b7280" }}> · notas pagas {moeda(cf.totalNotas)}{cf.foraDoPeriodo ? ` · fora do período ${moeda(cf.foraDoPeriodo)}` : ""}{cf.naoPago ? ` · lançado não pago ${moeda(cf.naoPago)}` : ""}{cf.foraDoFF ? ` · fora do custo ${moeda(cf.foraDoFF)}` : ""}</span>
              </div>
            )}
          </div>
        )}
        {ct && ct.length > 0 && (
          <div style={caixa} data-vk-previa-contratos="1">
            {titulo(++k, "Contratos firmes", "Vendas feitas, com o comprador pagando. Valor do contrato = venda − desconto + juros + documentação.")}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#111827", alignSelf: "center" }}>{ct.length} {ct.length === 1 ? "contrato" : "contratos"}</div>
              {[["Valor dos contratos", ct.reduce((t, c) => t + c.total, 0), "#111827"], ["Recebido", ct.reduce((t, c) => t + c.recebido, 0), "#111827"],
                ["A receber", ct.reduce((t, c) => t + c.aReceber, 0), "#111827"]].map(([r, v, cr]) => (
                <div key={r}>
                  <div style={{ fontSize: 10.5, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.3 }}>{r}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: cr }}>{moeda(v)}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              {ct.map((c) => {
                const uni = String(c.unidade || "").split(" · ").pop() || "—";
                const f = c.total > 0 ? Math.max(0, Math.min(1, c.recebido / c.total)) : 0;
                const direto = c.sinal + c.parcelas.soma;
                const comoPaga = [direto > 0.004 ? [(c.parcelas.n ? `Sinal e ${c.parcelas.n} parcelas` : "Sinal") + cpPeriodoDireto(c), direto] : null,
                  c.financiamento > 0.004 ? [`Financiamento${c.financiamentoEm ? " (" + dia(c.financiamentoEm).slice(3) + ")" : ""}`, c.financiamento] : null].filter(Boolean);
                return (
                  <div key={c.id} data-vk-contrato={c.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", padding: "12px 14px", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#111827", whiteSpace: "nowrap" }}>{uni}</span>
                      <span style={{ fontSize: 12.5, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.comprador}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginTop: 8 }}>
                      <span style={{ fontSize: 19, fontWeight: 700, color: "#111827" }}>{moeda(c.total)}</span>
                      <span style={{ fontSize: 11.5, color: "#6b7280", whiteSpace: "nowrap" }}>{Math.round(f * 100)}% recebido</span>
                    </div>
                    <div style={{ height: 5, background: "#e5e7eb", borderRadius: 3, marginTop: 4, overflow: "hidden" }}>
                      <div style={{ width: (f * 100) + "%", height: "100%", background: "#0474f4" }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, comoPaga.length)}, minmax(0, 1fr))`, gap: 8, marginTop: 10 }}>
                      {comoPaga.map(([r, v]) => (
                        <div key={r} style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>{r}</div>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: "#111827" }}>{moeda(v)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {pr && typeof GraficoProcura === "function" && (
          <div style={caixa} data-vk-previa-procura="1">
            {titulo(++k, "Cadastros de novos Clientes no site", `Simulações feitas no site, por data de cadastro, de ${dia(pr.de)} a ${dia(pr.ate)}.`)}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 10 }}>
              {[["Cadastros", pr.total], ["Últimos 7 dias", pr.ultimos7], ["Últimos 14 dias", pr.ultimos14], ["Melhor dia", `${pr.melhorDia.n} em ${dia(pr.melhorDia.iso).slice(0, 5)}`]].map(([r2, v]) => (
                <div key={r2}>
                  <div style={{ fontSize: 10.5, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.3 }}>{r2}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{v}</div>
                </div>
              ))}
            </div>
            <GraficoProcura resumo={pr} />
            <div style={{ fontSize: 12.5, color: "#111827", fontWeight: 600, marginTop: 6 }}>Alto potencial em conversão de vendas.</div>
          </div>
        )}
        <div style={{ ...caixa, fontSize: 12.5, color: "#374151" }}>
          No pacote: {pc ? pc.notas.length : 0} notas, {pc ? pc.arquivos.length : 0} arquivos de comprovante{pc && (pc.semArquivo + pc.semNumero) ? `, ${pc.semArquivo + pc.semNumero} pendências` : ""}{ff && ff.aPagarLista.length ? `, ${ff.aPagarLista.length} contas a pagar` : ""}.
        </div>
        {botoes}
      </div>
    </div>
  );
}

// ── UI — o recebimento da obra ───────────────────────────────────
// O cronograma de recebimento que se espera do cliente, digitado mês a
// mês, contra o que ele já depositou e o custo da obra no mesmo mês. É o
// mesmo cálculo que vai na prestação de contas.
function RecebimentoDaObraView({ obra, podeEditar, aoSalvar, isMobile, fmtBRL }) {
  const inicial = (obra && obra.cronogramaRecebimento) || [];
  const [lista, setLista] = useState(inicial.map((x) => ({ ...x })));
  const [aviso, setAviso] = useState("");
  const numero = (v) => (typeof numeroDeCampo === "function" ? numeroDeCampo(v) : Number(String(v).replace(/\./g, "").replace(",", "."))) || 0;
  const assinatura = (l) => JSON.stringify(l.map((x) => [x.mes, numero(x.valor), x.tipo === "assinar" ? "assinar" : "estimativa", x.obs || ""]));
  const sujo = assinatura(lista) !== assinatura(inicial);
  const limpa = lista.filter((x) => /^\d{4}-\d{2}$/.test(String(x.mes || "")) && numero(x.valor) > 0)
    .map((x) => ({ id: x.id, mes: x.mes, valor: Math.round(numero(x.valor) * 100) / 100, tipo: x.tipo === "assinar" ? "assinar" : "estimativa",
      ...(String(x.obs || "").trim() ? { obs: String(x.obs).trim() } : {}) }));
  const ini = /^\d{4}-\d{2}-\d{2}/.test(String((obra || {}).dataInicio || "")) ? String(obra.dataInicio).slice(0, 10) : "";
  const rm = recebimentosMensais({ ...(obra || {}), cronogramaRecebimento: limpa }, { regime: "caixa", inicio: ini });
  const cm = custosMensais(obra, { regime: "caixa", inicio: ini });
  const moeda = fmtBRL || ((v) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const proxMes = () => {
    const ult = lista.map((x) => x.mes).filter(Boolean).sort().pop() || new Date().toISOString().slice(0, 7);
    let [a, m] = ult.split("-").map(Number); m += lista.length ? 1 : 0; if (m > 12) { m = 1; a += 1; }
    return a + "-" + String(m).padStart(2, "0");
  };
  const mudar = (k, campo, v) => setLista((l) => l.map((x, i) => (i === k ? { ...x, [campo]: v } : x)));
  const salvar = () => {
    const chaves = limpa.map((x) => x.mes + "|" + x.tipo);
    if (new Set(chaves).size !== chaves.length) { setAviso("Há mês repetido com o mesmo tipo: junte os valores numa linha só."); return; }
    setAviso("");
    aoSalvar(limpa.map((x) => ({ ...x, id: x.id || (typeof uid === "function" ? uid() : String(Date.now() + Math.random())) })).sort((a, b) => a.mes.localeCompare(b.mes)));
  };
  const caixa = { border: "1px solid rgba(38,36,33,0.12)", borderRadius: 12, padding: "12px 14px", background: "#fff" };
  const inp = { border: "1px solid rgba(38,36,33,0.2)", borderRadius: 9, padding: "7px 9px", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box", background: "#fff" };
  const cartao = (rot, v, cor) => (
    <div style={{ ...caixa, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 }}>{rot}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: cor || "#111827", marginTop: 2 }}>{moeda(v)}</div>
    </div>
  );
  const legenda = (faixas, meses) => (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: "#374151", marginTop: 6 }}>
      {faixas.filter((f) => meses.some((m) => Number(m[f[0]]) > 0)).map((f) => (
        <span key={f[0]}><span style={{ display: "inline-block", width: 10, height: 10, background: f[1], borderRadius: 2, marginRight: 5 }} />{f[2]}</span>
      ))}
    </div>
  );
  return (
    <div data-vk-recebimento-obra="1" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14 }}>
      <div style={{ fontSize: 12.5, color: "#4b5563", lineHeight: 1.5 }}>
        O que já entrou na obra, o que os contratos firmes ainda vão pagar e a previsão das vendas estimadas. Vai junto na prestação de contas.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        {cartao("Recebido", rm.total.recebido)}
        {cartao("Contratos firmes", rm.total.firme, "#0474f4")}
        {cartao("Vendas estimadas", rm.total.estimativa, "#3b82f6")}
      </div>
      {rm.meses.length > 0 && (
        <div style={caixa}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Recebimento mês a mês</div>
          <GraficoFluxoMensal fluxo={{ meses: rm.meses }} hojeIso={new Date().toISOString().slice(0, 10)} faixas={CP_FAIXAS_RECEB} />
          {legenda(CP_FAIXAS_RECEB, rm.meses)}
        </div>
      )}
      {cm.meses.length > 0 && (
        <div style={caixa}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Custo da obra mês a mês</div>
          <GraficoFluxoMensal fluxo={{ meses: cm.meses }} hojeIso={new Date().toISOString().slice(0, 10)} series={["pago", "vencido", "aberto"]} />
          {legenda(CP_FAIXAS, cm.meses)}
        </div>
      )}
      <div style={caixa}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Cronograma de recebimento previsto</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>As vendas registradas entram sozinhas como contrato firme, e as unidades com projeção de venda entram como venda estimada. Aqui vai o que não está em nenhuma delas.</div>
        {lista.length === 0 && <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 8 }}>Nenhum mês previsto ainda.</div>}
        <div style={{ display: "grid", gap: 8 }}>
          {lista.map((x, k) => (
            <div key={x.id || k} data-vk-receb-linha={k} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "140px 190px 150px minmax(0, 1fr) auto", gap: 8, alignItems: "center" }}>
              <input type="month" style={inp} value={x.mes || ""} disabled={!podeEditar} onChange={(e) => mudar(k, "mes", e.target.value)} />
              <select style={inp} value={x.tipo === "assinar" ? "assinar" : "estimativa"} disabled={!podeEditar} data-vk-receb-tipo={k}
                onChange={(e) => mudar(k, "tipo", e.target.value)}>
                <option value="assinar">Contrato firme</option>
                <option value="estimativa">Venda estimada</option>
              </select>
              <input style={{ ...inp, textAlign: "right" }} inputMode="decimal" placeholder="0,00"
                value={x.valor == null ? "" : typeof x.valor === "number" ? x.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(x.valor)}
                disabled={!podeEditar} onChange={(e) => mudar(k, "valor", e.target.value.replace(/[^\d,.]/g, ""))} />
              <input style={inp} placeholder="Digite uma observação" value={x.obs || ""} disabled={!podeEditar} onChange={(e) => mudar(k, "obs", e.target.value)} />
              {podeEditar && <button type="button" onClick={() => setLista((l) => l.filter((_, i) => i !== k))}
                style={{ border: "1px solid rgba(185,28,28,0.35)", color: "#b91c1c", background: "#fff", borderRadius: 9, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Tirar</button>}
            </div>
          ))}
        </div>
        {podeEditar && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
            <button type="button" data-vk-receb-mais="1" onClick={() => setLista((l) => l.concat([{ mes: proxMes(), valor: "", tipo: (l[l.length - 1] || {}).tipo || "estimativa" }]))}
              style={{ border: "1px solid rgba(38,36,33,0.2)", background: "#fff", borderRadius: 10, padding: "7px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>＋ Mês</button>
            {sujo && <>
              <button type="button" onClick={() => { setLista(inicial.map((x) => ({ ...x }))); setAviso(""); }}
                style={{ border: "1px solid rgba(38,36,33,0.2)", background: "#fff", borderRadius: 10, padding: "7px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
              <button type="button" data-vk-receb-salvar="1" onClick={salvar}
                style={{ border: "none", background: "#0474f4", color: "#fff", borderRadius: 10, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Salvar cronograma</button>
            </>}
            {aviso && <span style={{ fontSize: 12, color: "#b91c1c" }}>{aviso}</span>}
          </div>
        )}
      </div>
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

function BaseDeDados({ obras, clientes, prestadores, insumos, lancamentos, isMobile, obraFixa, nomeDoArquivo, completar, doEscritorio, acoes, meioDoLancamento, modulos, nomeEmpreendimento, aoGuardarDatas, procura, marcosRecebimento, aoGuardarMarcos }) {
  // as linhas de chamada do gráfico de recebimentos (postas à mão na prévia);
  // a cópia local mostra a mudança na hora, o cadastro guarda
  const [marcosLocal, setMarcosLocal] = useState(null);
  const marcosAtuais = marcosLocal || marcosRecebimento || {};
  // no escritório a linha é a transação, com as colunas da planilha do escritório
  const COLS_TAB = doEscritorio ? BASE_COLUNAS_ESCRITORIO : BASE_COLUNAS;
  const COLS_REL = doEscritorio ? BASE_RELATORIO_ESCRITORIO : BASE_RELATORIO;
  // "Completar a base": o que as regras preenchem no que já está gravado,
  // listado para conferir; só grava no clique de quem confere.
  const [conferindo, setConferindo] = useState(false);
  // a linha clicada fica marcada em azul claro, para não perder o fio ao
  // correr os olhos pela linha comprida; outro clique desmarca
  const [linhaMarcada, setLinhaMarcada] = useState("");
  // filtro e ordem pelo título da coluna, como no Excel
  const [colFiltros, setColFiltros] = useState({});
  const [ordemCol, setOrdemCol] = useState(null);
  const [menuCol, setMenuCol] = useState(null); // { titulo, x, y, busca, marcados }
  // a caixa da grade vai até o pé da janela, para a barra lateral aparecer
  const gradeRef = useRef(null);
  if (typeof useArrastarParaRolar === "function") useArrastarParaRolar(gradeRef);
  const [alturaGrade, setAlturaGrade] = useState(0);
  useEffect(() => {
    const medir = () => {
      const g = gradeRef.current;
      if (!g || typeof window === "undefined") return;
      const topo = g.getBoundingClientRect().top;
      setAlturaGrade(Math.max(320, Math.round(window.innerHeight - Math.max(topo, 0) - 16)));
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  });
  const [gravandoBase, setGravandoBase] = useState("");
  // A planilha de controle da obra, arrastada aqui: dela volta o item do
  // catálogo ("Itens da nota fiscal") que a importação antiga não trouxe.
  const [planilhaObra, setPlanilhaObra] = useState(null);   // { nome, linhas }
  // Os grupos que quem confere deixou de fora (desmarcados).
  const [gruposFora, setGruposFora] = useState({ outros: true });
  const refPlanilha = useRef(null);
  async function lerPlanilhaDaObra(arquivo) {
    if (!arquivo) return;
    setGravandoBase("");
    try {
      if (typeof efTabelaDoArquivo !== "function") throw new Error("leitor de planilha indisponível");
      const t = await efTabelaDoArquivo(arquivo);
      const linhas = linhasDaPlanilhaDaObra(t.linhas);
      if (!linhas.length) throw new Error("não achei as colunas “Nota / Comprovante”, “Valor” e “Itens da nota fiscal”");
      setPlanilhaObra({ nome: arquivo.name, linhas });
      setConferindo(true);
    } catch (e) {
      setGravandoBase("Não li a planilha: " + ((e && e.message) || "formato não reconhecido"));
    }
  }
  const pendencias = useMemo(() => (completar && completar.data
    ? completarBase(completar.data, { quem: completar.quem, obraId: completar.obraId || "", planilha: planilhaObra ? planilhaObra.linhas : null }) : null),
    [completar && completar.data, planilhaObra]);
  const CP_GRUPOS_COMPLETAR = ["papel", "escritorio", "novos", "planilha", "outros", "catalogo", "unidade", "ajuste", "insumos"];
  // o mesmo número no escritório só existe se o número do papel for junto
  const gruposEscolhidos = CP_GRUPOS_COMPLETAR.filter((g) => !gruposFora[g] && !(g === "escritorio" && gruposFora.papel));
  const totalEscolhido = pendencias ? gruposEscolhidos.reduce((t, g) => t + ((pendencias.grupos[g] || []).length), 0) : 0;
  async function gravarCompletar() {
    if (!completar || !pendencias || !totalEscolhido) return;
    setGravandoBase("Gravando…");
    try {
      const r = completarBase(completar.data, { quem: completar.quem, obraId: completar.obraId || "", grupos: gruposEscolhidos,
        planilha: planilhaObra ? planilhaObra.linhas : null });
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
  // O papel abre no visor do VICKE: o storage guarda o arquivo sem extensão,
  // e o link cru baixava um arquivo com nome de código (kdhsk…) que o
  // computador não sabe abrir.
  const [vendoPapelBase, setVendoPapelBase] = useState(null);
  const [baixando, setBaixando] = useState("");
  const etapas = typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : [];
  const plano = typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : [];
  const linhas = useMemo(() => {
    const op0 = { clientes, prestadores, insumos, lancamentos, etapas, planoContas: plano };
    if (!doEscritorio) return linhasDaBase(obras || [], op0);
    // no escritório, só o que entrou no extrato
    return linhasDoEscritorio(obras || [], lancamentos || [], { ...op0,
      contaDoEscritorio: typeof contaEscritorio === "function" ? contaEscritorio : null,
      grupoDoEscritorio: typeof grupoEscritorio === "function" ? grupoEscritorio : null, meioDoLancamento });
  }, [obras, clientes, prestadores, insumos, lancamentos, doEscritorio, meioDoLancamento]);
  const nomeDe = (lista, id) => ((lista || []).find((x) => x && x.id === id) || {}).nome || "";
  const op = { nomePrestador: (id) => nomeDe(prestadores, id), nomeConta: (id) => nomeDe(plano, id), nomeEtapa: (id) => nomeDe(etapas, id) };
  const filtradasBase = useMemo(() => filtrarBase(linhas, { texto, obraId, contaId, etapa, grupo, papel, situacao, de, ate }, op),
    [linhas, texto, obraId, contaId, etapa, grupo, papel, situacao, de, ate]);
  const relat = useMemo(() => planilhaDaBase(tabelaDaBase(filtradasBase, COLS_TAB), COLS_REL), [filtradasBase, doEscritorio]);
  const idxFinal = filtrarPorColunas(relat, colFiltros, ordemCol);
  const filtradas = idxFinal.map((i) => filtradasBase[i]);
  const celulasDe = idxFinal.map((i) => relat.linhas[i]);
  const red = (x) => Math.round(x * 100) / 100;
  const soma = red(filtradas.reduce((t, l) => t + l.total, 0));
  const somaPaga = red(filtradas.filter((l) => l.pago).reduce((t, l) => t + l.total, 0));
  const unicos = (k, rot) => [...new Map(linhas.filter((l) => l[k]).map((l) => [l[k], rot ? l[rot] : l[k]])).entries()]
    .map(([valor, rotulo]) => ({ valor, rotulo })).sort((a, b) => String(a.rotulo).localeCompare(String(b.rotulo)));
  const moeda = (v) => (typeof fmtMoedaCtr === "function" ? fmtMoedaCtr(v) : "R$ " + Number(v || 0).toFixed(2));
  const num = (v, casas) => (v == null || v === "" ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas || 0, maximumFractionDigits: casas == null ? 3 : casas }));
  const diaBR = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };
  const mesBR = (ym) => { const m = String(ym || "").match(/^(\d{4})-(\d{2})/); return m ? `${m[2]}/${m[1]}` : ""; };
  const procurando = !!(texto.trim() || obraId || contaId || etapa || grupo || papel !== "todos" || situacao || de || ate
    || Object.keys(colFiltros).length || ordemCol);
  const limpar = () => { setTexto(""); setObraId(""); setContaId(""); setEtapa(""); setGrupo(""); setPapel("todos"); setSituacao(""); setDe(""); setAte("");
    setColFiltros({}); setOrdemCol(null); setMenuCol(null); };

  async function baixar() {
    setBaixando("Montando a planilha…");
    const tabela = tabelaDaBase(linhasParaExportar(filtradas), COLS_TAB);
    const plan = planilhaDaBase(tabela, COLS_REL);
    const nome = (nomeDoArquivo || "base-de-dados").replace(/[^\w-]+/g, "-").toLowerCase() + "-" + new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
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
          // número guardado como texto ("4224", "0194") vai como número puro
          // (4224, 194): o Excel reconhece, ordena e filtra como sequência
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

  // A prestação de contas do que está filtrado (a obra, o período): um .zip
  // com a planilha (resumo por conta, notas, itens) e a pasta dos papéis,
  // cada um com o nome do número.
  const [prestando, setPrestando] = useState(null); // { fazendo, msg, erro }
  // Antes de montar, a janela dos parâmetros (regime das despesas e das
  // entradas, início e término da obra). A última escolha fica guardada
  // neste navegador, por obra.
  const obraDaPrestacao = obraFixa ? (obras || [])[0] : (obraId ? (obras || []).find((o) => o && o.id === obraId) : null);
  const [paramPC, setParamPC] = useState(null);
  // o empreendimento com mais de um módulo: a prestação pode juntar todos
  const listaModulos = (modulos || []).filter(Boolean);
  const temModulos = !!obraDaPrestacao && listaModulos.length > 1;
  const chaveParam = obraDaPrestacao ? "vk-pc-param:" + obraDaPrestacao.id : "";
  function abrirPrestacao() {
    if (!obraDaPrestacao) { baixarPrestacao(null); return; }
    let salvo = null;
    try { salvo = JSON.parse(localStorage.getItem(chaveParam) || "null"); } catch (e) { salvo = null; }
    const padrao = cpParametrosPadrao(obraDaPrestacao);
    // as datas: quando dá para gravar na obra, valem as do cadastro (as
    // mesmas em qualquer navegador); senão, as guardadas neste navegador
    const doCadastro = !!aoGuardarDatas;
    const datasModulos = {};
    for (const d of cpDatasDosModulos(listaModulos, doCadastro ? {} : (salvo && salvo.datasModulos) || {})) datasModulos[d.id] = { inicio: d.inicio, termino: d.termino };
    const inicio = doCadastro ? padrao.inicio : (salvo && salvo.inicio) || padrao.inicio;
    const termino = doCadastro ? padrao.termino : (salvo && salvo.termino) || padrao.termino;
    const inicioEmpCad = (listaModulos.find((m) => m && /^\d{4}-\d{2}-\d{2}$/.test(String(m.inicioEmpreendimento || ""))) || {}).inicioEmpreendimento || "";
    setParamPC({ ...padrao, abrangencia: "modulo", ...(salvo || {}), inicio, termino,
      inicioEmp: inicioEmpCad || (salvo && salvo.inicioEmp) || inicio || "", datasModulos, erro: "" });
  }
  function gerarComParametros() {
    const p = paramPC || {};
    const todos = temModulos && p.abrangencia === "todos";
    const datas = todos ? cpDatasDosModulos(listaModulos, p.datasModulos) : [];
    const errada = datas.find((d) => d.inicio && d.termino && d.termino < d.inicio);
    if (errada) { setParamPC({ ...p, erro: `${errada.nome}: o término não pode ser antes do início.` }); return; }
    if (!todos && p.inicio && p.termino && p.termino < p.inicio) { setParamPC({ ...p, erro: "O término não pode ser antes do início." }); return; }
    const datasModulos = {};
    for (const d of datas) datasModulos[d.id] = { inicio: d.inicio, termino: d.termino };
    const limpo = { despesa: p.despesa, entrada: p.entrada, inicio: p.inicio || "", termino: p.termino || "",
      abrangencia: todos ? "todos" : "modulo", ...(todos ? { datasModulos, inicioEmp: p.inicioEmp || "" } : {}) };
    try { localStorage.setItem(chaveParam, JSON.stringify({ ...limpo, datasModulos: p.datasModulos || {}, inicioEmp: p.inicioEmp || "" })); } catch (e) { /* sem armazenamento */ }
    // as datas vão para o cadastro da obra (e de cada módulo): em outro
    // navegador ou computador, a prestação abre com as mesmas
    if (aoGuardarDatas) {
      const porObra = {};
      if (todos) for (const d of datas) porObra[d.id] = { dataInicio: d.inicio, dataFim: d.termino };
      else if (obraDaPrestacao) porObra[obraDaPrestacao.id] = { dataInicio: p.inicio || "", dataFim: p.termino || "" };
      try { aoGuardarDatas(porObra, todos ? (p.inicioEmp || "") : null); } catch (e) { /* a prévia segue mesmo sem gravar */ }
    }
    // antes do pacote com os comprovantes (demorado), a prévia dos números
    // e dos gráficos; confirmada, gera
    setParamPC(null);
    // no empreendimento inteiro, o cabeçalho mostra do primeiro início ao
    // último término; cada módulo usa as datas dele
    const ini = datas.map((d) => d.inicio).filter(Boolean).sort(), fim = datas.map((d) => d.termino).filter(Boolean).sort();
    const exibir = todos ? { ...limpo, inicio: p.inicioEmp || ini[0] || "", termino: fim[fim.length - 1] || "" } : limpo;
    setPrevia({ param: exibir, dados: dadosDaPrestacao(exibir) });
  }
  const [previa, setPrevia] = useState(null);
  // de quem são as linhas de chamada: do empreendimento inteiro ou da obra
  function chaveDosMarcos(param) {
    if (param && param.abrangencia === "todos" && temModulos) return "todos";
    return (obraDaPrestacao && obraDaPrestacao.id) || "obra";
  }
  function mudarMarco(mes, texto) {
    if (!previa) return;
    const chave = chaveDosMarcos(previa.param);
    const lista = cpMudarMarco(marcosAtuais[chave] || [], mes, texto);
    const novo = { ...marcosAtuais, [chave]: lista };
    setMarcosLocal(novo);
    setPrevia((pv) => (pv && pv.dados && pv.dados.rmPC ? { ...pv, dados: { ...pv.dados, rmPC: { ...pv.dados.rmPC, marcos: cpMarcosManuais(novo, chave) } } } : pv));
    if (aoGuardarMarcos) { try { aoGuardarMarcos(chave, lista); } catch (e) { /* a prévia segue mesmo sem gravar */ } }
  }
  function moverMarco(mes, dx, dy) {
    if (!previa) return;
    const chave = chaveDosMarcos(previa.param);
    const lista = cpMoverMarco(marcosAtuais[chave] || [], mes, dx, dy);
    const novo = { ...marcosAtuais, [chave]: lista };
    setMarcosLocal(novo);
    setPrevia((pv) => (pv && pv.dados && pv.dados.rmPC ? { ...pv, dados: { ...pv.dados, rmPC: { ...pv.dados.rmPC, marcos: cpMarcosManuais(novo, chave) } } } : pv));
    if (aoGuardarMarcos) { try { aoGuardarMarcos(chave, lista); } catch (e) { /* a prévia segue mesmo sem gravar */ } }
  }
  function dadosDaPrestacao(param) {
    // todo o empreendimento: as notas e os números de todos os módulos, no
    // mesmo período escolhido na base
    const todos = !!(param && param.abrangencia === "todos" && temModulos);
    const linhasPC = todos
      ? filtrarBase(linhasDaBase(listaModulos, { clientes, prestadores, insumos, lancamentos, etapas, planoContas: plano }), { de, ate }, op)
      : filtradas;
    const pc = prestacaoDeContas(linhasPC);
    // uma obra só (a da tela, ou a do filtro): leva o físico-financeiro, os
    // custos e recebimentos mês a mês, o fluxo de caixa e o a pagar dela
    const obraDaPC = param ? (todos ? obraDoEmpreendimento(listaModulos, nomeEmpreendimento) : obraDaPrestacao) : null;
    const opPC = param ? { inicio: param.inicio || "", termino: param.termino || "" } : {};
    const ffPC = obraDaPC ? fisicoFinanceiroDaPrestacao(obraDaPC, { ...opPC, regime: param.despesa }) : null;
    // todo o empreendimento: cada módulo com as datas dele, somados mês a mês
    const mens = todos ? prestacaoMensalDosModulos(listaModulos, { despesa: param.despesa, entrada: param.entrada, datas: param.datasModulos, inicio: param.inicioEmp || "" }) : null;
    const datasPorId = {};
    if (mens) for (const d of mens.datas) datasPorId[d.id] = d;
    return { pc, obraDaPC, ffPC,
      cfPC: ffPC ? conferenciaDaPrestacao(ffPC, linhasPC) : null,
      modulosPC: todos ? resumoPorModulo(listaModulos, { ...opPC, despesa: param.despesa, entrada: param.entrada, datas: datasPorId }) : null,
      nomePC: todos ? (nomeEmpreendimento || "Empreendimento") + " — todos os módulos" : "",
      cmPC: mens ? mens.cm : obraDaPC ? custosMensais(obraDaPC, { ...opPC, regime: param.despesa }) : null,
      rmPC: mens ? { ...mens.rm, marcos: cpMarcosManuais(marcosAtuais, chaveDosMarcos(param)) }
        : obraDaPC ? { ...recebimentosMensais(obraDaPC, { ...opPC, regime: param.entrada }), marcos: cpMarcosManuais(marcosAtuais, chaveDosMarcos(param)) } : null,
      fcPC: mens ? mens.fc : obraDaPC ? fluxoDeCaixaDaObra(obraDaPC, { ...opPC, regime: param.despesa }) : null,
      ctPC: obraDaPC ? contratosFirmes(obraDaPC) : null,
      // a procura (cadastros do site) do empreendimento
      prPC: procura && typeof procuraResumo === "function" ? procuraResumo(procura) : null };
  }
  async function baixarPrestacao(param, opcoesPC) {
    const { pc, obraDaPC, ffPC, cfPC, cmPC, rmPC, fcPC, modulosPC, nomePC, ctPC, prPC } = dadosDaPrestacao(param);
    if (!pc.notas.length && !obraDaPC) { setPrestando({ erro: true, msg: "Nada pago no que está filtrado." }); return; }
    setPrestando({ fazendo: true, msg: "Montando a planilha…" });
    const obraNome = nomePC || (obraFixa && (obras || [])[0] ? (obras[0].nome || "obra") : (obraId ? nomeDe(obras, obraId) : "obras"));
    // sem acento no nome dos arquivos de dentro do .zip: o Windows abre zip
    // com nome acentuado mostrando "PrestaÃ§Ã£o"
    const semAcento = (t) => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // Nome curto: o Windows extrai para "Downloads\<nome do zip>\..." e
    // recusa caminho comprido. "PC Jacarezinho Modulo 1 09-2026 a 10-2026".
    const mesAno = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})/); return m ? `${m[2]}-${m[1]}` : ""; };
    const ini = mesAno(de || pc.de), fim = mesAno(ate || pc.ate);
    const obraCurta = semAcento(nomePC ? (nomeEmpreendimento || "Empreendimento") + " todos" : obraNome).replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/[^\x20-\x7E]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 28).trim();
    const titulo = ("PC " + obraCurta + (ini ? " " + (ini === fim || !fim ? ini : ini + " a " + fim) : "")).trim();
    // o relatório em PDF (o mesmo que vai dentro do pacote)
    const montarPdf = async () => {
      const JsPDF = await carregarJsPDF();
      const cliObj = obraFixa && (obras || [])[0] ? ((clientes || []).find((c) => c && c.id === obras[0].clienteId) || null) : null;
      // empreendimento próprio não tem cliente: o relatório diz o que é
      const ehEmp = !!cliObj && typeof ehEmpreendimento === "function" && ehEmpreendimento(cliObj);
      const esc = (completar && completar.data && completar.data.escritorio && completar.data.escritorio.nome) || "";
      return pdfDaPrestacaoDeContas(JsPDF, pc, { obra: obraNome, cliente: ehEmp ? "" : ((cliObj && cliObj.nome) || ""),
        tipo: ehEmp ? "Empreendimento" : "", escritorio: esc, de, ate, ff: ffPC, conferencia: cfPC, custos: cmPC, recebimentos: rmPC, fluxoCaixa: fcPC, parametros: param || null, modulos: modulosPC, contratos: ctPC, procura: prPC }).output("blob");
    };
    // só o PDF: sem planilha e sem baixar os comprovantes (é rápido)
    if (opcoesPC && opcoesPC.soPdf) {
      setPrestando({ fazendo: true, msg: "Montando o PDF…" });
      try {
        const blob = await montarPdf();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = titulo + ".pdf";
        document.body.appendChild(link); link.click();
        setTimeout(() => { try { URL.revokeObjectURL(link.href); link.remove(); } catch (e) {} }, 1500);
        setPrestando({ erro: false, msg: "PDF da prestação baixado (sem os comprovantes)." });
      } catch (e) {
        setPrestando({ erro: true, msg: "Não deu para montar o PDF: " + ((e && e.message) || "erro") });
      }
      return;
    }
    try {
      const E = await carregarExcelJS();
      const wb = new E.Workbook();
      wb.creator = "VICKE";
      const fonte = { name: "Century Gothic", size: 9 };
      const cabecalho = (ws) => {
        const cab = ws.getRow(1);
        cab.height = 19.95;
        cab.eachCell((cel) => {
          cel.font = { name: "Century Gothic", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
          cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF366092" } };
          cel.alignment = { horizontal: "center", vertical: "middle" };
        });
      };
      const data = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
      // 1. resumo por conta contábil
      const r1 = wb.addWorksheet("Resumo por conta", { views: [{ state: "frozen", ySplit: 1 }] });
      r1.columns = [{ header: "Conta contábil", width: 38 }, { header: "Transações", width: 13 }, { header: "Valor", width: 16 }];
      const totais = [];
      pc.resumo.filter((r) => !r.entrada).forEach((r) => r1.addRow([r.conta, r.transacoes, r.valor]));
      totais.push(r1.addRow(["Total das saídas", pc.nSaidas, pc.total]));
      if (pc.nEntradas) {
        r1.addRow([]);
        pc.resumo.filter((r) => r.entrada).forEach((r) => r1.addRow([r.conta + " (entrada)", r.transacoes, r.valor]));
        totais.push(r1.addRow(["Total das entradas", pc.nEntradas, pc.entradas]));
      }
      r1.eachRow((row, i) => row.eachCell((cel, j) => {
        if (i > 1) cel.font = { ...fonte, bold: totais.indexOf(row) >= 0 };
        if (j === 3 && i > 1) cel.numFmt = CP_MOEDA_XL;
        if (j === 2 && i > 1) cel.alignment = { horizontal: "center" };
      }));
      cabecalho(r1);
      // 2. as notas, uma por transação, pelo número do papel
      const r2 = wb.addWorksheet("Notas", { views: [{ state: "frozen", ySplit: 1 }] });
      r2.columns = [{ header: "Nº papel", width: 10 }, { header: "Data pagamento", width: 15 }, { header: "Fornecedor", width: 30 },
        { header: "Descrição", width: 40 }, { header: "Conta contábil", width: 26 }, { header: "Nº nota fiscal", width: 14 },
        { header: "Valor", width: 14 }, { header: "Arquivos", width: 30 }, { header: "Ref", width: 8 }, { header: "Tipo", width: 9 }];
      pc.notas.forEach((n) => {
        const row = r2.addRow([n.numero ? (/^\d+$/.test(n.numero) ? Number(n.numero) : n.numero) : "sem número", data(n.data), n.fornecedor,
          n.descricao, n.conta, n.nf || "", n.valor, n.arquivos.length ? n.arquivos.join(", ") : "sem arquivo", n.ref ? Number(n.ref) || n.ref : "",
          n.entrada ? "Entrada" : "Saída"]);
        row.eachCell({ includeEmpty: true }, (cel, j) => {
          cel.font = (n.semNumero && j === 1) || (n.semArquivo && j === 8) ? { ...fonte, color: { argb: "FFB91C1C" } } : fonte;
          if (j === 2) cel.numFmt = "dd/mm/yyyy";
          if (j === 7) cel.numFmt = CP_MOEDA_XL;
          if (j === 1 || j === 2 || j === 6 || j === 9) cel.alignment = { horizontal: "center" };
        });
      });
      const tn = r2.addRow(["", null, "", "Total das saídas", "", "", pc.total, "", "", ""]);
      tn.eachCell((cel, j) => { cel.font = { ...fonte, bold: true }; if (j === 7) cel.numFmt = CP_MOEDA_XL; });
      if (pc.nEntradas) {
        const te = r2.addRow(["", null, "", "Total das entradas", "", "", pc.entradas, "", "", ""]);
        te.eachCell((cel, j) => { cel.font = { ...fonte, bold: true }; if (j === 7) cel.numFmt = CP_MOEDA_XL; });
      }
      cabecalho(r2);
      r2.autoFilter = { from: { row: 1, column: 1 }, to: { row: pc.notas.length + 1, column: 10 } };
      // 3. os itens, como na base
      const plan = planilhaDaBase(tabelaDaBase(linhasParaExportar(filtradas.filter((l) => l.pago)), COLS_TAB), COLS_REL);
      const r3 = wb.addWorksheet("Itens", { views: [{ state: "frozen", ySplit: 1 }] });
      r3.columns = plan.colunas.map((c) => ({ header: c.titulo, width: c.largura }));
      plan.linhas.forEach((linha) => {
        const row = r3.addRow(linha.map((v, j) => {
          const tipo = plan.colunas[j].tipo;
          if (v === "" || v == null) return null;
          if (tipo === "numeroTexto") return /^\d{1,9}$/.test(String(v).trim()) ? Number(String(v).trim()) : v;
          if (tipo === "data" || tipo === "mes") {
            const m = String(v).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
            return m ? new Date(Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1)) : v;
          }
          return v;
        }));
        row.eachCell({ includeEmpty: true }, (cel, j) => {
          const c = plan.colunas[j - 1];
          cel.font = { name: "Century Gothic", size: 8 };
          if (c.formato) cel.numFmt = c.formato;
          if (c.alinhar) cel.alignment = { horizontal: c.alinhar };
        });
      });
      cabecalho(r3);
      // 4-6. a obra: físico-financeiro, a pagar e recebimento
      if (ffPC) {
        const comp = ffPC.regime === "competencia";
        const r4 = wb.addWorksheet("Fisico-financeiro", { views: [{ state: "frozen", ySplit: 1 }] });
        r4.columns = [{ header: "Grupo / conta", width: 40 }, { header: "Estimado", width: 16 }, { header: comp ? "Realizado (lançado)" : "Realizado (pago)", width: 18 }]
          .concat(comp ? [] : [{ header: "A pagar", width: 16 }]).concat([{ header: "Saldo", width: 16 }]);
        const negr = [];
        const lin = (rot, l) => [rot, l.estimado, l.realizado].concat(comp ? [] : [l.aPagar]).concat([l.saldo]);
        for (const b of ffPC.blocos) {
          negr.push(r4.addRow(lin(b.titulo + (b.noTotal ? "" : " (fora do custo)"), b)));
          for (const l of b.linhas) r4.addRow(lin("   " + l.conta, l));
        }
        negr.push(r4.addRow(lin("Custo da obra", ffPC.total)));
        if (cfPC) {
          r4.addRow([]);
          r4.addRow(["Notas pagas desta prestação", cfPC.totalNotas]);
          if (cfPC.foraDoPeriodo) r4.addRow(["+ pago fora do período/filtro", cfPC.foraDoPeriodo]);
          if (cfPC.naoPago) r4.addRow(["+ lançado e ainda não pago", cfPC.naoPago]);
          if (cfPC.foraDoFF) r4.addRow(["- notas fora do custo (terreno, IR, excluídas…)", cfPC.foraDoFF]);
          negr.push(r4.addRow(["= Realizado no físico-financeiro", cfPC.realizado]));
          r4.addRow([cfPC.confere ? "Confere" : "Diferença sem explicação", cfPC.confere ? null : cfPC.diferenca]);
        }
        r4.eachRow((row, k) => row.eachCell((cel, j) => {
          if (k > 1) cel.font = { ...fonte, bold: negr.indexOf(row) >= 0 };
          if (j > 1 && k > 1) cel.numFmt = CP_MOEDA_XL;
        }));
        cabecalho(r4);
        const r5 = wb.addWorksheet("A pagar", { views: [{ state: "frozen", ySplit: 1 }] });
        r5.columns = [{ header: "Vencimento", width: 13 }, { header: "Fornecedor", width: 30 }, { header: "Descrição", width: 40 },
          { header: "Parcela", width: 9 }, { header: "Conta contábil", width: 26 }, { header: "Valor", width: 14 }, { header: "No custo da obra", width: 15 }];
        ffPC.aPagarLista.forEach((x) => r5.addRow([data(x.vencimento), x.fornecedor, x.descricao, x.parcela, x.conta, x.valor, x.foraDoFF ? "não" : "sim"]));
        const t5 = r5.addRow([null, "", "Total a pagar", "", "", ffPC.totalAPagar, ""]);
        r5.eachRow((row, k) => row.eachCell({ includeEmpty: true }, (cel, j) => {
          if (k > 1) cel.font = { ...fonte, bold: row === t5 };
          if (j === 1) cel.numFmt = "dd/mm/yyyy";
          if (j === 6 && k > 1) cel.numFmt = CP_MOEDA_XL;
        }));
        cabecalho(r5);
      }
      // as séries mês a mês: a pré-obra sai como texto na coluna do mês
      const folhaMensal = (nome, colunas, linhas, total) => {
        const ws = wb.addWorksheet(nome, { views: [{ state: "frozen", ySplit: 1 }] });
        ws.columns = colunas.map((c, j) => ({ header: c, width: j ? 18 : 12 }));
        linhas.forEach((l) => ws.addRow(l));
        const t = total ? ws.addRow(total) : null;
        ws.eachRow((row, k) => row.eachCell({ includeEmpty: true }, (cel, j) => {
          if (k > 1) cel.font = { ...fonte, bold: row === t };
          if (j === 1 && cel.value instanceof Date) cel.numFmt = "mm/yyyy";
          if (j > 1 && k > 1) cel.numFmt = CP_MOEDA_XL;
        }));
        cabecalho(ws);
      };
      const mesXL = (k) => (k === "pre" ? "Pré-obra" : data(k + "-01"));
      if (cmPC && cmPC.meses.length) {
        const comp = cmPC.regime === "competencia";
        folhaMensal("Custos mensais", ["Mês"].concat(comp ? ["Custo realizado"] : ["Pago", "Vencido", "A pagar"]).concat(["Total"]),
          cmPC.meses.map((m) => [mesXL(m.chave)].concat(comp ? [m.custo] : [m.pago, m.vencido, m.aberto]).concat([m.pago + m.vencido + m.aberto + m.custo])),
          ["Total"].concat(comp ? [cmPC.total.custo] : [cmPC.total.pago, cmPC.total.vencido, cmPC.total.aberto]).concat([cmPC.total.geral]));
      }
      if (rmPC && rmPC.meses.length) {
        folhaMensal("Recebimentos", ["Mês", "Recebido", "Contratos firmes", "Vendas estimadas", "Total"],
          rmPC.meses.map((m) => [mesXL(m.chave), m.recebido, m.firme, m.estimativa, m.recebido + m.firme + m.estimativa]),
          ["Total", rmPC.total.recebido, rmPC.total.firme, rmPC.total.estimativa, rmPC.total.geral]);
      }
      if (fcPC && !fcPC.erro) {
        folhaMensal("Fluxo de Caixa Livre", ["Mês", "Custo realizado", "Custo a realizar", "Recebido", "A receber previsto", "Resultado do mês", "Acumulado"],
          fcPC.linhas.map((l) => [mesXL(l.chave), l.custoRealizado, l.custoARealizar, l.recebido, l.recebimentoPrevisto, l.resultado, l.acumulado]),
          ["Total", fcPC.total.custoRealizado, fcPC.total.custoARealizar, fcPC.total.recebido, fcPC.total.recebimentoPrevisto, fcPC.total.resultado, null]);
      }
      const xlsx = await wb.xlsx.writeBuffer();
      // o relatório em PDF — é ele a prestação; a planilha vai de apoio
      setPrestando({ fazendo: true, msg: "Montando o relatório…" });
      const pdf = await montarPdf();
      // a pasta dos papéis
      const JSZip = await carregarJSZip();
      const z = new JSZip();
      z.file("Relatorio.pdf", pdf);
      z.file("Planilha.xlsx", xlsx);
      const falharam = [];
      const naoConverteu = [];
      let feitos = 0;
      // os links curtos dos papéis privados, de uma vez só
      const links = typeof linksDosPapeis === "function"
        ? await linksDosPapeis(pc.arquivos.map((a) => a.url)).catch(() => ({})) : {};
      for (const a of pc.arquivos) {
        setPrestando({ fazendo: true, msg: `Juntando os papéis… ${++feitos} de ${pc.arquivos.length}` });
        try {
          if (!links[a.url] && typeof papelEhPrivado === "function" && papelEhPrivado(a.url)) throw new Error("sem acesso");
          const resp = await fetch(links[a.url] || a.url);
          if (!resp.ok) throw new Error("HTTP " + resp.status);
          const bruto = await resp.blob();
          if (a.daImagem) {
            // não converteu (formato que o navegador não abre): vai a foto
            // mesmo, com a extensão dela, e o aviso conta
            try { z.file("Papeis/" + semAcento(a.nome), await imagemEmPdf(JsPDF, bruto)); }
            catch (e2) {
              const ext = ((bruto.type || "").split("/")[1] || "jpg").replace("jpeg", "jpg");
              z.file("Papeis/" + semAcento(a.nome).replace(/\.pdf$/, "." + ext), bruto);
              naoConverteu.push(a.nome);
            }
          } else {
            z.file("Papeis/" + semAcento(a.nome), bruto);
          }
        } catch (e) { falharam.push(a.nome); }
      }
      const blob = await z.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = titulo + ".zip";
      document.body.appendChild(link); link.click();
      setTimeout(() => { try { URL.revokeObjectURL(link.href); link.remove(); } catch (e) {} }, 1500);
      const avisos = [];
      if (pc.semNumero) avisos.push(`${pc.semNumero} sem número (use Completar a base)`);
      if (pc.semArquivo) avisos.push(`${pc.semArquivo} sem arquivo`);
      if (naoConverteu.length) avisos.push(`${naoConverteu.length === 1 ? "1 foto ficou" : naoConverteu.length + " fotos ficaram"} no formato original: ${naoConverteu.join(", ")}`);
      if (falharam.length) avisos.push(`${falharam.length === 1 ? "1 arquivo não baixou" : falharam.length + " arquivos não baixaram"}: ${falharam.join(", ")}`);
      setPrestando({ erro: avisos.length > 0,
        msg: `Prestação baixada: ${pc.notas.length} ${pc.notas.length === 1 ? "nota" : "notas"}, ${pc.arquivos.length - falharam.length} ${pc.arquivos.length - falharam.length === 1 ? "arquivo" : "arquivos"}, saídas ${moeda(pc.total)}`
          + (pc.nEntradas ? `, entradas ${moeda(pc.entradas)}` : "") + "."
          + (avisos.length ? " Atenção: " + avisos.join("; ") + " — marcados em vermelho na aba Notas." : "")
          + (pc.aPagarFora ? ` ${pc.aPagarFora === 1 ? "1 item a pagar ficou" : pc.aPagarFora + " itens a pagar ficaram"} de fora.` : "") });
    } catch (e) {
      setPrestando({ erro: true, msg: "Não consegui montar a prestação (" + ((e && e.message) || "erro") + ")." });
    }
  }

  const input = { border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 10, padding: "8px 11px", fontSize: 13, color: "#111827",
    outline: "none", background: "#fff", fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
  const chip = (ativo, rot, fn) => (
    <button key={rot} type="button" onClick={fn} style={{ border: `1.5px solid ${ativo ? "#0474f4" : "rgba(38,36,33,0.16)"}`,
      background: ativo ? "#eff6ff" : "#fff", color: ativo ? "#0474f4" : "#374151", borderRadius: 999, padding: "5px 12px",
      fontSize: 12, fontWeight: ativo ? 600 : 500, cursor: "pointer", fontFamily: "inherit" }}>{rot}</button>
  );
  // As colunas, os formatos e o alinhamento são os do Excel; a largura vem
  // do maior conteúdo (com teto, para texto longo não esticar a coluna — o
  // texto inteiro aparece ao passar o mouse). Na obra, cliente e obra já
  // estão no título da tela.
  const ocultas = obraFixa ? ["Nome Cliente", "Projeto / obra"] : [];
  const COLS = relat.colunas.map((c, j) => ({ ...c, j, px: Math.max(56, Math.round(c.largura * 7.2)) }))
    .filter((c) => ocultas.indexOf(c.titulo) < 0);
  const comAcoes = !!(acoes && (acoes.editar || acoes.excluir || acoes.verPapel || acoes.anexar));
  const larguraAcoes = acoes && acoes.trocar ? 178 : 132;
  const grade = COLS.map((c) => c.px + "px").join(" ") + (comAcoes ? " " + larguraAcoes + "px" : "");
  const largura = COLS.reduce((t, c) => t + c.px, 0) + (comAcoes ? larguraAcoes + 10 : 0) + COLS.length * 10 + 24;
  // Os títulos da linha ficam presos à esquerda ao rolar para o lado, como
  // o "congelar painéis" do Excel: a referência e, no escritório, o cliente.
  // Cada coluna presa cobre também o respiro à esquerda dela (o padding da
  // linha ou o vão da grade), senão o texto das outras aparece por baixo.
  const FIXAS = ["Ref", "Nome Cliente"];
  const fixas = [];
  for (const c of COLS) { if (FIXAS.indexOf(c.titulo) < 0) break; fixas.push(c); }
  const estiloFixa = (k, fundo) => {
    if (k >= fixas.length) return null;
    let esquerda = 0;
    for (let i = 0; i < k; i++) esquerda += (i === 0 ? 12 : 10) + fixas[i].px;
    const respiro = k === 0 ? 12 : 10;
    return { position: "sticky", left: esquerda, zIndex: 1, background: fundo, marginLeft: -respiro, paddingLeft: respiro,
      boxShadow: k === fixas.length - 1 ? "1px 0 0 rgba(38,36,33,0.10)" : undefined };
  };
  // os botões da transação (no escritório): ver o papel, editar, excluir.
  // Na base da obra (`acoes.daObra`) a linha é a conta da obra.
  const botoesDaLinha = (l) => {
    const lanc = l.lanc_ || (acoes && acoes.daObra ? l.conta_ : null);
    if (!comAcoes || !lanc) return null;
    const c0 = l.conta_ || {};
    const papeis = ((c0.anexos) || []).concat(c0.comprovante && !(c0.anexos || []).some((a) => a && a.url === c0.comprovante.url) ? [c0.comprovante] : [])
      .filter((a) => a && a.url);
    const b = { border: "none", background: "none", padding: "0 3px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: "#0474f4" };
    return (
      <span style={{ display: "inline-flex", gap: 4, justifyContent: "flex-end", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
        {acoes.verPapel && papeis.length > 0 && (
          <button type="button" style={b} title={papeis.length === 1 ? "Ver o documento: " + (papeis[0].nome || "") : "Ver os " + papeis.length + " documentos"}
            onClick={() => acoes.verPapel(papeis[0], lanc)}><IconePapel />{papeis.length > 1 ? " " + papeis.length : ""}</button>
        )}
        {/* na obra: o papel que já está aqui aparece pelo nome (abre ao
            clicar) — e o "+ papel" some, para não anexar duas vezes */}
        {acoes.anexar && papeis.length > 0 && (
          <a href={papeis[0].url} target="_blank" rel="noopener noreferrer" data-vk-papel-da-linha="1"
            onClick={(e) => { if (typeof VisorProposta === "function") { e.preventDefault(); setVendoPapelBase(papeis[0]); } }}
            title={papeis.length === 1 ? "Abrir " + (papeis[0].nome || "o papel") : papeis.map((a) => a.nome || "papel").join(", ")}
            style={{ ...b, textDecoration: "none", color: "#047857", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", verticalAlign: "bottom" }}>
            <IconePapel estilo={{ marginRight: 4 }} />
            {papeis[0].nome || "papel"}{papeis.length > 1 ? ` +${papeis.length - 1}` : ""}
          </a>
        )}
        {/* trocar o papel (chegou a nota do fornecedor, o comprovante certo…):
            o novo entra no lugar do antigo em todas as contas da transação */}
        {acoes.trocar && papeis.length > 0 && (
          <label style={{ ...b, display: "inline-block" }} data-vk-trocar-papel="1" title={"Trocar " + (papeis[0].nome || "o papel") + " por outro arquivo"}>
            Trocar
            <input type="file" accept="image/*,application/pdf" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) acoes.trocar(lanc, papeis[0], f); }} />
          </label>
        )}
        {acoes.anexar && papeis.length === 0 && (
          <label style={{ ...b, display: "inline-block" }} title="Anexar o comprovante ou a nota desta transação">
            + papel
            <input type="file" accept="image/*,application/pdf" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) acoes.anexar(lanc, f); }} />
          </label>
        )}
        {acoes.editar && <button type="button" style={b} onClick={() => acoes.editar(lanc)}>Editar</button>}
        {acoes.excluir && <button type="button" style={{ ...b, color: "#dc2626" }} onClick={() => acoes.excluir(lanc)}>Excluir</button>}
      </span>
    );
  };
  // a fatura do cartão guarda as compras dentro dela: aparecem ao marcar a linha
  const linhasDaFaturaMarcada = (l) => {
    const lanc = l.lanc_;
    if (!lanc || linhaMarcada !== l.id || !(lanc.linhas || []).length) return null;
    return (
      <div style={{ gridColumn: "1 / -1", margin: "4px 0 2px", padding: "6px 10px", borderLeft: "2px solid #93c5fd", background: "#f8fbff",
        display: "grid", gap: 3 }} onClick={(e) => e.stopPropagation()}>
        {lanc.linhas.map((x, k) => (
          <div key={k} style={{ fontSize: 11.5, color: "#374151", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ color: "#111827" }}>{x.descricao || "—"}</span>
            <span>{[x.obra || "Escritório", x.fornecedor, x.de > 1 ? x.parcela + "/" + x.de : ""].filter(Boolean).join(" · ")}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{moeda(Math.abs(Number(x.valor) || 0))}</span>
          </div>
        ))}
      </div>
    );
  };
  const visiveis = filtradas.slice(0, limite);

  return (
    <div style={{ minWidth: 0, maxWidth: "100%" }}>
      {vendoPapelBase && typeof VisorProposta === "function" && (
        <VisorProposta anexo={vendoPapelBase} aoFechar={() => setVendoPapelBase(null)} />
      )}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : (doEscritorio ? "minmax(0,2fr) repeat(2, minmax(0,1fr))" : obraFixa ? "minmax(0,2fr) repeat(3, minmax(0,1fr))" : "minmax(0,2fr) repeat(4, minmax(0,1fr))"), gap: 8, marginBottom: 8 }}>
        <input style={input} value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Procurar na base"
          placeholder={doEscritorio ? "Procurar: descrição, fornecedor, cliente, conta, nota, ref, valor…" : "Procurar: item, fornecedor, nota, ref, valor…"} />
        {!obraFixa && (
          <SelectBusca style={input} value={obraId} onChange={(v) => setObraId(v || "")} vazio="Todas as obras" placeholder="Procurar obra…"
            opcoes={[{ valor: "", rotulo: "Todas as obras" }].concat(unicos("obraId", "obra"))} />
        )}
        {!doEscritorio && (<>
        <SelectBusca style={input} value={etapa} onChange={(v) => setEtapa(v || "")} vazio="Todas as etapas" placeholder="Procurar etapa…"
          opcoes={[{ valor: "", rotulo: "Todas as etapas" }].concat(unicos("etapaId", "etapa"))} />
        <SelectBusca style={input} value={grupo} onChange={(v) => setGrupo(v || "")} vazio="Todos os grupos" placeholder="Procurar grupo…"
          opcoes={[{ valor: "", rotulo: "Todos os grupos" }].concat(unicos("grupo"))} />
        </>)}
        <SelectBusca style={input} value={contaId} onChange={(v) => setContaId(v || "")} vazio="Todas as contas" placeholder="Procurar conta…"
          opcoes={[{ valor: "", rotulo: "Todas as contas" }].concat(unicos("contaId", "conta"))} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        {!doEscritorio && (<>
        {chip(situacao === "", "Tudo", () => setSituacao(""))}
        {chip(situacao === "pago", "Pago", () => setSituacao("pago"))}
        {chip(situacao === "apagar", "A pagar", () => setSituacao("apagar"))}
        <span style={{ width: 8 }} />
        </>)}
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
          <b>{filtradas.length}</b> {filtradas.length === 1 ? "item" : "itens"}
          {doEscritorio ? (<>
            {/* só o que afeta o saldo: a fatura inteira e a transferência
                entre contas não entram, para não contar duas vezes */}
            {" · entradas "}<b>{moeda(red(filtradas.filter((l) => l.sinal > 0 && l.afetaSaldo !== "Não").reduce((t, l) => t + l.total, 0)))}</b>
            {" · saídas "}<b>{moeda(red(filtradas.filter((l) => !(l.sinal > 0) && l.afetaSaldo !== "Não").reduce((t, l) => t + l.total, 0)))}</b>
          </>) : (<>
            {" · total "}<b>{moeda(soma)}</b>
            {somaPaga !== soma ? ` · pago ${moeda(somaPaga)}` : ""}
          </>)}
          {procurando && <> · <button type="button" onClick={limpar} style={{ background: "none", border: "none", padding: 0, color: "#0474f4", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5 }}>limpar filtros</button></>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {completar && (
          <>
            <input ref={refPlanilha} type="file" accept=".xlsx,.xlsm,.csv" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; lerPlanilhaDaObra(f); }} />
            <button type="button" onClick={() => refPlanilha.current && refPlanilha.current.click()}
              title="Liga ao catálogo o item que a planilha da obra diz (coluna “Itens da nota fiscal”)"
              style={{ background: "#fff", color: "#374151", border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 10, padding: "7px 14px", fontSize: 12.5,
                cursor: "pointer", fontFamily: "inherit" }}>
              Itens pela planilha da obra
            </button>
          </>
        )}
        {pendencias && pendencias.total > 0 && (
          <button type="button" onClick={() => setConferindo(!conferindo)}
            style={{ background: "#fff", color: "#0474f4", border: "1.5px solid #0474f4", borderRadius: 10, padding: "7px 14px", fontSize: 12.5,
              fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Completar a base ({pendencias.total})
          </button>
        )}
        {paramPC && <JanelaParametrosPrestacao valor={paramPC} obra={obraDaPrestacao} aoMudar={setParamPC}
          modulos={temModulos ? listaModulos : null} nomeEmpreendimento={nomeEmpreendimento}
          aoCancelar={() => setParamPC(null)} aoGerar={gerarComParametros} />}
        {previa && <PreviaDaPrestacao previa={previa} obra={previa.dados && previa.dados.nomePC ? { nome: previa.dados.nomePC } : obraDaPrestacao} isMobile={isMobile}
          aoVoltar={() => { setParamPC({ ...previa.param, erro: "" }); setPrevia(null); }}
          aoCancelar={() => setPrevia(null)}
          aoGerar={() => { const p = previa.param; setPrevia(null); baixarPrestacao(p); }}
          aoGerarPdf={() => { const p = previa.param; setPrevia(null); baixarPrestacao(p, { soPdf: true }); }}
          aoMudarMarco={aoGuardarMarcos ? mudarMarco : null} aoMoverMarco={aoGuardarMarcos ? moverMarco : null} />}
        {!doEscritorio && (
          <button type="button" data-vk-prestacao="1" onClick={abrirPrestacao} disabled={!filtradas.length || !!(prestando && prestando.fazendo)}
            title="Resumo por conta, lista das notas e os arquivos nota a nota, do que está filtrado (só o que foi pago)"
            style={{ background: "#fff", color: "#0474f4", border: "1.5px solid #0474f4", borderRadius: 10, padding: "7px 14px", fontSize: 12.5, fontWeight: 600,
              cursor: filtradas.length ? "pointer" : "default", opacity: filtradas.length ? 1 : 0.5, fontFamily: "inherit" }}>
            {prestando && prestando.fazendo ? prestando.msg : "Prestação de contas"}
          </button>
        )}
        <button type="button" onClick={baixar} disabled={!filtradas.length || !!baixando}
          style={{ background: "#0474f4", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12.5, fontWeight: 600,
            cursor: filtradas.length ? "pointer" : "default", opacity: filtradas.length ? 1 : 0.5, fontFamily: "inherit" }}>
          {baixando || "Baixar Excel"}
        </button>
        </div>
      </div>
      {prestando && !prestando.fazendo && (
        <div data-vk-prestacao-msg="1" style={{ fontSize: 12.5, color: prestando.erro ? "#b45309" : "#047857", marginBottom: 10 }}>
          {prestando.msg} <button type="button" onClick={() => setPrestando(null)}
            style={{ background: "none", border: "none", padding: 0, color: "#6b7280", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>fechar</button>
        </div>
      )}
      {gravandoBase && !conferindo && <div style={{ fontSize: 12.5, color: /^Não/.test(gravandoBase) ? "#b91c1c" : "#047857", marginBottom: 10 }}>{gravandoBase}</div>}
      {conferindo && pendencias && (
        <div style={{ border: "1.5px solid #0474f4", borderRadius: 12, padding: 14, marginBottom: 12, background: "#f8fbff" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Completar a base</div>
          <div style={{ fontSize: 12, color: "#4b5563", margin: "2px 0 10px" }}>
            O que as regras preenchem no que já está gravado. Confira; nada muda até você gravar.
          </div>
          {planilhaObra && (
            <div style={{ fontSize: 12, color: "#1e3a5f", margin: "-4px 0 10px" }}>
              Planilha <b>{planilhaObra.nome}</b>: {planilhaObra.linhas.length} itens lidos,
              {" "}{(pendencias.grupos.planilha || []).length} itens ligados ao catálogo
              {(pendencias.grupos.outros || []).length ? ` e ${(pendencias.grupos.outros || []).length} “Outros”${gruposFora.outros ? " (desmarcados)" : ""}` : ""}.
            </div>
          )}
          {[["papel", "Número do papel (e nome do arquivo)"], ["escritorio", "Mesmo número no lançamento do escritório"],
            ["novos", "Catálogo: o que a planilha usa e ainda não existe"],
            ["planilha", "Item ligado ao catálogo pela planilha da obra"],
            ["outros", "“Outros” da planilha ligado ao item Outros do catálogo"], ["catalogo", "Item ligado ao catálogo pelo nome"], ["unidade", "Unidade com a grafia do catálogo"],
            ["ajuste", "Ajustes combinados"], ["insumos", "Catálogo"]].map(([k, titulo]) => {
            const linhas = pendencias.grupos[k] || [];
            if (!linhas.length) return null;
            return (
              <details key={k} open={linhas.length <= 12} style={{ marginBottom: 8, opacity: gruposEscolhidos.indexOf(k) < 0 ? 0.5 : 1 }}>
                <summary style={{ fontSize: 12.5, fontWeight: 600, color: "#111827", cursor: "pointer" }}>
                  <input type="checkbox" checked={gruposEscolhidos.indexOf(k) >= 0} disabled={k === "escritorio" && !!gruposFora.papel}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setGruposFora((x) => ({ ...x, [k]: !e.target.checked }))}
                    style={{ marginRight: 6, verticalAlign: "middle" }} />
                  {titulo} — {linhas.length}
                </summary>
                <div style={{ maxHeight: 260, overflowY: "auto", marginTop: 4 }}>
                  {linhas.map((l, i) => (
                    <div key={i} style={{ fontSize: 11.5, color: "#374151", padding: "3px 0", borderBottom: "1px solid rgba(38,36,33,0.06)", overflowWrap: "anywhere" }}>{l.texto}</div>
                  ))}
                </div>
              </details>
            );
          })}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={gravarCompletar} disabled={!totalEscolhido || (!!gravandoBase && gravandoBase === "Gravando…")}
              style={{ background: "#0474f4", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {gravandoBase === "Gravando…" ? "Gravando…" : `Gravar ${totalEscolhido} ${totalEscolhido === 1 ? "ajuste" : "ajustes"}`}
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
            <div key={l.id} onClick={() => setLinhaMarcada(linhaMarcada === l.id ? "" : l.id)} aria-selected={linhaMarcada === l.id}
              style={{ border: `1px solid ${linhaMarcada === l.id ? "#93c5fd" : "rgba(38,36,33,0.12)"}`, borderRadius: 12, padding: 12,
                background: linhaMarcada === l.id ? "#dbeafe" : "#fff", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", minWidth: 0 }}>{(doEscritorio ? l.descricaoLanc : l.insumoNome) || l.descricaoLanc || "—"}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", whiteSpace: "nowrap" }}>{moeda(l.total)}</div>
              </div>
              <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 3 }}>
                {[l.ref ? "ref " + l.ref : "", l.fornecedor, l.insumoNome && l.descricaoLanc !== l.insumoNome ? l.descricaoLanc : "",
                  l.nota && l.descricaoLanc !== "Nota " + l.nota ? "nota " + l.nota : "", l.valorNota !== l.total ? "total nota " + moeda(l.valorNota) : "",
                  l.pago ? diaBR(l.pagoEm) : "vence " + diaBR(l.vencimento)].filter(Boolean).join(" · ")}
              </div>
              <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 2 }}>
                {(doEscritorio
                  ? [l.conta, l.unidadeNegocio, [l.cliente, l.obra].filter(Boolean).join(" / "), "competência " + mesBR(l.competencia), l.meio,
                    l.afetaSaldo === "Não" ? "não afeta o saldo" : ""]
                  : [l.quantidade ? `${num(l.quantidade)} ${l.unidade}`.trim() + (l.unitario != null ? ` × ${num(l.unitario, 2)}` : "") : "", l.etapa, l.grupo, l.conta,
                    l.unidadeNegocio, !obraFixa ? [l.cliente, l.obra].filter(Boolean).join(" / ") : ""]).filter(Boolean).join(" · ")}
              </div>
              {comAcoes && <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end" }}>{botoesDaLinha(l)}</div>}
              {linhasDaFaturaMarcada(l)}
            </div>
          ))}
        </div>
      ) : (
        // A grade rola dentro de uma caixa da altura da tela: os títulos ficam
        // presos no alto e a barra de rolagem lateral fica sempre à vista, em
        // vez de lá no fim da lista.
        <div data-vk-base-grade="1" ref={gradeRef} style={{ overflow: "auto", maxHeight: alturaGrade || "calc(100vh - 140px)", minHeight: 320,
          border: "1px solid rgba(38,36,33,0.12)", borderRadius: 12, background: "#fff" }}>
          <style>{`[data-vk-base-grade="1"]::-webkit-scrollbar{width:12px;height:12px}
[data-vk-base-grade="1"]::-webkit-scrollbar-track{background:#f3f4f6;border-radius:0 0 12px 12px}
[data-vk-base-grade="1"]::-webkit-scrollbar-thumb{background:#9ca3af;border-radius:8px;border:3px solid #f3f4f6}
[data-vk-base-grade="1"]::-webkit-scrollbar-thumb:hover{background:#6b7280}
[data-vk-base-linha="1"]:hover{background:#f3f7fd}
[data-vk-base-linha="1"]:hover>[data-vk-base-fixa="1"]{background:#f3f7fd !important}
[data-vk-base-linha="1"][aria-selected="true"]>[data-vk-base-fixa="1"]{background:#dbeafe !important}`}</style>
          <div style={{ minWidth: largura }}>
            <div style={{ display: "grid", gridTemplateColumns: grade, gap: 10, padding: "8px 12px", borderBottom: "1px solid rgba(38,36,33,0.1)",
              fontSize: 10.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.3, position: "sticky", top: 0, background: "#fff", zIndex: 2,
              boxShadow: "0 1px 0 rgba(38,36,33,0.1)" }}>
              {COLS.map((c, k) => {
                const ativo = !!colFiltros[c.titulo] || (ordemCol && ordemCol.titulo === c.titulo);
                const al = alinhamentoDaCelula(c);
                const fixa = estiloFixa(k, "#fff");
                return (
                  <button key={c.titulo} type="button" title={"Filtrar ou ordenar por " + c.titulo} data-vk-base-fixa={fixa ? "1" : undefined}
                    onClick={(e) => {
                      if (menuCol && menuCol.titulo === c.titulo) { setMenuCol(null); return; }
                      const r = e.currentTarget.getBoundingClientRect();
                      const vals = valoresDaColuna(relat, c.titulo, colFiltros).map((v) => v.texto);
                      setMenuCol({ titulo: c.titulo, x: Math.min(r.left, window.innerWidth - 290), y: r.bottom + 4, busca: "",
                        marcados: colFiltros[c.titulo] ? colFiltros[c.titulo].slice() : vals });
                    }}
                    style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, minWidth: 0,
                      justifyContent: al === "center" ? "center" : al === "right" ? "flex-end" : "flex-start",
                      color: ativo ? "#0474f4" : undefined, fontFamily: "inherit", ...(fixa || {}), ...(fixa ? { zIndex: 3, alignSelf: "stretch" } : {}) }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.titulo}</span>
                    <span style={{ fontSize: 9, flexShrink: 0 }}>
                      {ordemCol && ordemCol.titulo === c.titulo ? (ordemCol.dir > 0 ? "▲" : "▼") : ""}{colFiltros[c.titulo] ? "⏷" : "▾"}
                    </span>
                  </button>
                );
              })}
              {comAcoes && <span />}
            </div>
            {visiveis.map((l, i) => (
              <div key={l.id} data-vk-base-linha="1" onClick={() => setLinhaMarcada(linhaMarcada === l.id ? "" : l.id)}
                aria-selected={linhaMarcada === l.id}
                style={{ display: "grid", gridTemplateColumns: grade, gap: 10, padding: "7px 12px", borderBottom: "1px solid rgba(38,36,33,0.05)",
                  fontSize: 12, color: "#374151", alignItems: "baseline", cursor: "pointer",
                  background: linhaMarcada === l.id ? "#dbeafe" : undefined }}>
                {COLS.map((c, k) => {
                  const t = textoDaCelula(celulasDe[i][c.j], c);
                  const destaque = c.titulo === "Valor" || (doEscritorio && c.titulo === "Valor total nota");
                  const fixa = estiloFixa(k, linhaMarcada === l.id ? "#dbeafe" : "#fff");
                  return (
                    <span key={c.titulo} title={t.length > 12 ? t : undefined} data-vk-base-fixa={fixa ? "1" : undefined}
                      style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        textAlign: alinhamentoDaCelula(c), fontVariantNumeric: "tabular-nums",
                        color: destaque ? (doEscritorio && l.sinal > 0 ? "#047857" : "#111827") : undefined, fontWeight: destaque ? 600 : 400,
                        ...(fixa || {}), ...(fixa ? { alignSelf: "stretch", paddingTop: 7, paddingBottom: 7, marginTop: -7, marginBottom: -7 } : {}) }}>
                      {t}
                    </span>
                  );
                })}
                {comAcoes && botoesDaLinha(l)}
                {linhasDaFaturaMarcada(l)}
              </div>
            ))}
          </div>
        </div>
      )}
      {menuCol && (() => {
        const col = relat.colunas.find((c) => c.titulo === menuCol.titulo) || {};
        const todos = valoresDaColuna(relat, menuCol.titulo, colFiltros);
        const busca = cpSemAcento(menuCol.busca || "");
        const lista = todos.filter((v) => !busca || cpSemAcento(v.texto || "(vazias)").indexOf(busca) >= 0);
        const marcado = (t) => menuCol.marcados.indexOf(t) >= 0;
        const todosMarcados = lista.every((v) => marcado(v.texto));
        const numerico = ["moeda", "numero", "numeroTexto", "data", "mes"].indexOf(col.tipo) >= 0;
        const ordenar = (dir) => { setOrdemCol({ titulo: menuCol.titulo, dir }); setMenuCol(null); };
        const podeAplicar = busca ? lista.some((v) => marcado(v.texto)) : menuCol.marcados.length > 0;
        const aplicar = () => {
          const nv = { ...colFiltros };
          // como no Excel: com algo digitado na busca, o OK fica só com o que
          // a busca achou (e está marcado); sem busca, vale o que está marcado
          const escolhidos = busca ? lista.map((v) => v.texto).filter(marcado) : menuCol.marcados.slice();
          if (!escolhidos.length) return;
          // marcar tudo é o mesmo que não filtrar
          if (todos.every((v) => escolhidos.indexOf(v.texto) >= 0)) delete nv[menuCol.titulo];
          else nv[menuCol.titulo] = escolhidos;
          setColFiltros(nv); setLimite(300); setMenuCol(null);
        };
        const opcao = { all: "unset", cursor: "pointer", display: "block", padding: "6px 10px", borderRadius: 8, fontSize: 12.5, color: "#111827", fontFamily: "inherit" };
        return (
          <>
            <div onClick={() => setMenuCol(null)} style={{ position: "fixed", inset: 0, zIndex: 999 }} />
            <div data-vk-base-filtro="1" style={{ position: "fixed", left: Math.max(8, menuCol.x), top: Math.min(menuCol.y, window.innerHeight - 420),
              width: 280, maxWidth: "calc(100vw - 16px)", zIndex: 1000, background: "#fff", border: "1px solid rgba(38,36,33,0.16)", borderRadius: 12,
              boxShadow: "0 10px 30px rgba(0,0,0,0.14)", padding: 8, fontSize: 12.5 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.3, padding: "4px 10px 6px" }}>{menuCol.titulo}</div>
              <button type="button" style={opcao} onClick={() => ordenar(1)}>{numerico ? "Ordenar do menor para o maior" : "Ordenar de A a Z"}</button>
              <button type="button" style={opcao} onClick={() => ordenar(-1)}>{numerico ? "Ordenar do maior para o menor" : "Ordenar de Z a A"}</button>
              <div style={{ borderTop: "1px solid rgba(38,36,33,0.08)", margin: "6px 0" }} />
              <input autoFocus value={menuCol.busca}
                // como no Excel: ao digitar, tudo o que a busca acha já vem marcado
                onChange={(e) => setMenuCol({ ...menuCol, busca: e.target.value, marcados: e.target.value ? todos.map((v) => v.texto) : menuCol.marcados })}
                onKeyDown={(e) => { if (e.key === "Enter") aplicar(); if (e.key === "Escape") setMenuCol(null); }}
                placeholder="Procurar…" aria-label={"Procurar em " + menuCol.titulo}
                style={{ ...input, padding: "6px 9px", fontSize: 12.5, marginBottom: 6 }} />
              <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid rgba(38,36,33,0.08)", borderRadius: 8, padding: "4px 0" }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>
                  <input type="checkbox" checked={todosMarcados} onChange={() => {
                    const ts = lista.map((v) => v.texto);
                    setMenuCol({ ...menuCol, marcados: todosMarcados ? menuCol.marcados.filter((t) => ts.indexOf(t) < 0)
                      : [...new Set(menuCol.marcados.concat(ts))] });
                  }} />
                  {busca ? "(Selecionar o que achou)" : "(Selecionar tudo)"}
                </label>
                {lista.map((v) => (
                  <label key={v.texto} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 10px", cursor: "pointer" }}>
                    <input type="checkbox" checked={marcado(v.texto)} onChange={() => setMenuCol({ ...menuCol,
                      marcados: marcado(v.texto) ? menuCol.marcados.filter((t) => t !== v.texto) : menuCol.marcados.concat([v.texto]) })} />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={v.texto}>{v.texto || "(Vazias)"}</span>
                    <span style={{ color: "#9ca3af", fontSize: 11 }}>{v.n}</span>
                  </label>
                ))}
                {!lista.length && <div style={{ padding: "6px 10px", color: "#9ca3af" }}>Nada com esse texto.</div>}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => { const nv = { ...colFiltros }; delete nv[menuCol.titulo]; setColFiltros(nv);
                  if (ordemCol && ordemCol.titulo === menuCol.titulo) setOrdemCol(null); setMenuCol(null); }}
                  style={{ ...opcao, color: "#0474f4", display: "inline-block" }}>Limpar</button>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={() => setMenuCol(null)} style={{ background: "#fff", color: "#374151", border: "1.5px solid rgba(38,36,33,0.16)",
                    borderRadius: 9, padding: "5px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                  <button type="button" onClick={aplicar} disabled={!podeAplicar}
                    style={{ background: "#0474f4", color: "#fff", border: "none", borderRadius: 9, padding: "6px 14px", fontSize: 12.5, fontWeight: 600,
                      cursor: podeAplicar ? "pointer" : "default", opacity: podeAplicar ? 1 : 0.5, fontFamily: "inherit" }}>OK</button>
                </div>
              </div>
            </div>
          </>
        );
      })()}
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
