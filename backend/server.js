// ═══════════════════════════════════════════════════════════════
// VICKE — Backend Server
// Node.js + Express + PostgreSQL
// ═══════════════════════════════════════════════════════════════

const express  = require("express");
const { Pool } = require("pg");
const cors     = require("cors");
const path     = require("path");
const fs       = require("fs");
const jwt      = require("jsonwebtoken");
const bcrypt   = require("bcryptjs");
const cron     = require("node-cron");
const { rodarManutencao } = require("./jobs/manutencao");

const JWT_SECRET = process.env.JWT_SECRET || "vicke-secret-dev-2026";
if (!process.env.JWT_SECRET) {
  console.warn("⚠ ATENÇÃO: JWT_SECRET não definido nas variáveis de ambiente.");
  console.warn("   Usando secret padrão (inseguro). Configure JWT_SECRET no Railway.");
}

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const FRONTEND_PATH = path.join(__dirname, "..", "frontend");
if (fs.existsSync(FRONTEND_PATH)) {
  app.use(express.static(FRONTEND_PATH));
}

// ── Banco de dados — PostgreSQL ────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway") ? { rejectUnauthorized: false } : false,
});

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

// ── Criação das tabelas ────────────────────────────────────────
async function initDB() {
  await query(`
    CREATE TABLE IF NOT EXISTS clientes (
      id           TEXT PRIMARY KEY,
      dados        JSONB NOT NULL,
      criado_em    TIMESTAMPTZ DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS fornecedores (
      id           TEXT PRIMARY KEY,
      dados        JSONB NOT NULL,
      criado_em    TIMESTAMPTZ DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS materiais (
      id           TEXT PRIMARY KEY,
      dados        JSONB NOT NULL,
      criado_em    TIMESTAMPTZ DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS obras (
      id           TEXT PRIMARY KEY,
      dados        JSONB NOT NULL,
      criado_em    TIMESTAMPTZ DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS lancamentos (
      id           TEXT PRIMARY KEY,
      dados        JSONB NOT NULL,
      criado_em    TIMESTAMPTZ DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orcamentos_projeto (
      id           TEXT PRIMARY KEY,
      cliente_id   TEXT,
      dados        JSONB NOT NULL,
      criado_em    TIMESTAMPTZ DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS receitas_financeiro (
      id           TEXT PRIMARY KEY,
      orc_id       TEXT,
      cliente_id   TEXT,
      dados        JSONB NOT NULL,
      criado_em    TIMESTAMPTZ DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS escritorio (
      id           INTEGER PRIMARY KEY DEFAULT 1,
      dados        JSONB NOT NULL,
      atualizado_em TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS config_geral (
      chave        TEXT PRIMARY KEY,
      dados        JSONB NOT NULL,
      atualizado_em TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS empresas (
      id           TEXT PRIMARY KEY,
      nome         TEXT NOT NULL,
      plano        TEXT DEFAULT 'gratuito',
      ativo        BOOLEAN DEFAULT TRUE,
      criado_em    TIMESTAMPTZ DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id           TEXT PRIMARY KEY,
      empresa_id   TEXT NOT NULL REFERENCES empresas(id),
      nome         TEXT NOT NULL,
      email        TEXT UNIQUE NOT NULL,
      senha_hash   TEXT NOT NULL,
      perfil       TEXT DEFAULT 'escritorio',
      nivel        TEXT DEFAULT 'admin',
      membro_id    TEXT,
      ativo        BOOLEAN DEFAULT TRUE,
      criado_em    TIMESTAMPTZ DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Migração segura: adiciona colunas em bancos já existentes (idempotente)
  await query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nivel TEXT DEFAULT 'admin'`);
  await query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS membro_id TEXT`);
  // Usuários existentes sem nível: master vira admin (já tem tudo), escritorio vira admin (é o dono)
  await query(`UPDATE usuarios SET nivel = 'admin' WHERE nivel IS NULL`);
  console.log("  ✓ Tabelas verificadas/criadas");
}

// ── Helpers ────────────────────────────────────────────────────
const ok  = (res, data)         => res.json({ ok: true, data });
const err = (res, msg, s = 400) => res.status(s).json({ ok: false, error: msg });
const now = ()                  => new Date().toISOString();

// ── Middleware de autenticação ─────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) return err(res, "Token não fornecido", 401);
  // Extrai o token do header "Bearer <token>". Aceita também o header só com o token bruto.
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1] : header.trim();
  if (!token) return err(res, "Token não fornecido", 401);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    err(res, "Token inválido ou expirado", 401);
  }
}

function masterOnly(req, res, next) {
  if (req.user?.perfil !== "master") return err(res, "Acesso negado", 403);
  next();
}

// Middleware: garante que o usuário é admin do escritório (ou master)
function adminOnly(req, res, next) {
  const isMaster = req.user?.perfil === "master";
  const isAdmin  = req.user?.nivel === "admin";
  if (!isMaster && !isAdmin) return err(res, "Acesso restrito a administradores", 403);
  next();
}

// Middleware: permite admin ou editor (bloqueia visualizador)
function editorOrAdmin(req, res, next) {
  const isMaster = req.user?.perfil === "master";
  const nivel = req.user?.nivel;
  if (!isMaster && nivel !== "admin" && nivel !== "editor") {
    return err(res, "Sem permissão para esta ação", 403);
  }
  next();
}

// ── AUTH ───────────────────────────────────────────────────────
app.post("/auth/login", async (req, res) => {
  try {
    const { senha } = req.body;
    // Normaliza o email (trim + lowercase) pra garantir match com o que está salvo
    const email = (req.body.email || "").trim().toLowerCase();
    if (!email || !senha) return err(res, "Email e senha são obrigatórios");

    const { rows } = await query("SELECT * FROM usuarios WHERE email = $1 AND ativo = TRUE", [email]);
    const usuario = rows[0];
    if (!usuario) return err(res, "Email ou senha inválidos", 401);

    const senhaOk = bcrypt.compareSync(senha, usuario.senha_hash);
    if (!senhaOk) return err(res, "Email ou senha inválidos", 401);

    const { rows: empRows } = await query("SELECT * FROM empresas WHERE id = $1 AND ativo = TRUE", [usuario.empresa_id]);
    const empresa = empRows[0];
    if (!empresa) return err(res, "Empresa inativa ou não encontrada", 401);

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, email: usuario.email,
        perfil: usuario.perfil, nivel: usuario.nivel || "admin",
        membro_id: usuario.membro_id || null,
        empresa_id: usuario.empresa_id,
        empresa_nome: empresa.nome },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    ok(res, { token, usuario: {
      id: usuario.id, nome: usuario.nome, email: usuario.email,
      perfil: usuario.perfil, nivel: usuario.nivel || "admin",
      membro_id: usuario.membro_id || null,
      empresa_id: usuario.empresa_id,
      empresa_nome: empresa.nome
    }});
  } catch(e) { err(res, e.message); }
});

app.get("/auth/me", authMiddleware, async (req, res) => {
  try {
    const { rows } = await query("SELECT id,nome,email,perfil,nivel,membro_id,empresa_id,ativo FROM usuarios WHERE id = $1", [req.user.id]);
    const usuario = rows[0];
    if (!usuario || !usuario.ativo) return err(res, "Usuário inativo", 401);
    const { rows: empRows } = await query("SELECT nome FROM empresas WHERE id = $1", [usuario.empresa_id]);
    ok(res, { ...usuario, empresa_nome: empRows[0]?.nome });
  } catch(e) { err(res, e.message); }
});

// ── ADMIN — EMPRESAS ──────────────────────────────────────────
app.get("/admin/empresas", authMiddleware, masterOnly, async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM empresas ORDER BY criado_em ASC");
    ok(res, rows);
  } catch(e) { err(res, e.message); }
});

app.post("/admin/empresas", authMiddleware, masterOnly, async (req, res) => {
  try {
    const { nome, plano } = req.body;
    if (!nome) return err(res, "nome é obrigatório");
    const id = `emp_${Date.now()}`;
    await query("INSERT INTO empresas (id,nome,plano,ativo) VALUES ($1,$2,$3,TRUE)", [id, nome, plano || "gratuito"]);
    ok(res, { id, nome, plano: plano || "gratuito", ativo: true });
  } catch(e) { err(res, e.message); }
});

app.put("/admin/empresas/:id", authMiddleware, masterOnly, async (req, res) => {
  try {
    const { nome, plano, ativo } = req.body;
    await query("UPDATE empresas SET nome=$1,plano=$2,ativo=$3,atualizado_em=NOW() WHERE id=$4", [nome, plano, ativo, req.params.id]);
    ok(res, { id: req.params.id, nome, plano, ativo });
  } catch(e) { err(res, e.message); }
});

// ── ADMIN — USUÁRIOS ──────────────────────────────────────────
app.get("/admin/usuarios", authMiddleware, masterOnly, async (req, res) => {
  try {
    const { rows } = await query("SELECT id,empresa_id,nome,email,perfil,ativo,criado_em FROM usuarios ORDER BY criado_em ASC");
    ok(res, rows);
  } catch(e) { err(res, e.message); }
});

app.post("/admin/usuarios", authMiddleware, masterOnly, async (req, res) => {
  try {
    const { empresa_id, nome, senha, perfil } = req.body;
    const email = (req.body.email || "").trim().toLowerCase();
    const nomeTrim = (nome || "").trim();
    if (!empresa_id || !nomeTrim || !email || !senha) return err(res, "empresa_id, nome, email e senha são obrigatórios");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(res, "Email inválido");
    if (senha.length < 6) return err(res, "A senha deve ter no mínimo 6 caracteres");
    const { rows: existe } = await query("SELECT id FROM usuarios WHERE email = $1", [email]);
    if (existe.length > 0) return err(res, "Email já cadastrado");
    const id = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const senha_hash = bcrypt.hashSync(senha, 10);
    await query("INSERT INTO usuarios (id,empresa_id,nome,email,senha_hash,perfil,ativo) VALUES ($1,$2,$3,$4,$5,$6,TRUE)",
      [id, empresa_id, nomeTrim, email, senha_hash, perfil || "escritorio"]);
    ok(res, { id, empresa_id, nome: nomeTrim, email, perfil: perfil || "escritorio", ativo: true });
  } catch(e) { err(res, e.message); }
});

app.put("/admin/usuarios/:id", authMiddleware, masterOnly, async (req, res) => {
  try {
    const { nome, perfil, ativo, senha } = req.body;
    const email = (req.body.email || "").trim().toLowerCase();
    const nomeTrim = (nome || "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(res, "Email inválido");
    if (senha) {
      if (senha.length < 6) return err(res, "A senha deve ter no mínimo 6 caracteres");
      const senha_hash = bcrypt.hashSync(senha, 10);
      await query("UPDATE usuarios SET nome=$1,email=$2,perfil=$3,ativo=$4,senha_hash=$5,atualizado_em=NOW() WHERE id=$6",
        [nomeTrim, email, perfil, ativo, senha_hash, req.params.id]);
    } else {
      await query("UPDATE usuarios SET nome=$1,email=$2,perfil=$3,ativo=$4,atualizado_em=NOW() WHERE id=$5",
        [nomeTrim, email, perfil, ativo, req.params.id]);
    }
    ok(res, { id: req.params.id, nome: nomeTrim, email, perfil, ativo });
  } catch(e) { err(res, e.message); }
});

app.delete("/admin/usuarios/:id", authMiddleware, masterOnly, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return err(res, "Você não pode excluir a si mesmo", 400);
    }
    await query("DELETE FROM usuarios WHERE id = $1", [req.params.id]);
    ok(res, { id: req.params.id, deleted: true });
  } catch(e) { err(res, e.message); }
});

// ═══════════════════════════════════════════════════════════════
// USUÁRIOS DA EMPRESA (gerenciados pelo admin do escritório)
// ═══════════════════════════════════════════════════════════════
// Essas rotas permitem ao ADMIN de cada escritório (não master)
// gerenciar os usuários da SUA PRÓPRIA empresa.
// Isolamento por empresa_id é aplicado em todas as queries.
// ═══════════════════════════════════════════════════════════════

// Lista usuários da empresa do admin autenticado
app.get("/empresa/usuarios", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, nome, email, nivel, membro_id, ativo, criado_em, atualizado_em
       FROM usuarios WHERE empresa_id = $1 ORDER BY criado_em ASC`,
      [req.user.empresa_id]
    );
    ok(res, rows);
  } catch(e) { err(res, e.message); }
});

