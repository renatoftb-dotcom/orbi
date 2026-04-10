// ═══════════════════════════════════════════════════════════════
// ORBI — Script de migração do backup JSON para o banco de dados
// 
// Uso: node seed.js backup.json
// 
// Este script importa um backup exportado pelo sistema antigo
// (localStorage/window.storage) para o banco SQLite do Orbi.
// ═══════════════════════════════════════════════════════════════

const fs       = require("fs");
const path     = require("path");
const Database = require("node:sqlite").DatabaseSync;

const args    = process.argv.slice(2);
const arquivo = args[0];

if (!arquivo) {
  console.log("Uso: node seed.js <arquivo-backup.json>");
  console.log("Exemplo: node seed.js orbi-backup-2026-04-10.json");
  process.exit(1);
}

if (!fs.existsSync(arquivo)) {
  console.error(`Arquivo não encontrado: ${arquivo}`);
  process.exit(1);
}

const dados   = JSON.parse(fs.readFileSync(arquivo, "utf8"));
const DB_PATH = path.join(__dirname, "orbi.db");
const db      = new DatabaseSync(DB_PATH);

// db.pragma("journal_mode = WAL");
// db.pragma("foreign_keys = ON");

function nowISO() { return new Date().toISOString(); }

console.log("\n⟳ Iniciando migração...\n");

let total = 0;

// Clientes
for (const item of (dados.clientes || [])) {
  if (!item.id) continue;
  db.prepare("INSERT OR REPLACE INTO clientes (id,dados,criadoEm,atualizadoEm) VALUES (?,?,?,?)")
    .run(item.id, JSON.stringify(item), item.desde || nowISO(), nowISO());
  total++;
}
console.log(`✓ Clientes: ${(dados.clientes||[]).length}`);

// Fornecedores
for (const item of (dados.fornecedores || [])) {
  if (!item.id) continue;
  db.prepare("INSERT OR REPLACE INTO fornecedores (id,dados,criadoEm,atualizadoEm) VALUES (?,?,?,?)")
    .run(item.id, JSON.stringify(item), nowISO(), nowISO());
  total++;
}
console.log(`✓ Fornecedores: ${(dados.fornecedores||[]).length}`);

// Materiais
for (const item of (dados.materiais || [])) {
  if (!item.id) continue;
  db.prepare("INSERT OR REPLACE INTO materiais (id,dados,criadoEm,atualizadoEm) VALUES (?,?,?,?)")
    .run(item.id, JSON.stringify(item), nowISO(), nowISO());
  total++;
}
console.log(`✓ Materiais: ${(dados.materiais||[]).length}`);

// Obras
for (const item of (dados.obras || [])) {
  if (!item.id) continue;
  db.prepare("INSERT OR REPLACE INTO obras (id,dados,criadoEm,atualizadoEm) VALUES (?,?,?,?)")
    .run(item.id, JSON.stringify(item), nowISO(), nowISO());
  total++;
}
console.log(`✓ Obras: ${(dados.obras||[]).length}`);

// Lançamentos
for (const item of (dados.lancamentos || [])) {
  if (!item.id) continue;
  db.prepare("INSERT OR REPLACE INTO lancamentos (id,dados,criadoEm,atualizadoEm) VALUES (?,?,?,?)")
    .run(item.id, JSON.stringify(item), item.data || nowISO(), nowISO());
  total++;
}
console.log(`✓ Lançamentos: ${(dados.lancamentos||[]).length}`);

// Orçamentos
for (const item of (dados.orcamentosProjeto || [])) {
  if (!item.id) continue;
  db.prepare("INSERT OR REPLACE INTO orcamentos_projeto (id,clienteId,dados,criadoEm,atualizadoEm) VALUES (?,?,?,?,?)")
    .run(item.id, item.clienteId || null, JSON.stringify(item), item.criadoEm || nowISO(), nowISO());
  total++;
}
console.log(`✓ Orçamentos: ${(dados.orcamentosProjeto||[]).length}`);

// Receitas financeiro
for (const item of (dados.receitasFinanceiro || [])) {
  if (!item.id) continue;
  db.prepare("INSERT OR REPLACE INTO receitas_financeiro (id,orcId,clienteId,dados,criadoEm,atualizadoEm) VALUES (?,?,?,?,?,?)")
    .run(item.id, item.orcId || null, item.clienteId || null, JSON.stringify(item), item.dataLancamento || nowISO(), nowISO());
  total++;
}
console.log(`✓ Receitas financeiro: ${(dados.receitasFinanceiro||[]).length}`);

// Escritório
if (dados.escritorio) {
  db.prepare("INSERT OR REPLACE INTO escritorio (id,dados,atualizadoEm) VALUES (1,?,?)")
    .run(JSON.stringify(dados.escritorio), nowISO());
  console.log(`✓ Escritório: ok`);
  total++;
}

db.close();

console.log(`\n✓ Migração concluída! ${total} registros importados.`);
console.log(`  Banco de dados: ${DB_PATH}\n`);
