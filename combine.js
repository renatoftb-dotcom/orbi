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
  "clientes.jsx",
  "resultado-pdf.jsx",
  "orcamento-teste.jsx",
  "escritorio.jsx",
  "admin.jsx",
  "login.jsx",
  "mensagens.jsx",
  "onboarding.jsx",
  "orcamento-config.jsx",
  "app.jsx",
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