// Cria novo usuário na empresa do admin autenticado
app.post("/empresa/usuarios", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { nome, senha, nivel, membro_id } = req.body;
    // Normaliza email: trim + lowercase (garante consistência com o login)
    const email = (req.body.email || "").trim().toLowerCase();
    const nomeTrim = (nome || "").trim();
    if (!nomeTrim || !email || !senha) {
      return err(res, "Nome, email e senha são obrigatórios");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return err(res, "Email inválido");
    }
    if (senha.length < 6) {
      return err(res, "A senha deve ter no mínimo 6 caracteres");
    }
    const nivelValido = ["admin", "editor", "visualizador"];
    const nivelFinal = nivelValido.includes(nivel) ? nivel : "visualizador";

    // Email único no sistema inteiro
    const { rows: existe } = await query("SELECT id FROM usuarios WHERE email = $1", [email]);
    if (existe.length > 0) return err(res, "Email já cadastrado");

    const id = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const senha_hash = bcrypt.hashSync(senha, 10);

    await query(
      `INSERT INTO usuarios (id, empresa_id, nome, email, senha_hash, perfil, nivel, membro_id, ativo)
       VALUES ($1, $2, $3, $4, $5, 'escritorio', $6, $7, TRUE)`,
      [id, req.user.empresa_id, nomeTrim, email, senha_hash, nivelFinal, membro_id || null]
    );
    ok(res, { id, nome: nomeTrim, email, nivel: nivelFinal, membro_id: membro_id || null, ativo: true });
  } catch(e) { err(res, e.message); }
});

