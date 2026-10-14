// Testes do briefing do cliente — node puro, sem framework.
//   node briefing.test.mjs
// O módulo é cortado no marcador da UI: só as regras e o resumo.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const raiz = dirname(fileURLToPath(import.meta.url));
const arquivo = readFileSync(join(raiz, "src", "modules", "briefing.jsx"), "utf8");
const corte = arquivo.indexOf("// UI — daqui para baixo");
if (corte < 0) throw new Error("Marcador de início da UI não encontrado em briefing.jsx");
const M = new Function(arquivo.slice(0, corte) + `
  return { BR_DICAS, BR_ESTILOS, BR_GALERIA, fotosDoEstilo, fotoDaGaleria, BRIEFING_SECOES, tipoBriefingDoProjeto, contextoDoBriefing, telasDoBriefing, pendenciasDaTela, pendenciasDoBriefing,
           resumoDoBriefing, opcoesDoRank, faltaNaPergunta, textoDaResposta };`)();

const testes = [];
let falhas = 0;
const teste = (nome, fn) => testes.push([nome, fn]);
const ids = (telas) => telas.flatMap((t) => t.perguntas.map((p) => p.id));

teste("Tipo do projeto sai do orçamento: reforma, comercial, apartamento, casa nova", () => {
  assert.strictEqual(M.tipoBriefingDoProjeto({ tipo: "Residencial", subtipo: "Reforma" }), "RA");
  assert.strictEqual(M.tipoBriefingDoProjeto({ tipo: "Clínica" }), "PC");
  assert.strictEqual(M.tipoBriefingDoProjeto({ tipo: "Conj. Comercial" }), "PC");
  assert.strictEqual(M.tipoBriefingDoProjeto({ tipo: "Residencial", subtipo: "Interiores" }), "AP");
  assert.strictEqual(M.tipoBriefingDoProjeto({ tipo: "Residencial", subtipo: "Construção nova" }), "CN");
  assert.strictEqual(M.tipoBriefingDoProjeto({}), "CN");
});

teste("Ramificação: casa nova pergunta do terreno; reforma, da idade e dos problemas; comercial não pergunta de moradores", () => {
  const cn = ids(M.telasDoBriefing({ tipo: "CN" }));
  assert.ok(cn.includes("terreno_proprio") && cn.includes("pavimentos") && cn.includes("moradores_qtd"));
  assert.ok(!cn.includes("idade_imovel") && !cn.includes("escopo") && !cn.includes("ramo"));
  const ra = ids(M.telasDoBriefing({ tipo: "RA" }));
  assert.ok(ra.includes("idade_imovel") && ra.includes("problemas") && ra.includes("durante_obra") && ra.includes("escopo"));
  assert.ok(!ra.includes("ampliacao_dir"));                             // só quando o escopo inclui ampliação
  assert.ok(ids(M.telasDoBriefing({ tipo: "RA", escopo: "ambas" })).includes("ampliacao_dir"));
  const pc = ids(M.telasDoBriefing({ tipo: "PC" }));
  assert.ok(pc.includes("ramo") && pc.includes("fluxo") && pc.includes("licencas"));
  assert.ok(!pc.includes("moradores_qtd") && !pc.includes("visitas_freq") && !pc.includes("uso") && !pc.includes("consentimento_saude"));
  // alugar/vender: sem rotina nem moradores, com perfil do comprador
  const venda = ids(M.telasDoBriefing({ tipo: "CN", uso: "vender" }));
  assert.ok(!venda.includes("visitas_freq") && !venda.includes("moradores_qtd") && venda.includes("perfil_comprador"));
});

teste("Ambientes: subperguntas só para o que é essencial ou desejável; lista do comercial é outra", () => {
  const sem = ids(M.telasDoBriefing({ tipo: "CN" }));
  assert.ok(!sem.includes("amb_cozinha_tipo") && !sem.includes("amb_piscina_uso"));
  const com = ids(M.telasDoBriefing({ tipo: "CN", programa: { cozinha: "essencial", piscina: "desejavel", gourmet: "dispensavel" } }));
  assert.ok(com.includes("amb_cozinha_tipo") && com.includes("amb_piscina_uso") && !com.includes("amb_gourmet_churrasqueira"));
  const prog = M.telasDoBriefing({ tipo: "PC" }).flatMap((t) => t.perguntas).find((p) => p.id === "programa");
  const itens = prog.itensPor({ tipo: "PC" }).map((x) => x[0]);
  assert.ok(itens.includes("recepcao") && !itens.includes("cozinha"));
  // apartamento não tem os itens de lote
  const ap = prog.itensPor({ tipo: "AP" }).map((x) => x[0]);
  assert.ok(!ap.includes("piscina") && ap.includes("cozinha"));
});

