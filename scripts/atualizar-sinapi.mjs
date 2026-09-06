#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// atualizar-sinapi.mjs — rotina de atualização dos parâmetros SINAPI
// ═══════════════════════════════════════════════════════════════
// O que atualiza (todos com base SP, buscadorsinapi.com.br/sp):
//   1. PRECO_HORA_SEED (cronograma-seed.jsx): R$/h por ofício, desonerado e
//      onerado, das composições "<ofício> com encargos complementares".
//   2. PRODUTIVIDADE_SEED.horas: recalculadas pela `receita` de cada serviço
//      (Σ fator × coeficientes de mão de obra da composição), ajudantes em
//      "servente". Serviço com receita null é mantido e listado no relatório.
//   3. PRECO_HORA_REFERENCIA: mês de referência.
//   4. insumos-seed-cadastro.jsx: preço dos materiais cujo `observacao` cita
//      uma URL buscadorsinapi.com.br/sp/insumo/<código>.
//
// Uso:
//   node scripts/atualizar-sinapi.mjs listar            → JSON com o que coletar
//     (é também o jobs/sinapi-config.json do backend: códigos, receitas e base)
//   node scripts/atualizar-sinapi.mjs aplicar coleta.json [--forcar] [--simular]
//
// `coleta.json` (produzido pela rotina agendada do Claude via leitura das
// páginas, ou à mão):
// {
//   "referencia": "ago/2026", "coletadoEm": "2026-09-20",
//   "composicoes": { "88309": { "nome": "PEDREIRO COM ENCARGOS...", "unidade": "H",
//                               "precoDesonerado": 35.18, "precoOnerado": 37.26,
//                               "maoDeObra": [ { "nome": "PEDREIRO", "coeficiente": 1.61 } ] } },
//   "insumos": { "2391": { "nome": "...", "unidade": "UN", "precoDesonerado": 322.39 } }
// }
// Regras de segurança: variação de preço > 25% ou de horas > 30% não é
// aplicada sem --forcar (fica no relatório). Composição ausente na coleta
// (404 = provavelmente substituída) é mantida e listada. Nada é gravado com
// --simular. Sem rede aqui? Não importa: este script nunca acessa a internet.
// ═══════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dirname, "..");
const ARQ_CRONO = join(RAIZ, "src", "modules", "cronograma-seed.jsx");
const ARQ_INSUMOS = join(RAIZ, "src", "modules", "insumos-seed-cadastro.jsx");
const DIR_REL = join(RAIZ, "docs", "referencia-orcamento");
const BASE_URL = "https://buscadorsinapi.com.br/sp";
const LIMITE_PRECO = 0.25;
const LIMITE_HORAS = 0.30;

