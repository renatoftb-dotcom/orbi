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
  gestaoObra: "mo_diversos",
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
const DIAS_PERIODO = { semanais: 7, quinzenais: 15, mensais: 30 };
// Data-âncora do cronograma: o início previsto quando houver, senão a
// assinatura. Sem nenhuma das duas, as parcelas saem sem vencimento.
function ancoraContrato(c) {
  const o = c || {};
  return o.dataInicio || o.dataAssinatura || "";
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
  const passo = DIAS_PERIODO[per] || 15;
  const rotuloPer = per === "semanais" ? "semanal" : per === "mensais" ? "mensal" : "quinzenal";
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
        vencimento: ancora ? somarDias(ancora, passo * i) : "",
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
          vencimento: ancora ? somarDias(ancora, passo * i) : "",
        });
      }
    }
  } else if (modo === "entradaFinal") {
    const porItem = (c.entradaEscopo || "contrato") === "item";
    const itens = (c.itens || []).filter((i) => i && (String(i.descricao || "").trim() || Number(i.valor)));
    const pct = (Number(c.entradaPct) || 0) / 100;
    if (porItem && itens.length) {
      // sem data: cada metade vence na liberação e na conclusão do item
      itens.forEach((it, idx) => {
        const v = Number(it.valor) || 0;
        const p1 = Math.floor(v * pct * 100) / 100;
        const nome = it.descricao || `Item ${idx + 1}`;
        linhas.push({ n: linhas.length + 1, parcela: linhas.length + 1, totalParcelas: itens.length * 2, descricao: `${nome} — entrada`, valor: p1, vencimento: "" });
        linhas.push({ n: linhas.length + 1, parcela: linhas.length + 1, totalParcelas: itens.length * 2, descricao: `${nome} — conclusão`, valor: Math.round((v - p1) * 100) / 100, vencimento: "" });
      });
    } else {
      const e = entradaESaldo(total, c.entradaPct, 1);
      if (e.entrada > 0) linhas.push({ n: 1, parcela: 1, totalParcelas: 2, descricao: "Entrada", valor: e.entrada, vencimento: c.dataAssinatura || ancora });
      if (e.saldo > 0) linhas.push({ n: linhas.length + 1, parcela: linhas.length + 1, totalParcelas: 2, descricao: "Saldo na conclusão", valor: e.saldo, vencimento: vencimentoFinal(c) });
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
    if (anterior && anterior.pago) return anterior;
    return anterior ? { ...nova, observacao: anterior.observacao || "" } : nova;
  });
  // parcela paga que não existe mais no contrato continua na lista: o
  // dinheiro saiu, e sumir com ela esconderia um pagamento real
  const orfas = pagas.filter((x) => !geradas.some((g) => g.id === x.id));
  return [...outras, ...geradas, ...orfas];
}
// Some as contas de um contrato removido, menos as que já foram pagas.
function removerContasDoContrato(contas, contratoId) {
  return (contas || []).filter((x) => x.origem !== "contrato" || x.contratoId !== contratoId || x.pago);
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

// ── Visões ──────────────────────────────────────────────────────
const VISOES_CONTAS = [
  { id: "mes", nome: "Mês" },
  { id: "ano", nome: "Ano" },
  { id: "fornecedor", nome: "Fornecedor" },
  { id: "contrato", nome: "Contrato" },
];
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
  const semData = "__sem_data__";
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

// ── Gráfico do fluxo mensal ─────────────────────────────────────
// Barras empilhadas: pago embaixo, vencido no meio, a pagar no topo — o que
// falta pagar fica na ponta, que é o que se olha. O topo é arredondado pela
// barra inteira (clipPath), não faixa a faixa, senão apareceriam entalhes.
//
// A entrada é uma transição disparada depois da montagem, e não uma animação
// CSS: `transform-box: fill-box` num <g> não é respeitado por todos os
// navegadores, e a barra ficava parada. Com estado + transition, o navegador
// sempre tem um valor inicial e um final para interpolar.
const CP_FAIXAS = [["pago", "#cbd5e1", "Pago"], ["vencido", "#111827", "Vencido"], ["aberto", "#0474f4", "A pagar"]];
function GraficoFluxoMensal({ fluxo, hojeIso, onEscolherMes, uid: idGrafico }) {
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    // dois quadros: o primeiro pinta as barras zeradas, o segundo dispara a transição
    let q2 = 0;
    const q1 = requestAnimationFrame(() => { q2 = requestAnimationFrame(() => setPronto(true)); });
    return () => { cancelAnimationFrame(q1); cancelAnimationFrame(q2); };
  }, []);
  if (!fluxo || !fluxo.meses.length) return null;

  const LARG = 40, ESPACO = 16, ALT = 130, BASE = ALT + 16;
  const largura = Math.max(fluxo.meses.length * (LARG + ESPACO), 220);
  const altura = (v) => (fluxo.maior > 0 && v > 0 ? Math.max(3, (v / fluxo.maior) * ALT) : 0);
  const curto = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v > 0 ? String(Math.round(v)) : "");
  const mesAtual = String(hojeIso || "").slice(0, 7);

  return (
    <div style={{ overflowX: "auto" }}>
      <style>{`@media (prefers-reduced-motion: reduce) { .vk-cp-anim { transition: none !important; } }`}</style>
      <svg width={largura} height={ALT + 46} role="img" style={{ display: "block" }}>
        <defs>
          {fluxo.meses.map((m, i) => {
            const x = i * (LARG + ESPACO) + ESPACO / 2;
            const h = CP_FAIXAS.reduce((a, [k]) => a + altura(m[k]), 0);
            return (
              <clipPath key={m.chave} id={`vk-cp-${idGrafico}-${i}`}>
                <rect x={x} y={BASE - h} width={LARG} height={Math.max(h, 1)} rx={5} ry={5} />
              </clipPath>
            );
          })}
        </defs>
        {fluxo.meses.map((m, i) => {
          const x = i * (LARG + ESPACO) + ESPACO / 2;
          const hTotal = CP_FAIXAS.reduce((a, [k]) => a + altura(m[k]), 0);
          const atraso = i * 60;
          let y = BASE;
          return (
            <g key={m.chave} onClick={() => onEscolherMes && onEscolherMes(m.chave)} style={{ cursor: onEscolherMes ? "pointer" : "default" }}>
              <title>{`${rotuloMes(m.chave)} — ${fmtMoedaCtr(m.total)}`}</title>
              <g className="vk-cp-anim" clipPath={`url(#vk-cp-${idGrafico}-${i})`}
                style={{
                  transform: pronto ? "scaleY(1)" : "scaleY(0)",
                  transformOrigin: `${x + LARG / 2}px ${BASE}px`,
                  transformBox: "view-box",
                  transition: `transform 620ms cubic-bezier(0.2,0.75,0.3,1) ${atraso}ms`,
                }}>
                {CP_FAIXAS.map(([k, cor]) => {
                  const h = altura(m[k]);
                  if (!h) return null;
                  y -= h;
                  return <rect key={k} x={x} y={y} width={LARG} height={h} fill={cor} />;
                })}
              </g>
              <text className="vk-cp-anim" x={x + LARG / 2} y={BASE - 5 - hTotal} textAnchor="middle"
                fontSize="10.5" fontWeight="700" fill="#111827"
                style={{ opacity: pronto ? 1 : 0, transition: `opacity 320ms ease-out ${atraso + 380}ms` }}>{curto(m.total)}</text>
              <text x={x + LARG / 2} y={BASE + 16} textAnchor="middle" fontSize="11"
                fill={m.chave === mesAtual ? "#111827" : "#4b5563"} fontWeight={m.chave === mesAtual ? 700 : 400}>{m.rotulo}</text>
            </g>
          );
        })}
        <line x1="0" y1={BASE + 0.5} x2={largura} y2={BASE + 0.5} stroke="rgba(38,36,33,0.14)" strokeWidth="1" />
      </svg>
    </div>
  );
}
