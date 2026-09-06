// combine.js — Gera AppCombined.jsx concatenando os módulos na ordem correta
// Uso: node combine.js

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MODULES_DIR = join(__dirname, "src", "modules");
const OUTPUT = join(__dirname, "src", "AppCombined.jsx");

const ORDER = [
  "shared.jsx",
  "api.js",
  "outros.jsx",
  // insumos-seed.jsx + insumos.jsx vêm antes de obra-financeiro.jsx e de
  // orcamento-obra.jsx: o catálogo de insumos é a fonte de preço da
  // estimativa (precoInsumo) e a chave (insumo.codigo) que liga estimado e
  // realizado. A semente é um arquivo gerado — ver docs/SPEC-INSUMOS.md.
  "insumos-seed-cadastro.jsx",
  "insumos-seed.jsx",
  "composicoes-seed.jsx",
  "cronograma-seed.jsx",
  "insumos.jsx",
  // obra-financeiro.jsx vem ANTES de clientes.jsx: clientes.jsx
  // (GestaoObraPanel) consome a taxonomia (PLANO_CONTAS, ETAPAS_OBRA,
  // GRUPOS_MATERIAL) e, nas próximas entregas, calcularPLObra().
  "obra-financeiro.jsx",
  // orcamento-obra.jsx vem depois de obra-financeiro.jsx (não logo após
  // outros.jsx) porque o §6 da SPEC-ORCAMENTO-OBRA.md pede pra importar
  // ETAPAS_OBRA de lá quando a ponte com o P&L for implementada; e antes de
  // clientes.jsx porque é lá (GestaoObraPanel) que a UI futura vai entrar.
  "orcamento-obra.jsx",
  // cronograma-obra.jsx usa normalizarProjeto/calcularTelhado de orcamento-obra.jsx
  // e é renderizado dentro do resultado do orçamento (OrcamentoObraView).
  "cronograma-obra.jsx",
  "clientes.jsx",
  "resultado-pdf.jsx",
  // shared-textos.jsx vem antes de quem o consome (modelo-padrao.jsx,
  // template-edicao.jsx). Contém defaults/helpers de texto da proposta —
  // fonte única pra evitar duplicação entre modelo e template.
  "shared-textos.jsx",
  // modelo-padrao.jsx vem ANTES de orcamento-teste.jsx — embora função
  // declarations hoist independente de ordem, deixar antes torna a leitura
  // do bundle final mais natural (templates antes do form que os usa).
  // modelos-registry.jsx vem DEPOIS de modelo-padrao.jsx pra que o
  // typeof PropostaPreview !== "undefined" check passe na inicialização
  // (ordem importa pra const declarations).
  "modelo-padrao.jsx",
  "modelos-registry.jsx",
  // template-edicao.jsx vem antes de orcamento-teste.jsx pq esta usa
  // <TemplateEdicao /> diretamente.
  "template-edicao.jsx",
  // orcamento-onboarding.jsx (Beta) — fluxo guiado de criação de orçamento.
  // Vem antes de orcamento-teste.jsx pq o componente <TesteOrcamento> usa
  // <OrcamentoOnboarding /> diretamente quando dev_mode=true.
  "orcamento-onboarding.jsx",
  "orcamento-teste.jsx",
  "escritorio.jsx",
  "admin.jsx",
  "login.jsx",
  "mensagens.jsx",
  "onboarding.jsx",
  "orcamento-config.jsx",
  "app.jsx",
  // Rota standalone /render-pdf/:uuid pra Puppeteer capturar PDFs.
  // Tem que vir DEPOIS de orcamento-teste.jsx (pra ter PropostaPreview disponível)
  // e DEPOIS de app.jsx (pra não conflitar com nada).
  "render-pdf-route.jsx",
];

console.log("🔧 Gerando AppCombined.jsx...\n");

const parts = ORDER.map((filename) => {
  const path = join(MODULES_DIR, filename);
  const content = readFileSync(path, "utf-8");
  console.log(`  ✅ ${filename} (${content.split("\n").length} linhas)`);
  return `// ${"═".repeat(60)}\n// ${filename}\n// ${"═".repeat(60)}\n\n${content}`;
});

const combined = parts.join("\n\n");
writeFileSync(OUTPUT, combined, "utf-8");

console.log(`\n✅ AppCombined.jsx gerado com sucesso!`);
console.log(`   ${combined.split("\n").length} linhas totais`);
console.log(`   ${(combined.length / 1024).toFixed(0)}KB\n`);