// Atualiza usuário — só dentro da própria empresa
app.put("/empresa/usuarios/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { nome, senha, nivel, membro_id, ativo } = req.body;
    // Normaliza email (trim + lowercase) pra consistência com o login
    const email = (req.body.email || "").trim().toLowerCase();
    const nomeTrim = (nome || "").trim();

    // Validação de email se foi fornecido
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return err(res, "Email inválido");
    }

    // Confere que o usuário editado é da mesma empresa do admin logado
    const { rows: alvo } = await query(
      "SELECT id, empresa_id, perfil FROM usuarios WHERE id = $1",
      [req.params.id]
    );
    if (alvo.length === 0) return err(res, "Usuário não encontrado", 404);
    if (alvo[0].empresa_id !== req.user.empresa_id && req.user.perfil !== "master") {
      return err(res, "Usuário não pertence à sua empresa", 403);
    }

    // Não permite desativar o próprio usuário (trava de segurança)
    if (req.params.id === req.user.id && ativo === false) {
      return err(res, "Você não pode desativar a si mesmo", 400);
    }

    const nivelValido = ["admin", "editor", "visualizador"];
    const nivelFinal = nivelValido.includes(nivel) ? nivel : "visualizador";

    if (senha) {
      if (senha.length < 6) return err(res, "A senha deve ter no mínimo 6 caracteres");
      const senha_hash = bcrypt.hashSync(senha, 10);
      await query(
        `UPDATE usuarios SET nome=$1, email=$2, nivel=$3, membro_id=$4, ativo=$5, senha_hash=$6, atualizado_em=NOW()
         WHERE id=$7`,
        [nomeTrim, email, nivelFinal, membro_id || null, ativo !== false, senha_hash, req.params.id]
      );
    } else {
      await query(
        `UPDATE usuarios SET nome=$1, email=$2, nivel=$3, membro_id=$4, ativo=$5, atualizado_em=NOW()
         WHERE id=$6`,
        [nomeTrim, email, nivelFinal, membro_id || null, ativo !== false, req.params.id]
      );
    }
    ok(res, { id: req.params.id, nome: nomeTrim, email, nivel: nivelFinal, membro_id: membro_id || null, ativo: ativo !== false });
  } catch(e) { err(res, e.message); }
});