teste("Obrigatórias: a tela não passa sem elas; 'não sei' conta como resposta", () => {
  const telas = M.telasDoBriefing({ tipo: "CN" });
  const t0 = telas[0];
  const f = M.pendenciasDaTela(t0, { tipo: "CN" });
  assert.deepStrictEqual(Object.keys(f).sort(), ["relacao", "respondente"]);
  assert.deepStrictEqual(M.pendenciasDaTela(t0, { tipo: "CN", respondente: "Gustavo", relacao: "proprietario" }), {});
  // múltipla: basta uma opção ou o "outro"
  const motivos = telas[1].perguntas.find((p) => p.id === "motivos");
  assert.ok(M.faltaNaPergunta(motivos, { tipo: "CN" }, {}));
  assert.strictEqual(M.faltaNaPergunta(motivos, { tipo: "CN" }, { motivos: { sel: [], outro: "herança" } }), "");
  // mês com "não sei"
  const inicio = M.telasDoBriefing({ tipo: "CN" }).flatMap((t) => t.perguntas).find((p) => p.id === "inicio_obra");
  assert.strictEqual(M.faltaNaPergunta(inicio, { tipo: "CN" }, { inicio_obra: "nao_sei" }), "");
  // programa: ao menos um essencial ou desejável
  const prog = M.telasDoBriefing({ tipo: "CN" }).flatMap((t) => t.perguntas).find((p) => p.id === "programa");
  assert.ok(M.faltaNaPergunta(prog, { tipo: "CN" }, { programa: { sala_estar: "dispensavel" } }));
  assert.strictEqual(M.faltaNaPergunta(prog, { tipo: "CN" }, { programa: { sala_estar: "essencial" } }), "");
  // documentos: uma marcação por linha
  const docs = M.telasDoBriefing({ tipo: "RA" }).flatMap((t) => t.perguntas).find((p) => p.id === "documentos");
  assert.ok(M.faltaNaPergunta(docs, { tipo: "RA" }, { documentos: { planta: "tenho" } }));
  assert.strictEqual(M.faltaNaPergunta(docs, { tipo: "RA" }, { documentos: { planta: "tenho", habite_se: "depois", matricula: "nao_sei" } }), "");
  // moradores: faixa etária de cada um
  const mor = M.telasDoBriefing({ tipo: "CN" }).flatMap((t) => t.perguntas).find((p) => p.id === "moradores");
  assert.strictEqual(mor.obrig, undefined);
});

teste("Saúde só com consentimento (LGPD art. 11): sem a caixa marcada, as perguntas não aparecem", () => {
  const sem = ids(M.telasDoBriefing({ tipo: "CN" }));
  assert.ok(sem.includes("consentimento_saude") && !sem.includes("acessibilidade") && !sem.includes("alergias"));
  const com = ids(M.telasDoBriefing({ tipo: "CN", consentimento_saude: true }));
  assert.ok(com.includes("acessibilidade") && com.includes("alergias") && !com.includes("adaptacoes"));
  assert.ok(ids(M.telasDoBriefing({ tipo: "CN", consentimento_saude: true, acessibilidade: "futuro" })).includes("adaptacoes"));
});

teste("Top 3 vem dos ambientes marcados; resumo separa o programa e aponta pendências para a reunião", () => {
  const r = { tipo: "RA", respondente: "Gustavo", relacao: "proprietario", escopo: "ambas", uso: "morar",
    motivos: { sel: ["espaco", "modernizar"], outro: "" }, moradores_qtd: 3,
    moradores: [{ apelido: "eu", faixa: "30–59" }, { apelido: "esposa", faixa: "30–59", em_casa: "sim" }, { apelido: "filha", faixa: "6–12" }],
    programa: { cozinha: "essencial", gourmet: "essencial", piscina: "desejavel", academia: "dispensavel", _outro: "ateliê" },
    top3: ["gourmet", "cozinha", "outro:ateliê"], investimento: "nao_sei", documentos: { planta: "depois", habite_se: "nao_tenho", matricula: "tenho" },
    data_rigidez: "rigida", data_limite: "2027-06", estilo: "tropical", estilo_fotos: ["tropical-1", "rustico-3", "tropical-4"] };
  const opc = M.opcoesDoRank({ tipo: "RA" }, r).map((x) => x.v);
  assert.deepStrictEqual(opc, ["cozinha", "gourmet", "piscina", "outro:ateliê"]);
  const res = M.resumoDoBriefing(r);
  assert.deepStrictEqual(res.programa, { essencial: ["Cozinha", "Área gourmet / churrasqueira"], desejavel: ["Piscina"], outros: "ateliê" });
  const item = (id) => res.secoes.flatMap((s) => s.itens).find((x) => x.id === id);
  assert.strictEqual(item("top3").valor, "1. Área gourmet / churrasqueira  2. Cozinha  3. ateliê");
  assert.strictEqual(item("motivos").valor, "Mais espaço, Modernizar");
  assert.ok(/1\) eu · 30–59\n2\) esposa · 30–59 · Sim\n3\) filha · 6–12/.test(item("moradores").valor));
  assert.strictEqual(item("estilo").valor, "Moderno brasileiro");
  assert.strictEqual(item("estilo_fotos").valor, "1. Moderno brasileiro · foto 1  2. Rústico / campo · foto 3  3. Moderno brasileiro · foto 4");
  assert.deepStrictEqual(item("estilo_fotos").fotos, ["tropical-1", "rustico-3", "tropical-4"]);
  assert.ok(/Tenho: Matrícula/.test(item("documentos").valor) && /Envio depois: Planta/.test(item("documentos").valor));
  assert.ok(res.atencao.some((x) => /Documento a receber: planta/.test(x)));
  assert.ok(res.atencao.some((x) => /Orçamento da obra ainda indefinido/.test(x)));
  assert.ok(res.atencao.some((x) => /Data-limite rígida \(06\/2027\)/.test(x)));
  assert.ok(!res.secoes.some((s) => s.itens.some((x) => x.id === "programa")));
});