// Ofício de cada profissional das composições (mesma regra da semente:
// ajudantes, auxiliares, serventes e operador de betoneira → servente).
const OFICIO_POR_PROFISSIONAL = [
  [/^(SERVENTE|AJUDANTE|AUXILIAR|OPERADOR DE BETONEIRA)/, "servente"],
  [/^PEDREIRO/, "pedreiro"],
  [/^(CARPINTEIRO|MARCENEIRO)/, "carpinteiro"],
  [/^ARMADOR/, "armador"],
  [/^PINTOR/, "pintor"],
  [/^ELETRICISTA/, "eletricista"],
  [/^ENCANADOR/, "encanador"],
  [/^(AZULEJISTA|LADRILH)/, "azulejista"],
  [/^(MONTADOR|GESSEIRO)/, "gesseiro"],
  [/^TELHADISTA/, "telhadista"],
  [/^IMPERMEABILIZADOR/, "impermeabilizador"],
];
function normalizarNome(n) {
  return String(n || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    .replace(/\s+COM\s+ENCARGOS\s+COMPLEMENTARES.*$/, "").replace(/\s+\(HORISTA\)/, "").trim();
}
function oficioDe(nomeProfissional, avisos) {
  const n = normalizarNome(nomeProfissional);
  for (const [re, of] of OFICIO_POR_PROFISSIONAL) if (re.test(n)) return of;
  avisos.push(`profissional sem ofício mapeado: "${nomeProfissional}" → contado como servente`);
  return "servente";
}

// ── Leitura das sementes (avaliadas em sandbox, sem React) ──
function carregarSeedCronograma() {
  const src = readFileSync(ARQ_CRONO, "utf-8");
  const M = new Function(src + "\nreturn { PRECO_HORA_SEED, PRODUTIVIDADE_SEED, PRECO_HORA_REFERENCIA, OFICIOS };")();
  return { src, ...M };
}
function insumosComSinapi() {
  if (!existsSync(ARQ_INSUMOS)) return { src: "", itens: [] };
  const src = readFileSync(ARQ_INSUMOS, "utf-8");
  const itens = [];
  const re = /\{ codigo:"([^"]+)", nome:"((?:[^"\\]|\\.)*)"[^\n]*?precoReferencia:([0-9.]+)[^\n]*?buscadorsinapi\.com\.br\/sp\/insumo\/(\d+)[^\n]*\}/g;
  let m;
  while ((m = re.exec(src))) itens.push({ codigo: m[1], nome: m[2], preco: Number(m[3]), sinapi: m[4], linhaInicio: m.index, linhaFim: m.index + m[0].length });
  return { src, itens };
}

// ── listar ──
function listar() {
  const { PRECO_HORA_SEED, PRODUTIVIDADE_SEED, PRECO_HORA_REFERENCIA } = carregarSeedCronograma();
  const composicoes = new Set();
  const horistas = {};
  for (const [of, p] of Object.entries(PRECO_HORA_SEED)) { composicoes.add(p.codigo); horistas[p.codigo] = of; }
  const receitas = {};
  const manuais = [];
  for (const [id, s] of Object.entries(PRODUTIVIDADE_SEED)) {
    if (!s.receita) { manuais.push(id); continue; }
    receitas[id] = s.receita.map((r) => ({ codigo: String(r.c), fator: r.f }));
    for (const r of s.receita) composicoes.add(String(r.c));
  }
  const { itens } = insumosComSinapi();
  const baselineProd = {};
  for (const [id, s] of Object.entries(PRODUTIVIDADE_SEED)) baselineProd[id] = { horas: s.horas };
  const baselineIns = {};
  for (const i of itens) baselineIns[i.sinapi] = { vicke: i.codigo, preco: i.preco };
  const out = {
    geradoEm: new Date().toISOString().slice(0, 10),
    referenciaAtual: PRECO_HORA_REFERENCIA,
    // base de partida do backend (jobs/sinapi-coletor.js) na primeira coleta
    baseline: { referencia: PRECO_HORA_REFERENCIA.replace(/^SINAPI SP /, ""), precoHora: PRECO_HORA_SEED, produtividade: baselineProd, insumos: baselineIns },
    instrucao: "Para cada URL em `paginas`, ler a página e devolver, em coleta.json: nome, unidade, preço SP desonerado e onerado (total da composição) e, em `maoDeObra`, cada profissional com o coeficiente em horas. Insumos: nome, unidade e preço desonerado.",
    composicoes: [...composicoes].sort().map((c) => ({ codigo: c, url: `${BASE_URL}/composicao/${c}`, horista: horistas[c] || null })),
    insumos: itens.map((i) => ({ codigo: i.sinapi, url: `${BASE_URL}/insumo/${i.sinapi}`, vicke: i.codigo, nome: i.nome, preco: i.preco })),
    receitas, servicosManuais: manuais,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

// ── aplicar ──
function num(x) { const n = Number(String(x ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; }
function pct(a, b) { return b ? (a - b) / b : (a ? 1 : 0); }
function fmtPct(x) { return `${x > 0 ? "+" : ""}${(x * 100).toFixed(1)}%`; }
function r3(x) { return Math.round(x * 1000) / 1000; }
function r2(x) { return Math.round(x * 100) / 100; }

function aplicar(arqColeta, opts) {
  const coleta = JSON.parse(readFileSync(arqColeta, "utf-8"));
  const comps = coleta.composicoes || {};
  const insumosColeta = coleta.insumos || {};
  const referencia = String(coleta.referencia || "").trim();
  const coletadoEm = String(coleta.coletadoEm || new Date().toISOString().slice(0, 10)).slice(0, 10);
  if (!referencia) throw new Error("coleta.json sem `referencia` (ex.: \"ago/2026\")");

  const seed = carregarSeedCronograma();
  let src = seed.src;
  const rel = { referencia, coletadoEm, precoHora: [], horas: [], insumos: [], pendentes: [], avisos: [], mudou: 0 };

  // 1. R$/h por ofício
  for (const [of, p] of Object.entries(seed.PRECO_HORA_SEED)) {
    const c = comps[p.codigo];
    if (!c) { rel.pendentes.push(`R$/h ${of}: composição ${p.codigo} ausente na coleta — mantido ${p.desonerado}/${p.onerado}`); continue; }
    const des = num(c.precoDesonerado), one = num(c.precoOnerado);
    if (des == null || one == null) { rel.pendentes.push(`R$/h ${of}: preço não lido em ${p.codigo}`); continue; }
    const vd = pct(des, p.desonerado), vo = pct(one, p.onerado);
    const grande = Math.abs(vd) > LIMITE_PRECO || Math.abs(vo) > LIMITE_PRECO;
    if (grande && !opts.forcar) { rel.pendentes.push(`R$/h ${of} (${p.codigo}): ${p.desonerado} → ${des} (${fmtPct(vd)}) / ${p.onerado} → ${one} (${fmtPct(vo)}) — acima de ${LIMITE_PRECO * 100}%, não aplicado (use --forcar)`); continue; }
    if (des === p.desonerado && one === p.onerado) continue;
    const re = new RegExp(`(${of}:\\s*\\{\\s*codigo:\\s*"${p.codigo}",\\s*desonerado:\\s*)[0-9.]+(,\\s*onerado:\\s*)[0-9.]+`);
    if (!re.test(src)) { rel.avisos.push(`não achei a linha de ${of} em PRECO_HORA_SEED`); continue; }
    src = src.replace(re, `$1${des}$2${one}`);
    rel.precoHora.push({ oficio: of, codigo: p.codigo, de: [p.desonerado, p.onerado], para: [des, one], variacao: fmtPct(vd) });
    rel.mudou++;
  }

  // 2. Horas por serviço, pela receita
  for (const [id, s] of Object.entries(seed.PRODUTIVIDADE_SEED)) {
    if (!s.receita) { rel.pendentes.push(`horas ${id}: sem receita (somado à mão de sub-composições) — conferir manualmente`); continue; }
    const faltam = s.receita.filter((r) => !comps[String(r.c)] || !Array.isArray(comps[String(r.c)].maoDeObra));
    if (faltam.length) { rel.pendentes.push(`horas ${id}: composição(ões) ${faltam.map((r) => r.c).join(", ")} sem mão de obra na coleta — mantido`); continue; }
    const horas = {};
    for (const r of s.receita) {
      for (const mo of comps[String(r.c)].maoDeObra) {
        const coef = num(mo.coeficiente);
        if (coef == null || coef <= 0) continue;
        const of = oficioDe(mo.nome, rel.avisos);
        horas[of] = (horas[of] || 0) + r.f * coef;
      }
    }
    for (const of of Object.keys(horas)) horas[of] = r3(horas[of]);
    const atual = s.horas || {};
    const oficios = new Set([...Object.keys(atual), ...Object.keys(horas)]);
    let maior = 0, iguais = true;
    for (const of of oficios) {
      const a = atual[of] || 0, n = horas[of] || 0;
      if (Math.abs(a - n) > 0.0005) iguais = false;
      maior = Math.max(maior, Math.abs(pct(n, a)));
    }
    if (iguais) continue;
    if (maior > LIMITE_HORAS && !opts.forcar) { rel.pendentes.push(`horas ${id}: ${JSON.stringify(atual)} → ${JSON.stringify(horas)} (maior variação ${fmtPct(maior)}) — acima de ${LIMITE_HORAS * 100}%, não aplicado (use --forcar)`); continue; }
    const novoObj = "{ " + Object.entries(horas).map(([k, v]) => `${k}: ${v}`).join(", ") + " }";
    const re = new RegExp(`(^  ${id}:\\s*\\{[^\\n]*?horas:\\s*)\\{[^}]*\\}`, "m");
    if (!re.test(src)) { rel.avisos.push(`não achei a linha de ${id} em PRODUTIVIDADE_SEED`); continue; }
    src = src.replace(re, `$1${novoObj}`);
    rel.horas.push({ servico: id, de: atual, para: horas, variacao: fmtPct(maior) });
    rel.mudou++;
  }

  // 3. Referência
  const refNova = `SINAPI SP ${referencia}`;
  if (seed.PRECO_HORA_REFERENCIA !== refNova && (rel.precoHora.length || opts.forcar)) {
    src = src.replace(/var PRECO_HORA_REFERENCIA = "[^"]*";/, `var PRECO_HORA_REFERENCIA = "${refNova}";`);
    src = src.replace(/base SP [a-z]{3}\/\d{4}/g, `base SP ${referencia}`);
    rel.mudou++;
  }

  // 4. Insumos de mercado com URL SINAPI
  const ins = insumosComSinapi();
  let srcIns = ins.src;
  for (const it of ins.itens) {
    const c = insumosColeta[it.sinapi];
    if (!c) { rel.pendentes.push(`insumo ${it.codigo} (SINAPI ${it.sinapi}): ausente na coleta`); continue; }
    const preco = num(c.precoDesonerado);
    if (preco == null || preco <= 0) { rel.pendentes.push(`insumo ${it.codigo}: preço não lido`); continue; }
    const v = pct(preco, it.preco);
    if (Math.abs(v) > LIMITE_PRECO && !opts.forcar) { rel.pendentes.push(`insumo ${it.codigo} ${it.nome}: ${it.preco} → ${preco} (${fmtPct(v)}) — acima de ${LIMITE_PRECO * 100}%, não aplicado`); continue; }
    if (r2(preco) === it.preco) continue;
    const linha = srcIns.slice(it.linhaInicio, it.linhaFim);
    const nova = linha
      .replace(/precoReferencia:[0-9.]+/, `precoReferencia:${r2(preco)}`)
      .replace(/precoData:"[^"]*"/, `precoData:"${coletadoEm}"`)
      .replace(/SINAPI-SP [a-z]{3}\/\d{4}/g, `SINAPI-SP ${referencia}`);
    srcIns = srcIns.slice(0, it.linhaInicio) + nova + srcIns.slice(it.linhaFim);
    // recomputa offsets dos próximos (comprimento pode mudar)
    const delta = nova.length - linha.length;
    for (const o of ins.itens) if (o.linhaInicio > it.linhaInicio) { o.linhaInicio += delta; o.linhaFim += delta; }
    rel.insumos.push({ codigo: it.codigo, nome: it.nome, de: it.preco, para: r2(preco), variacao: fmtPct(v) });
    rel.mudou++;
  }

  // Validação: a semente continua avaliável
  new Function(src + "\nreturn PRODUTIVIDADE_SEED;")();
  if (srcIns) new Function(srcIns + "\nreturn 1;")();

  // Relatório
  const linhas = [];
  linhas.push(`# Atualização SINAPI — referência ${referencia} (coletado em ${coletadoEm})`, "");
  linhas.push(`Fonte: ${BASE_URL}. ${rel.mudou} alteração(ões)${opts.simular ? " (simulação, nada gravado)" : ""}.`, "");
  if (rel.precoHora.length) { linhas.push("## Preço da hora por ofício", ""); for (const p of rel.precoHora) linhas.push(`- ${p.oficio} (${p.codigo}): ${p.de[0]} / ${p.de[1]} → ${p.para[0]} / ${p.para[1]} (${p.variacao})`); linhas.push(""); }
  if (rel.horas.length) { linhas.push("## Horas por unidade (recalculadas pela receita)", ""); for (const h of rel.horas) linhas.push(`- ${h.servico}: ${JSON.stringify(h.de)} → ${JSON.stringify(h.para)} (maior variação ${h.variacao})`); linhas.push(""); }
  if (rel.insumos.length) { linhas.push("## Insumos de mercado (preço SINAPI-SP)", ""); for (const i of rel.insumos) linhas.push(`- ${i.codigo} ${i.nome}: ${i.de} → ${i.para} (${i.variacao})`); linhas.push("", "Lembrete: a semente só entra no catálogo do escritório em Insumos → Carregar catálogo padrão; itens já carregados mantêm o preço deles."); linhas.push(""); }
  if (rel.pendentes.length) { linhas.push("## Pendências (não aplicado — revisar)", ""); for (const p of rel.pendentes) linhas.push(`- ${p}`); linhas.push(""); }
  if (rel.avisos.length) { linhas.push("## Avisos", ""); for (const a of [...new Set(rel.avisos)]) linhas.push(`- ${a}`); linhas.push(""); }
  const relatorio = linhas.join("\n");

  if (!opts.simular) {
    if (src !== seed.src) writeFileSync(ARQ_CRONO, src);
    if (srcIns && srcIns !== ins.src) writeFileSync(ARQ_INSUMOS, srcIns);
    if (!existsSync(DIR_REL)) mkdirSync(DIR_REL, { recursive: true });
    const nomeRel = join(DIR_REL, `SINAPI-ATUALIZACAO-${referencia.replace("/", "-")}.md`);
    writeFileSync(nomeRel, relatorio);
    process.stderr.write(`relatório: ${nomeRel}\n`);
  }
  process.stdout.write(relatorio + "\n");
  return rel;
}

const [modo, arg, ...resto] = process.argv.slice(2);
try {
  if (modo === "listar") listar();
  else if (modo === "aplicar" && arg) aplicar(arg, { forcar: resto.includes("--forcar") || process.argv.includes("--forcar"), simular: resto.includes("--simular") || process.argv.includes("--simular") });
  else { process.stderr.write("uso: node scripts/atualizar-sinapi.mjs listar | aplicar coleta.json [--forcar] [--simular]\n"); process.exit(2); }
} catch (e) {
  process.stderr.write(`erro: ${e.message}\n`);
  process.exit(1);
}