// Deleta usuário — só dentro da própria empresa, e nunca o próprio usuário
app.delete("/empresa/usuarios/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return err(res, "Você não pode excluir a si mesmo", 400);
    }

    const { rows: alvo } = await query(
      "SELECT id, empresa_id, perfil FROM usuarios WHERE id = $1",
      [req.params.id]
    );
    if (alvo.length === 0) return err(res, "Usuário não encontrado", 404);
    if (alvo[0].empresa_id !== req.user.empresa_id && req.user.perfil !== "master") {
      return err(res, "Usuário não pertence à sua empresa", 403);
    }
    if (alvo[0].perfil === "master") {
      return err(res, "Usuário master não pode ser excluído por esta rota", 403);
    }

    await query("DELETE FROM usuarios WHERE id = $1", [req.params.id]);
    ok(res, { id: req.params.id, deleted: true });
  } catch(e) { err(res, e.message); }
});

// ── MANUTENÇÃO (cron/manual) ──────────────────────────────────
// Endpoint manual pra testar ou forçar rodada fora do horário agendado.
// Protegido: só master pode chamar.
app.post("/admin/manutencao", authMiddleware, masterOnly, async (req, res) => {
  try {
    const resumo = await rodarManutencao(query);
    ok(res, resumo);
  } catch(e) { err(res, e.message); }
});

// ── SEED MASTER ────────────────────────────────────────────────
async function seedMaster() {
  const { rows: empRows } = await query("SELECT id FROM empresas WHERE id = 'emp_master'");
  if (empRows.length === 0) {
    await query("INSERT INTO empresas (id,nome,plano,ativo) VALUES ('emp_master','Vicke Master','master',TRUE)");
    console.log("  ✓ Empresa master criada");
  }
  const { rows: usrRows } = await query("SELECT id FROM usuarios WHERE email = 'renato@vicke.com.br'");
  if (usrRows.length === 0) {
    const senha_hash = bcrypt.hashSync("vicke2026", 10);
    await query("INSERT INTO usuarios (id,empresa_id,nome,email,senha_hash,perfil,ativo) VALUES ('usr_master','emp_master','Renato','renato@vicke.com.br',$1,'master',TRUE)", [senha_hash]);
    console.log("  ✓ Usuário master criado: renato@vicke.com.br / vicke2026");
  }
}

// ═══════════════════════════════════════════════════════════════
// PROTEÇÃO GLOBAL DAS ROTAS /api/*
// ═══════════════════════════════════════════════════════════════
// Todas as rotas /api/* exigem token (authMiddleware).
// Exceções: /api/health (pro Railway fazer health check sem token).
//
// Regras por nível (master e admin passam em tudo):
//   - visualizador: só GET/HEAD
//   - editor: GET/HEAD + POST/PUT/DELETE em recursos de trabalho
//            (clientes/orçamentos/obras/etc), MAS não pode:
//            • alterar config do escritório (/api/escritorio, /api/config/*, /api/logo)
//            • importar backup (operação destrutiva em massa)
//            • excluir recursos (DELETE)  ← UX diz "editor não exclui"
//   - admin/master: tudo
// ═══════════════════════════════════════════════════════════════

