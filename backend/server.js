// ═══════════════════════════════════════════════════════════════
// ORBI — Backend Server
// Node.js + Express + SQLite
// ═══════════════════════════════════════════════════════════════

const express            = require("express");
const { DatabaseSync }   = require("node:sqlite");
const cors               = require("cors");
const path               = require("path");
const fs                 = require("fs");

const app  = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "orbi.db");

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Serve frontend estático (pasta ../frontend)
const FRONTEND_PATH = path.join(__dirname, "..", "frontend");
if (fs.existsSync(FRONTEND_PATH)) {
  app.use(express.static(FRONTEND_PATH));
}

// ── Banco de dados ─────────────────────────────────────────────
const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

// ── Criação das tabelas ────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS clientes (
    id          TEXT PRIMARY KEY,
    dados       TEXT NOT NULL,
    criadoEm    TEXT DEFAULT (datetime('now')),
    atualizadoEm TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fornecedores (
    id          TEXT PRIMARY KEY,
    dados       TEXT NOT NULL,
    criadoEm    TEXT DEFAULT (datetime('now')),
    atualizadoEm TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS materiais (
    id          TEXT PRIMARY KEY,
    dados       TEXT NOT NULL,
    criadoEm    TEXT DEFAULT (datetime('now')),
    atualizadoEm TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS obras (
    id          TEXT PRIMARY KEY,
    dados       TEXT NOT NULL,
    criadoEm    TEXT DEFAULT (datetime('now')),
    atualizadoEm TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS lancamentos (
    id          TEXT PRIMARY KEY,
    dados       TEXT NOT NULL,
    criadoEm    TEXT DEFAULT (datetime('now')),
    atualizadoEm TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orcamentos_projeto (
    id          TEXT PRIMARY KEY,
    clienteId   TEXT,
    dados       TEXT NOT NULL,
    criadoEm    TEXT DEFAULT (datetime('now')),
    atualizadoEm TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS receitas_financeiro (
    id          TEXT PRIMARY KEY,
    orcId       TEXT,
    clienteId   TEXT,
    dados       TEXT NOT NULL,
    criadoEm    TEXT DEFAULT (datetime('now')),
    atualizadoEm TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS escritorio (
    id          INTEGER PRIMARY KEY DEFAULT 1,
    dados       TEXT NOT NULL,
    atualizadoEm TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS config_comodos (
    chave       TEXT PRIMARY KEY,
    dados       TEXT NOT NULL,
    atualizadoEm TEXT DEFAULT (datetime('now'))
  );
`);

// ── Helpers ────────────────────────────────────────────────────
const parseAll = rows => rows.map(r => JSON.parse(r.dados));
const ok  = (res, data)         => res.json({ ok: true, data });
const err = (res, msg, s = 400) => res.status(s).json({ ok: false, error: msg });
const now = ()                  => new Date().toISOString();

const upsert = (tabela, id, dados, extra = {}) => {
  const cols = ["id", "dados", "criadoEm", "atualizadoEm", ...Object.keys(extra)];
  const vals = [id, JSON.stringify(dados), now(), now(), ...Object.values(extra)];
  const sets = ["dados = excluded.dados", "atualizadoEm = excluded.atualizadoEm",
                ...Object.keys(extra).map(k => `${k} = excluded.${k}`)];
  db.prepare(`
    INSERT INTO ${tabela} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})
    ON CONFLICT(id) DO UPDATE SET ${sets.join(", ")}
  `).run(...vals);
};

// ── CLIENTES ───────────────────────────────────────────────────
app.get("/api/clientes", (req, res) => {
  ok(res, parseAll(db.prepare("SELECT dados FROM clientes ORDER BY criadoEm ASC").all()));
});

app.get("/api/clientes/:id", (req, res) => {
  const row = db.prepare("SELECT dados FROM clientes WHERE id = ?").get(req.params.id);
  row ? ok(res, JSON.parse(row.dados)) : err(res, "Não encontrado", 404);
});

app.post("/api/clientes", (req, res) => {
  const c = req.body;
  if (!c.id || !c.nome) return err(res, "id e nome são obrigatórios");
  upsert("clientes", c.id, c);
  ok(res, c);
});

app.put("/api/clientes/:id", (req, res) => {
  const c = { ...req.body, id: req.params.id };
  const r = db.prepare("UPDATE clientes SET dados=?, atualizadoEm=? WHERE id=?")
               .run(JSON.stringify(c), now(), req.params.id);
  r.changes === 0 ? err(res, "Não encontrado", 404) : ok(res, c);
});

app.delete("/api/clientes/:id", (req, res) => {
  db.prepare("DELETE FROM clientes WHERE id=?").run(req.params.id);
  ok(res, { id: req.params.id });
});

// ── FORNECEDORES ───────────────────────────────────────────────
app.get("/api/fornecedores", (req, res) => {
  const rows = db.prepare("SELECT dados FROM fornecedores ORDER BY criadoEm ASC").all();
  ok(res, parseAll(rows));
});

app.post("/api/fornecedores", (req, res) => {
  const forn = req.body;
  if (!forn.id) return err(res, "id é obrigatório");
  db.prepare(`
    INSERT INTO fornecedores (id, dados, criadoEm, atualizadoEm)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET dados = excluded.dados, atualizadoEm = excluded.atualizadoEm
  `).run(forn.id, JSON.stringify(forn), now(), now());
  ok(res, forn);
});

app.put("/api/fornecedores/:id", (req, res) => {
  const forn = { ...req.body, id: req.params.id };
  const result = db.prepare(
    "UPDATE fornecedores SET dados = ?, atualizadoEm = ? WHERE id = ?"
  ).run(JSON.stringify(forn), now(), req.params.id);
  if (result.changes === 0) return err(res, "Fornecedor não encontrado", 404);
  ok(res, forn);
});

app.delete("/api/fornecedores/:id", (req, res) => {
  db.prepare("DELETE FROM fornecedores WHERE id = ?").run(req.params.id);
  ok(res, { id: req.params.id });
});

// ── MATERIAIS ──────────────────────────────────────────────────
app.get("/api/materiais", (req, res) => {
  const rows = db.prepare("SELECT dados FROM materiais ORDER BY criadoEm ASC").all();
  ok(res, parseAll(rows));
});

app.post("/api/materiais", (req, res) => {
  const mat = req.body;
  if (!mat.id) return err(res, "id é obrigatório");
  db.prepare(`
    INSERT INTO materiais (id, dados, criadoEm, atualizadoEm)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET dados = excluded.dados, atualizadoEm = excluded.atualizadoEm
  `).run(mat.id, JSON.stringify(mat), now(), now());
  ok(res, mat);
});

app.delete("/api/materiais/:id", (req, res) => {
  db.prepare("DELETE FROM materiais WHERE id = ?").run(req.params.id);
  ok(res, { id: req.params.id });
});

// ── OBRAS ──────────────────────────────────────────────────────
app.get("/api/obras", (req, res) => {
  const rows = db.prepare("SELECT dados FROM obras ORDER BY criadoEm ASC").all();
  ok(res, parseAll(rows));
});

app.post("/api/obras", (req, res) => {
  const obra = req.body;
  if (!obra.id) return err(res, "id é obrigatório");
  db.prepare(`
    INSERT INTO obras (id, dados, criadoEm, atualizadoEm)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET dados = excluded.dados, atualizadoEm = excluded.atualizadoEm
  `).run(obra.id, JSON.stringify(obra), now(), now());
  ok(res, obra);
});

app.delete("/api/obras/:id", (req, res) => {
  db.prepare("DELETE FROM obras WHERE id = ?").run(req.params.id);
  ok(res, { id: req.params.id });
});

// ── LANÇAMENTOS ────────────────────────────────────────────────
app.get("/api/lancamentos", (req, res) => {
  const rows = db.prepare("SELECT dados FROM lancamentos ORDER BY criadoEm ASC").all();
  ok(res, parseAll(rows));
});

app.post("/api/lancamentos", (req, res) => {
  const lanc = req.body;
  if (!lanc.id) return err(res, "id é obrigatório");
  db.prepare(`
    INSERT INTO lancamentos (id, dados, criadoEm, atualizadoEm)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET dados = excluded.dados, atualizadoEm = excluded.atualizadoEm
  `).run(lanc.id, JSON.stringify(lanc), now(), now());
  ok(res, lanc);
});

app.delete("/api/lancamentos/:id", (req, res) => {
  db.prepare("DELETE FROM lancamentos WHERE id = ?").run(req.params.id);
  ok(res, { id: req.params.id });
});

// ── ORÇAMENTOS DE PROJETO ──────────────────────────────────────
app.get("/api/orcamentos", (req, res) => {
  const { clienteId } = req.query;
  const sql = clienteId
    ? "SELECT dados FROM orcamentos_projeto WHERE clienteId = ? ORDER BY criadoEm ASC"
    : "SELECT dados FROM orcamentos_projeto ORDER BY criadoEm ASC";
  const rows = clienteId
    ? db.prepare(sql).all(clienteId)
    : db.prepare(sql).all();
  ok(res, parseAll(rows));
});

app.post("/api/orcamentos", (req, res) => {
  const orc = req.body;
  if (!orc.id) return err(res, "id é obrigatório");
  db.prepare(`
    INSERT INTO orcamentos_projeto (id, clienteId, dados, criadoEm, atualizadoEm)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET dados = excluded.dados, clienteId = excluded.clienteId, atualizadoEm = excluded.atualizadoEm
  `).run(orc.id, orc.clienteId || null, JSON.stringify(orc), orc.criadoEm || now(), now());
  ok(res, orc);
});

app.put("/api/orcamentos/:id", (req, res) => {
  const orc = { ...req.body, id: req.params.id };
  const result = db.prepare(
    "UPDATE orcamentos_projeto SET dados = ?, clienteId = ?, atualizadoEm = ? WHERE id = ?"
  ).run(JSON.stringify(orc), orc.clienteId || null, now(), req.params.id);
  if (result.changes === 0) return err(res, "Orçamento não encontrado", 404);
  ok(res, orc);
});

app.delete("/api/orcamentos/:id", (req, res) => {
  db.prepare("DELETE FROM orcamentos_projeto WHERE id = ?").run(req.params.id);
  ok(res, { id: req.params.id });
});

// ── RECEITAS FINANCEIRO ────────────────────────────────────────
app.get("/api/receitas", (req, res) => {
  const { orcId, clienteId } = req.query;
  let sql = "SELECT dados FROM receitas_financeiro";
  const params = [];
  if (orcId)      { sql += " WHERE orcId = ?";     params.push(orcId); }
  else if (clienteId) { sql += " WHERE clienteId = ?"; params.push(clienteId); }
  sql += " ORDER BY criadoEm ASC";
  const rows = db.prepare(sql).all(...params);
  ok(res, parseAll(rows));
});

app.post("/api/receitas", (req, res) => {
  const rec = req.body;
  if (!rec.id) return err(res, "id é obrigatório");
  db.prepare(`
    INSERT INTO receitas_financeiro (id, orcId, clienteId, dados, criadoEm, atualizadoEm)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET dados = excluded.dados, atualizadoEm = excluded.atualizadoEm
  `).run(rec.id, rec.orcId || null, rec.clienteId || null, JSON.stringify(rec), now(), now());
  ok(res, rec);
});

// Salvar múltiplas receitas de uma vez (usado ao confirmar ganho)
app.post("/api/receitas/batch", (req, res) => {
  const { receitas } = req.body;
  if (!Array.isArray(receitas)) return err(res, "receitas deve ser um array");
  const insert = db.prepare(`
    INSERT INTO receitas_financeiro (id, orcId, clienteId, dados, criadoEm, atualizadoEm)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET dados = excluded.dados, atualizadoEm = excluded.atualizadoEm
  `);
  const insertMany = db.transaction((items) => {
    for (const rec of items) {
      insert.run(rec.id, rec.orcId || null, rec.clienteId || null, JSON.stringify(rec), now(), now());
    }
  });
  insertMany(receitas);
  ok(res, receitas);
});

app.delete("/api/receitas/:id", (req, res) => {
  db.prepare("DELETE FROM receitas_financeiro WHERE id = ?").run(req.params.id);
  ok(res, { id: req.params.id });
});

// Deletar todas as receitas de um orçamento (estorno ao marcar como perdido)
app.delete("/api/receitas/por-orcamento/:orcId", (req, res) => {
  const result = db.prepare("DELETE FROM receitas_financeiro WHERE orcId = ?").run(req.params.orcId);
  ok(res, { deleted: result.changes });
});

// ── ESCRITÓRIO ─────────────────────────────────────────────────
app.get("/api/escritorio", (req, res) => {
  const row = db.prepare("SELECT dados FROM escritorio WHERE id = 1").get();
  ok(res, row ? JSON.parse(row.dados) : null);
});

app.put("/api/escritorio", (req, res) => {
  const dados = req.body;
  db.prepare(`
    INSERT INTO escritorio (id, dados, atualizadoEm)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET dados = excluded.dados, atualizadoEm = excluded.atualizadoEm
  `).run(JSON.stringify(dados), now());
  ok(res, dados);
});

// ── CONFIG CÔMODOS (customizações do usuário) ──────────────────
app.get("/api/config/:chave", (req, res) => {
  const row = db.prepare("SELECT dados FROM config_comodos WHERE chave = ?").get(req.params.chave);
  ok(res, row ? JSON.parse(row.dados) : null);
});

app.put("/api/config/:chave", (req, res) => {
  const dados = req.body;
  db.prepare(`
    INSERT INTO config_comodos (chave, dados, atualizadoEm)
    VALUES (?, ?, ?)
    ON CONFLICT(chave) DO UPDATE SET dados = excluded.dados, atualizadoEm = excluded.atualizadoEm
  `).run(req.params.chave, JSON.stringify(dados), now());
  ok(res, dados);
});

// ── LOGO DO ESCRITÓRIO ─────────────────────────────────────────
// Salva como base64 na tabela config_comodos
app.get("/api/logo", (req, res) => {
  const row = db.prepare("SELECT dados FROM config_comodos WHERE chave = 'escritorio-logo'").get();
  ok(res, row ? JSON.parse(row.dados) : null);
});

app.put("/api/logo", (req, res) => {
  const { data } = req.body; // base64 string
  if (!data) return err(res, "data é obrigatório");
  db.prepare(`
    INSERT INTO config_comodos (chave, dados, atualizadoEm)
    VALUES ('escritorio-logo', ?, ?)
    ON CONFLICT(chave) DO UPDATE SET dados = excluded.dados, atualizadoEm = excluded.atualizadoEm
  `).run(JSON.stringify(data), now());
  ok(res, { saved: true });
});

// ── BACKUP COMPLETO ────────────────────────────────────────────
// Exporta tudo como JSON (equivalente ao "Exportar Backup" do frontend)
app.get("/api/backup", (req, res) => {
  const backup = {
    clientes:           parseAll(db.prepare("SELECT dados FROM clientes").all()),
    fornecedores:       parseAll(db.prepare("SELECT dados FROM fornecedores").all()),
    materiais:          parseAll(db.prepare("SELECT dados FROM materiais").all()),
    obras:              parseAll(db.prepare("SELECT dados FROM obras").all()),
    lancamentos:        parseAll(db.prepare("SELECT dados FROM lancamentos").all()),
    orcamentosProjeto:  parseAll(db.prepare("SELECT dados FROM orcamentos_projeto").all()),
    receitasFinanceiro: parseAll(db.prepare("SELECT dados FROM receitas_financeiro").all()),
    escritorio:         (() => { const r = db.prepare("SELECT dados FROM escritorio WHERE id=1").get(); return r ? JSON.parse(r.dados) : {}; })(),
    exportadoEm:        now(),
  };
  res.setHeader("Content-Disposition", `attachment; filename="orbi-backup-${new Date().toISOString().slice(0,10)}.json"`);
  res.setHeader("Content-Type", "application/json");
  res.json(backup);
});

// Importa backup completo
app.post("/api/backup/importar", (req, res) => {
  const dados = req.body;

  const importarTabela = db.transaction((tabela, stmt, items) => {
    for (const item of (items || [])) {
      if (!item.id) continue;
      stmt.run(item.id, JSON.stringify(item), now(), now());
    }
  });

  const upsertCliente   = db.prepare("INSERT OR REPLACE INTO clientes (id,dados,criadoEm,atualizadoEm) VALUES (?,?,?,?)");
  const upsertForn      = db.prepare("INSERT OR REPLACE INTO fornecedores (id,dados,criadoEm,atualizadoEm) VALUES (?,?,?,?)");
  const upsertMat       = db.prepare("INSERT OR REPLACE INTO materiais (id,dados,criadoEm,atualizadoEm) VALUES (?,?,?,?)");
  const upsertObra      = db.prepare("INSERT OR REPLACE INTO obras (id,dados,criadoEm,atualizadoEm) VALUES (?,?,?,?)");
  const upsertLanc      = db.prepare("INSERT OR REPLACE INTO lancamentos (id,dados,criadoEm,atualizadoEm) VALUES (?,?,?,?)");

  importarTabela("clientes",    upsertCliente, dados.clientes);
  importarTabela("fornecedores",upsertForn,    dados.fornecedores);
  importarTabela("materiais",   upsertMat,     dados.materiais);
  importarTabela("obras",       upsertObra,    dados.obras);
  importarTabela("lancamentos", upsertLanc,    dados.lancamentos);

  // Orçamentos
  for (const orc of (dados.orcamentosProjeto || [])) {
    if (!orc.id) continue;
    db.prepare("INSERT OR REPLACE INTO orcamentos_projeto (id,clienteId,dados,criadoEm,atualizadoEm) VALUES (?,?,?,?,?)")
      .run(orc.id, orc.clienteId || null, JSON.stringify(orc), orc.criadoEm || now(), now());
  }

  // Receitas
  for (const rec of (dados.receitasFinanceiro || [])) {
    if (!rec.id) continue;
    db.prepare("INSERT OR REPLACE INTO receitas_financeiro (id,orcId,clienteId,dados,criadoEm,atualizadoEm) VALUES (?,?,?,?,?,?)")
      .run(rec.id, rec.orcId || null, rec.clienteId || null, JSON.stringify(rec), now(), now());
  }

  // Escritório
  if (dados.escritorio) {
    db.prepare("INSERT OR REPLACE INTO escritorio (id,dados,atualizadoEm) VALUES (1,?,?)")
      .run(JSON.stringify(dados.escritorio), now());
  }

  ok(res, { importado: true });
});

// ── HEALTH CHECK ───────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ ok: true, version: "1.0.0", timestamp: now() });
});

// ── SPA fallback (frontend React) ─────────────────────────────
if (fs.existsSync(FRONTEND_PATH)) {
  app.get("*", (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, "index.html"));
  });
}

// ── Start ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✓ Orbi rodando em http://localhost:${PORT}`);
  console.log(`  Banco de dados: ${DB_PATH}`);
  console.log(`  Pressione Ctrl+C para parar\n`);
});

// Graceful shutdown
process.on("SIGINT",  () => { db.close(); process.exit(0); });
process.on("SIGTERM", () => { db.close(); process.exit(0); });