teste("Pendências do briefing inteiro apontam a seção de cada falta", () => {
  const p = M.pendenciasDoBriefing({ tipo: "PC" });
  assert.ok(p.length > 5);
  assert.ok(p.some((x) => x.id === "ramo" && x.secao === "Negócio e equipe"));
  assert.ok(p.every((x) => x.chave && x.rotulo));
});

teste("Toda dica aponta para uma pergunta que existe, e é curta", () => {
  const todas = [];
  M.BRIEFING_SECOES.forEach((s) => s.telas.forEach((t) => t.perguntas.forEach((p) => todas.push(p.id))));
  for (const k of Object.keys(M.BR_DICAS)) {
    assert.ok(todas.includes(k), "dica sem pergunta: " + k);
    assert.ok(M.BR_DICAS[k].length <= 160, "dica longa: " + k);
  }
});

teste("Galeria: 8 fotos em cada estilo, capa = 1ª foto, ids únicos e a grande vem de Unsplash/Pexels", () => {
  const vistos = new Set();
  for (const e of M.BR_ESTILOS) {
    const fotos = M.fotosDoEstilo(e.v);
    assert.strictEqual(fotos.length, 8, e.v);
    assert.strictEqual(e.img, fotos[0].img);
    for (const f of fotos) {
      assert.ok(!vistos.has(f.id)); vistos.add(f.id);
      assert.ok(/^https:\/\/images\.(unsplash|pexels)\.com\//.test(f.grande), f.id);
      assert.ok(/ \/ (Unsplash|Pexels)$/.test(f.credito) && f.credito.length > 10, f.id);
      assert.deepStrictEqual(M.fotoDaGaleria(f.id), f);
    }
    // a mesma foto não aparece em dois estilos
    const ids = M.BR_GALERIA[e.v].map((x) => x[1]);
    ids.forEach((id) => assert.ok(!Object.keys(M.BR_GALERIA).some((k) => k !== e.v && M.BR_GALERIA[k].some((x) => x[1] === id)), id));
  }
  assert.strictEqual(M.fotoDaGaleria("tropical-9"), null);
  assert.strictEqual(M.fotoDaGaleria("lixo"), null);
});

teste("Estilo: as 3 fotos só aparecem depois do estilo; obrigatórias, e foto inválida não conta", () => {
  assert.ok(!ids(M.telasDoBriefing({ tipo: "CN" })).includes("estilo_fotos"));
  const telas = M.telasDoBriefing({ tipo: "CN", estilo: "rustico" });
  const p = telas.flatMap((t) => t.perguntas).find((x) => x.id === "estilo_fotos");
  assert.ok(p);
  assert.strictEqual(M.faltaNaPergunta(p, { tipo: "CN" }, {}), "Escolha 3 fotos.");
  assert.strictEqual(M.faltaNaPergunta(p, { tipo: "CN" }, { estilo_fotos: ["rustico-1", "lixo-2"] }), "Faltam 2 fotos.");
  assert.strictEqual(M.faltaNaPergunta(p, { tipo: "CN" }, { estilo_fotos: ["rustico-1", "natural-2"] }), "Falta 1 foto.");
  assert.strictEqual(M.faltaNaPergunta(p, { tipo: "CN" }, { estilo_fotos: ["rustico-1", "natural-2", "rustico-8"] }), "");
});

for (const [nome, fn] of testes) {
  try { await fn(); console.log("  ok   " + nome); }
  catch (e) { falhas++; console.log("  FALHOU " + nome + "\n         " + e.message); }
}
console.log(`\n${testes.length - falhas}/${testes.length} passaram`);
process.exit(falhas ? 1 : 0);