// Lista de rotas /api/* que exigem admin (além do master).
// Padrões: prefixo exato que começa com esses caminhos.
const API_ADMIN_ONLY_PATHS = [
  "/escritorio",         // PUT altera dados do escritório
  "/config",             // PUT /config/:chave (toda config)
  "/logo",               // PUT altera logo
  "/backup/importar",    // POST sobrescreve tudo — extremamente destrutivo
];

function isAdminOnlyApiPath(path) {
  return API_ADMIN_ONLY_PATHS.some(p => path === p || path.startsWith(p + "/"));
}

app.use("/api", (req, res, next) => {
  // Rotas públicas (sem auth)
  if (req.path === "/health") return next();

  // Autentica (popula req.user)
  authMiddleware(req, res, (errAuth) => {
    if (errAuth) return; // authMiddleware já respondeu com 401

    const isMaster = req.user?.perfil === "master";
    const nivel    = req.user?.nivel;
    const isAdmin  = isMaster || nivel === "admin";
    const isEditor = nivel === "editor";
    const isWrite  = req.method !== "GET" && req.method !== "HEAD";
    const isDelete = req.method === "DELETE";

    // Leitura: qualquer autenticado pode ler
    if (!isWrite) return next();

    // Visualizador nunca escreve
    if (!isAdmin && !isEditor) {
      return err(res, "Seu nível de acesso não permite alterar dados (somente visualização)", 403);
    }

    // DELETE: só admin — editor não exclui nada (consistente com o frontend)
    if (isDelete && !isAdmin) {
      return err(res, "Apenas administradores podem excluir registros", 403);
    }

    // Rotas sensíveis (config, backup): só admin
    if (isAdminOnlyApiPath(req.path) && !isAdmin) {
      return err(res, "Esta operação requer permissão de administrador", 403);
    }

    next();
  });
});

// ── CLIENTES ───────────────────────────────────────────────────
app.get("/api/clientes", async (req, res) => {
  try {
    const { rows } = await query("SELECT dados FROM clientes ORDER BY criado_em ASC");
    ok(res, rows.map(r => r.dados));
  } catch(e) { err(res, e.message); }
});

app.get("/api/clientes/:id", async (req, res) => {
  try {
    const { rows } = await query("SELECT dados FROM clientes WHERE id = $1", [req.params.id]);
    rows[0] ? ok(res, rows[0].dados) : err(res, "Não encontrado", 404);
  } catch(e) { err(res, e.message); }
});

app.post("/api/clientes", async (req, res) => {
  try {
    const c = req.body;
    if (!c.id || !c.nome) return err(res, "id e nome são obrigatórios");
    await query(`INSERT INTO clientes (id,dados) VALUES ($1,$2)
      ON CONFLICT(id) DO UPDATE SET dados=$2, atualizado_em=NOW()`, [c.id, c]);
    ok(res, c);
  } catch(e) { err(res, e.message); }
});

app.put("/api/clientes/:id", async (req, res) => {
  try {
    const c = { ...req.body, id: req.params.id };
    const { rowCount } = await query("UPDATE clientes SET dados=$1, atualizado_em=NOW() WHERE id=$2", [c, req.params.id]);
    rowCount === 0 ? err(res, "Não encontrado", 404) : ok(res, c);
  } catch(e) { err(res, e.message); }
});

app.delete("/api/clientes/:id", async (req, res) => {
  try {
    await query("DELETE FROM clientes WHERE id=$1", [req.params.id]);
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

// ── FORNECEDORES ───────────────────────────────────────────────
app.get("/api/fornecedores", async (req, res) => {
  try {
    const { rows } = await query("SELECT dados FROM fornecedores ORDER BY criado_em ASC");
    ok(res, rows.map(r => r.dados));
  } catch(e) { err(res, e.message); }
});

app.post("/api/fornecedores", async (req, res) => {
  try {
    const f = req.body;
    if (!f.id) return err(res, "id é obrigatório");
    await query(`INSERT INTO fornecedores (id,dados) VALUES ($1,$2)
      ON CONFLICT(id) DO UPDATE SET dados=$2, atualizado_em=NOW()`, [f.id, f]);
    ok(res, f);
  } catch(e) { err(res, e.message); }
});

app.put("/api/fornecedores/:id", async (req, res) => {
  try {
    const f = { ...req.body, id: req.params.id };
    const { rowCount } = await query("UPDATE fornecedores SET dados=$1, atualizado_em=NOW() WHERE id=$2", [f, req.params.id]);
    rowCount === 0 ? err(res, "Não encontrado", 404) : ok(res, f);
  } catch(e) { err(res, e.message); }
});

app.delete("/api/fornecedores/:id", async (req, res) => {
  try {
    await query("DELETE FROM fornecedores WHERE id=$1", [req.params.id]);
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

// ── MATERIAIS ──────────────────────────────────────────────────
app.get("/api/materiais", async (req, res) => {
  try {
    const { rows } = await query("SELECT dados FROM materiais ORDER BY criado_em ASC");
    ok(res, rows.map(r => r.dados));
  } catch(e) { err(res, e.message); }
});

app.post("/api/materiais", async (req, res) => {
  try {
    const m = req.body;
    if (!m.id) return err(res, "id é obrigatório");
    await query(`INSERT INTO materiais (id,dados) VALUES ($1,$2)
      ON CONFLICT(id) DO UPDATE SET dados=$2, atualizado_em=NOW()`, [m.id, m]);
    ok(res, m);
  } catch(e) { err(res, e.message); }
});

app.delete("/api/materiais/:id", async (req, res) => {
  try {
    await query("DELETE FROM materiais WHERE id=$1", [req.params.id]);
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

// ── OBRAS ──────────────────────────────────────────────────────
app.get("/api/obras", async (req, res) => {
  try {
    const { rows } = await query("SELECT dados FROM obras ORDER BY criado_em ASC");
    ok(res, rows.map(r => r.dados));
  } catch(e) { err(res, e.message); }
});

app.post("/api/obras", async (req, res) => {
  try {
    const o = req.body;
    if (!o.id) return err(res, "id é obrigatório");
    await query(`INSERT INTO obras (id,dados) VALUES ($1,$2)
      ON CONFLICT(id) DO UPDATE SET dados=$2, atualizado_em=NOW()`, [o.id, o]);
    ok(res, o);
  } catch(e) { err(res, e.message); }
});

app.delete("/api/obras/:id", async (req, res) => {
  try {
    await query("DELETE FROM obras WHERE id=$1", [req.params.id]);
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

// ── LANÇAMENTOS ────────────────────────────────────────────────
app.get("/api/lancamentos", async (req, res) => {
  try {
    const { rows } = await query("SELECT dados FROM lancamentos ORDER BY criado_em ASC");
    ok(res, rows.map(r => r.dados));
  } catch(e) { err(res, e.message); }
});

app.post("/api/lancamentos", async (req, res) => {
  try {
    const l = req.body;
    if (!l.id) return err(res, "id é obrigatório");
    await query(`INSERT INTO lancamentos (id,dados) VALUES ($1,$2)
      ON CONFLICT(id) DO UPDATE SET dados=$2, atualizado_em=NOW()`, [l.id, l]);
    ok(res, l);
  } catch(e) { err(res, e.message); }
});

app.delete("/api/lancamentos/:id", async (req, res) => {
  try {
    await query("DELETE FROM lancamentos WHERE id=$1", [req.params.id]);
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

// ── ORÇAMENTOS ─────────────────────────────────────────────────
app.get("/api/orcamentos", async (req, res) => {
  try {
    const { clienteId } = req.query;
    const { rows } = clienteId
      ? await query("SELECT dados FROM orcamentos_projeto WHERE cliente_id=$1 ORDER BY criado_em ASC", [clienteId])
      : await query("SELECT dados FROM orcamentos_projeto ORDER BY criado_em ASC");
    ok(res, rows.map(r => r.dados));
  } catch(e) { err(res, e.message); }
});

app.get("/api/orcamentos/:id", async (req, res) => {
  try {
    const { rows } = await query("SELECT dados FROM orcamentos_projeto WHERE id=$1", [req.params.id]);
    rows[0] ? ok(res, rows[0].dados) : err(res, "Não encontrado", 404);
  } catch(e) { err(res, e.message); }
});

app.post("/api/orcamentos", async (req, res) => {
  try {
    const o = req.body;
    if (!o.id) return err(res, "id é obrigatório");
    await query(`INSERT INTO orcamentos_projeto (id,cliente_id,dados) VALUES ($1,$2,$3)
      ON CONFLICT(id) DO UPDATE SET dados=$3, cliente_id=$2, atualizado_em=NOW()`,
      [o.id, o.clienteId || null, o]);
    ok(res, o);
  } catch(e) { err(res, e.message); }
});

app.put("/api/orcamentos/:id", async (req, res) => {
  try {
    const o = { ...req.body, id: req.params.id };
    const { rowCount } = await query("UPDATE orcamentos_projeto SET dados=$1, cliente_id=$2, atualizado_em=NOW() WHERE id=$3",
      [o, o.clienteId || null, req.params.id]);
    rowCount === 0 ? err(res, "Não encontrado", 404) : ok(res, o);
  } catch(e) { err(res, e.message); }
});

app.delete("/api/orcamentos/:id", async (req, res) => {
  try {
    await query("DELETE FROM orcamentos_projeto WHERE id=$1", [req.params.id]);
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

// ── RECEITAS ───────────────────────────────────────────────────
app.get("/api/receitas", async (req, res) => {
  try {
    const { orcId, clienteId } = req.query;
    const { rows } = orcId
      ? await query("SELECT dados FROM receitas_financeiro WHERE orc_id=$1 ORDER BY criado_em ASC", [orcId])
      : clienteId
        ? await query("SELECT dados FROM receitas_financeiro WHERE cliente_id=$1 ORDER BY criado_em ASC", [clienteId])
        : await query("SELECT dados FROM receitas_financeiro ORDER BY criado_em ASC");
    ok(res, rows.map(r => r.dados));
  } catch(e) { err(res, e.message); }
});

app.post("/api/receitas", async (req, res) => {
  try {
    const r = req.body;
    if (!r.id) return err(res, "id é obrigatório");
    await query(`INSERT INTO receitas_financeiro (id,orc_id,cliente_id,dados) VALUES ($1,$2,$3,$4)
      ON CONFLICT(id) DO UPDATE SET dados=$4, atualizado_em=NOW()`,
      [r.id, r.orcId || null, r.clienteId || null, r]);
    ok(res, r);
  } catch(e) { err(res, e.message); }
});

app.post("/api/receitas/batch", async (req, res) => {
  try {
    const { receitas } = req.body;
    if (!Array.isArray(receitas)) return err(res, "receitas deve ser um array");
    for (const r of receitas) {
      if (!r.id) continue;
      await query(`INSERT INTO receitas_financeiro (id,orc_id,cliente_id,dados) VALUES ($1,$2,$3,$4)
        ON CONFLICT(id) DO UPDATE SET dados=$4, atualizado_em=NOW()`,
        [r.id, r.orcId || null, r.clienteId || null, r]);
    }
    ok(res, receitas);
  } catch(e) { err(res, e.message); }
});

app.delete("/api/receitas/:id", async (req, res) => {
  try {
    await query("DELETE FROM receitas_financeiro WHERE id=$1", [req.params.id]);
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

app.delete("/api/receitas/por-orcamento/:orcId", async (req, res) => {
  try {
    const { rowCount } = await query("DELETE FROM receitas_financeiro WHERE orc_id=$1", [req.params.orcId]);
    ok(res, { deleted: rowCount });
  } catch(e) { err(res, e.message); }
});

// ── ESCRITÓRIO ─────────────────────────────────────────────────
app.get("/api/escritorio", async (req, res) => {
  try {
    const { rows } = await query("SELECT dados FROM escritorio WHERE id=1");
    ok(res, rows[0]?.dados || null);
  } catch(e) { err(res, e.message); }
});

app.put("/api/escritorio", async (req, res) => {
  try {
    const dados = req.body;
    await query(`INSERT INTO escritorio (id,dados) VALUES (1,$1)
      ON CONFLICT(id) DO UPDATE SET dados=$1, atualizado_em=NOW()`, [dados]);
    ok(res, dados);
  } catch(e) { err(res, e.message); }
});

// ── CONFIG ─────────────────────────────────────────────────────
app.get("/api/config/:chave", async (req, res) => {
  try {
    const { rows } = await query("SELECT dados FROM config_geral WHERE chave=$1", [req.params.chave]);
    ok(res, rows[0]?.dados || null);
  } catch(e) { err(res, e.message); }
});

app.put("/api/config/:chave", async (req, res) => {
  try {
    const dados = req.body;
    await query(`INSERT INTO config_geral (chave,dados) VALUES ($1,$2)
      ON CONFLICT(chave) DO UPDATE SET dados=$2, atualizado_em=NOW()`, [req.params.chave, dados]);
    ok(res, dados);
  } catch(e) { err(res, e.message); }
});

// ── LOGO ───────────────────────────────────────────────────────
app.get("/api/logo", async (req, res) => {
  try {
    const { rows } = await query("SELECT dados FROM config_geral WHERE chave='escritorio-logo'");
    ok(res, rows[0]?.dados || null);
  } catch(e) { err(res, e.message); }
});

app.put("/api/logo", async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return err(res, "data é obrigatório");
    await query(`INSERT INTO config_geral (chave,dados) VALUES ('escritorio-logo',$1)
      ON CONFLICT(chave) DO UPDATE SET dados=$1, atualizado_em=NOW()`, [data]);
    ok(res, { saved: true });
  } catch(e) { err(res, e.message); }
});

// ── BACKUP ─────────────────────────────────────────────────────
app.get("/api/backup", async (req, res) => {
  try {
    const [cl, fo, ma, ob, la, orc, rec, esc] = await Promise.all([
      query("SELECT dados FROM clientes"),
      query("SELECT dados FROM fornecedores"),
      query("SELECT dados FROM materiais"),
      query("SELECT dados FROM obras"),
      query("SELECT dados FROM lancamentos"),
      query("SELECT dados FROM orcamentos_projeto"),
      query("SELECT dados FROM receitas_financeiro"),
      query("SELECT dados FROM escritorio WHERE id=1"),
    ]);
    const backup = {
      clientes:           cl.rows.map(r => r.dados),
      fornecedores:       fo.rows.map(r => r.dados),
      materiais:          ma.rows.map(r => r.dados),
      obras:              ob.rows.map(r => r.dados),
      lancamentos:        la.rows.map(r => r.dados),
      orcamentosProjeto:  orc.rows.map(r => r.dados),
      receitasFinanceiro: rec.rows.map(r => r.dados),
      escritorio:         esc.rows[0]?.dados || {},
      exportadoEm:        now(),
    };
    res.setHeader("Content-Disposition", `attachment; filename="vicke-backup-${new Date().toISOString().slice(0,10)}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.json(backup);
  } catch(e) { err(res, e.message); }
});

app.post("/api/backup/importar", async (req, res) => {
  try {
    const dados = req.body;
    for (const c of (dados.clientes || [])) {
      if (!c.id) continue;
      await query(`INSERT INTO clientes (id,dados) VALUES ($1,$2) ON CONFLICT(id) DO UPDATE SET dados=$2`, [c.id, c]);
    }
    for (const f of (dados.fornecedores || [])) {
      if (!f.id) continue;
      await query(`INSERT INTO fornecedores (id,dados) VALUES ($1,$2) ON CONFLICT(id) DO UPDATE SET dados=$2`, [f.id, f]);
    }
    for (const m of (dados.materiais || [])) {
      if (!m.id) continue;
      await query(`INSERT INTO materiais (id,dados) VALUES ($1,$2) ON CONFLICT(id) DO UPDATE SET dados=$2`, [m.id, m]);
    }
    for (const o of (dados.obras || [])) {
      if (!o.id) continue;
      await query(`INSERT INTO obras (id,dados) VALUES ($1,$2) ON CONFLICT(id) DO UPDATE SET dados=$2`, [o.id, o]);
    }
    for (const l of (dados.lancamentos || [])) {
      if (!l.id) continue;
      await query(`INSERT INTO lancamentos (id,dados) VALUES ($1,$2) ON CONFLICT(id) DO UPDATE SET dados=$2`, [l.id, l]);
    }
    for (const o of (dados.orcamentosProjeto || [])) {
      if (!o.id) continue;
      await query(`INSERT INTO orcamentos_projeto (id,cliente_id,dados) VALUES ($1,$2,$3) ON CONFLICT(id) DO UPDATE SET dados=$3`,
        [o.id, o.clienteId || null, o]);
    }
    for (const r of (dados.receitasFinanceiro || [])) {
      if (!r.id) continue;
      await query(`INSERT INTO receitas_financeiro (id,orc_id,cliente_id,dados) VALUES ($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET dados=$4`,
        [r.id, r.orcId || null, r.clienteId || null, r]);
    }
    if (dados.escritorio) {
      await query(`INSERT INTO escritorio (id,dados) VALUES (1,$1) ON CONFLICT(id) DO UPDATE SET dados=$1`, [dados.escritorio]);
    }
    ok(res, { importado: true });
  } catch(e) { err(res, e.message); }
});

// ── HEALTH ─────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ ok: true, version: "2.0.0", db: "postgresql", timestamp: now() });
});

// ── SPA fallback ───────────────────────────────────────────────
if (fs.existsSync(FRONTEND_PATH)) {
  app.get("*", (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, "index.html"));
  });
}

// ── Start ──────────────────────────────────────────────────────
async function start() {
  try {
    await initDB();
    await seedMaster();

    // Inicia o servidor PRIMEIRO — garante que o healthcheck responde
    // antes de qualquer coisa que possa dar problema (cron, etc)
    app.listen(PORT, () => {
      console.log(`\n✓ Vicke rodando em http://localhost:${PORT}`);
      console.log(`  Banco: PostgreSQL`);
      console.log(`  Pressione Ctrl+C para parar\n`);
    });

    // Agenda manutenção diária às 3h da manhã (isolado em try/catch pra não derrubar o server)
    // Expira propostas > 30 dias e inativa clientes > 3 meses sem serviço
    try {
      cron.schedule("0 3 * * *", async () => {
        try {
          await rodarManutencao(query);
        } catch (e) {
          console.error("[manutenção] Erro:", e.message);
        }
      });
      console.log("  ✓ Job de manutenção agendado (3h da manhã)");
    } catch (e) {
      console.error("  ⚠ Não foi possível agendar manutenção automática:", e.message);
      console.error("  ⚠ Use POST /admin/manutencao manualmente se necessário");
    }
  } catch(e) {
    console.error("Erro ao iniciar:", e);
    process.exit(1);
  }
}

start();

// ── Tratamento global de exceções ──────────────────────────────
// Loga exceções não capturadas mas NÃO derruba o server. O Railway
// só deve matar o container se o healthcheck /api/health falhar.
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

process.on("SIGINT",  () => { pool.end(); process.exit(0); });
process.on("SIGTERM", () => { pool.end(); process.exit(0); });
