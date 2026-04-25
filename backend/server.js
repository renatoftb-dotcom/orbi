// ═══════════════════════════════════════════════════════════════
// VICKE — Backend Server
// Node.js + Express + PostgreSQL
// ═══════════════════════════════════════════════════════════════
// Sprint 2: Multi-tenant + segurança
// - Todas as rotas /api/* filtram por req.user.empresa_id
// - INSERTs forçam empresa_id do JWT (ignoram body)
// - Master vê apenas dados da própria empresa (emp_master)
// - CORS restrito aos domínios de produção + localhost
// - JWT_SECRET obrigatório em produção (crash no boot sem ele)
// - Rate limit em /auth/login (5 tentativas / 15 min por IP)
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

// ── Config via ENV ────────────────────────────────────────────
const IS_PROD     = process.env.NODE_ENV === "production";
const JWT_SECRET  = process.env.JWT_SECRET || (IS_PROD ? null : "vicke-secret-dev-2026");
const PORT        = process.env.PORT || 3000;

// Em produção, JWT_SECRET é obrigatório. Sem ele, o servidor não sobe.
// Isso evita o risco de emitir tokens assinados com segredo público
// caso alguém esqueça de configurar a variável no Railway.
if (!JWT_SECRET) {
  console.error("✗ FATAL: JWT_SECRET é obrigatório em produção. Configure a variável no Railway.");
  process.exit(1);
}
if (!process.env.JWT_SECRET && !IS_PROD) {
  console.warn("⚠ JWT_SECRET não definido — usando fallback de desenvolvimento.");
}

const app = express();

// ── CORS restrito ─────────────────────────────────────────────
// Só aceita requisições dos domínios oficiais. Em dev, libera localhost.
// Qualquer outra origem recebe 403 antes mesmo de chegar nas rotas.
const ALLOWED_ORIGINS = [
  "https://vicke.com.br",
  "https://www.vicke.com.br",
  "https://orbi.log.br",
  "https://orbi-pouk.vercel.app",
  "http://localhost:5173", // Vite dev server
  "http://localhost:3000", // fallback dev
];
app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (ex: curl, healthcheck do Railway, same-origin)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // Permite previews da Vercel (*.vercel.app) pro Renato testar branches
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return callback(null, true);
    return callback(new Error(`CORS bloqueado: origem ${origin} não permitida`));
  },
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));

// Serve frontend estático se existir (útil em dev local com backend e frontend juntos)
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
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

// ── Criação/verificação das tabelas ───────────────────────────
// Esta função só garante que empresas, usuarios, config_geral
// existem. As tabelas de negócio (clientes, orcamentos, etc) foram
// criadas pelo script migration-sprint2.sql e têm empresa_id FK.
async function initDB() {
  await query(`
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

    CREATE TABLE IF NOT EXISTS config_geral (
      chave        TEXT PRIMARY KEY,
      dados        JSONB NOT NULL,
      atualizado_em TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Migrations incrementais — ALTER TABLE idempotente. Adiciona colunas novas
  // em tabelas já existentes sem quebrar instalações anteriores.
  // cnpj_cpf: documento da empresa (CNPJ formatado para PJ, CPF para profissional liberal).
  // Tipo TEXT pra preservar a formatação escolhida pelo usuário (com ou sem pontuação).
  // Sem UNIQUE — podem existir outras razões pra 2 empresas compartilharem docs
  // (holding, mudança de CNPJ, etc). Unicidade é regra de negócio, não constraint.
  await query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cnpj_cpf TEXT;`);

  console.log("  ✓ Tabelas verificadas/criadas");
}

// ── Helpers de resposta ────────────────────────────────────────
const ok  = (res, data)         => res.json({ ok: true, data });
const err = (res, msg, s = 400) => res.status(s).json({ ok: false, error: msg });
const now = ()                  => new Date().toISOString();

// ── Middleware de autenticação ─────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) return err(res, "Token não fornecido", 401);
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

function adminOnly(req, res, next) {
  const isMaster = req.user?.perfil === "master";
  const isAdmin  = req.user?.nivel === "admin";
  if (!isMaster && !isAdmin) return err(res, "Acesso restrito a administradores", 403);
  next();
}

// ── Rate limit simples em /auth/login ─────────────────────────
// 5 tentativas por IP a cada 15 minutos. Sem dependência externa
// pra não aumentar surface de attack — implementação em memória é
// suficiente pra proteção básica (o Railway só tem 1 processo).
const loginAttempts = new Map(); // ip → { count, firstAt }
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_TRIES = 5;

function rateLimitLogin(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAt: now });
    return next();
  }

  if (entry.count >= LOGIN_MAX_TRIES) {
    const restMin = Math.ceil((LOGIN_WINDOW_MS - (now - entry.firstAt)) / 60000);
    return res.status(429).json({
      ok: false,
      error: `Muitas tentativas de login. Tente novamente em ${restMin} min.`,
    });
  }

  entry.count++;
  next();
}

// Limpa tentativas antigas a cada 30 min pra não crescer memória indefinidamente
setInterval(() => {
  const cutoff = Date.now() - LOGIN_WINDOW_MS;
  for (const [ip, entry] of loginAttempts.entries()) {
    if (entry.firstAt < cutoff) loginAttempts.delete(ip);
  }
}, 30 * 60 * 1000);

// ══════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════

app.post("/auth/login", rateLimitLogin, async (req, res) => {
  try {
    const { senha } = req.body;
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
      {
        id: usuario.id, nome: usuario.nome, email: usuario.email,
        perfil: usuario.perfil, nivel: usuario.nivel || "admin",
        membro_id: usuario.membro_id || null,
        empresa_id: usuario.empresa_id,
        empresa_nome: empresa.nome,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Resetar contador de rate limit após login bem-sucedido
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    loginAttempts.delete(ip);

    ok(res, {
      token,
      usuario: {
        id: usuario.id, nome: usuario.nome, email: usuario.email,
        perfil: usuario.perfil, nivel: usuario.nivel || "admin",
        membro_id: usuario.membro_id || null,
        empresa_id: usuario.empresa_id,
        empresa_nome: empresa.nome,
      },
    });
  } catch(e) { err(res, e.message); }
});

app.get("/auth/me", authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT id,nome,email,perfil,nivel,membro_id,empresa_id,ativo FROM usuarios WHERE id = $1",
      [req.user.id]
    );
    const usuario = rows[0];
    if (!usuario || !usuario.ativo) return err(res, "Usuário inativo", 401);
    const { rows: empRows } = await query("SELECT nome FROM empresas WHERE id = $1", [usuario.empresa_id]);
    ok(res, { ...usuario, empresa_nome: empRows[0]?.nome });
  } catch(e) { err(res, e.message); }
});

// ══════════════════════════════════════════════════════════════
// ADMIN — só master, gerencia empresas e usuários master
// ══════════════════════════════════════════════════════════════

app.get("/admin/empresas", authMiddleware, masterOnly, async (req, res) => {
  try {
    // JOIN com contagens agregadas de usuários e orçamentos.
    // LEFT JOIN pra não perder empresas vazias (recém-criadas).
    // COUNT(DISTINCT) defensivo contra joins que multipliquem linhas.
    const { rows } = await query(`
      SELECT
        e.id, e.nome, e.cnpj_cpf, e.plano, e.ativo, e.criado_em, e.atualizado_em,
        COUNT(DISTINCT u.id) FILTER (WHERE u.ativo = TRUE) AS usuarios_ativos,
        COUNT(DISTINCT u.id) AS usuarios_total,
        COUNT(DISTINCT o.id) AS orcamentos_total,
        MAX(u.atualizado_em) AS ultima_atividade_usuarios
      FROM empresas e
      LEFT JOIN usuarios u ON u.empresa_id = e.id
      LEFT JOIN orcamentos_projeto o ON o.empresa_id = e.id
      GROUP BY e.id
      ORDER BY e.criado_em ASC
    `);
    ok(res, rows);
  } catch(e) { err(res, e.message); }
});

app.post("/admin/empresas", authMiddleware, masterOnly, async (req, res) => {
  // Criação atômica: empresa + primeiro admin em uma transação.
  // Se a criação do admin falhar (email duplicado, etc), faz rollback
  // da empresa também — evita órfãos e facilita retry.
  const { nome, cnpj_cpf, plano, admin } = req.body;
  const nomeTrim = (nome || "").trim();
  if (!nomeTrim) return err(res, "Nome da empresa é obrigatório");

  // Admin inicial obrigatório — empresa sem acesso é inútil.
  if (!admin || typeof admin !== "object") {
    return err(res, "Dados do administrador são obrigatórios (nome, email, senha)");
  }
  const adminNome = (admin.nome || "").trim();
  const adminEmail = (admin.email || "").trim().toLowerCase();
  const adminSenha = admin.senha || "";
  if (!adminNome || !adminEmail || !adminSenha) {
    return err(res, "Admin: nome, email e senha são obrigatórios");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) return err(res, "Email do admin inválido");
  if (adminSenha.length < 6) return err(res, "Senha do admin deve ter no mínimo 6 caracteres");

  // Checa email duplicado antes de iniciar transação (mais rápido)
  const { rows: emailExiste } = await query("SELECT id FROM usuarios WHERE email = $1", [adminEmail]);
  if (emailExiste.length > 0) return err(res, "Email do admin já está em uso");

  // Gera id amigável baseado no nome (slug) + timestamp pra evitar colisão
  const slug = nomeTrim.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    .slice(0, 30);
  const empresaId = `emp_${slug || "sem-nome"}_${Date.now().toString(36)}`;
  const usuarioId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const senhaHash = bcrypt.hashSync(adminSenha, 10);
  const cnpjTrim = (cnpj_cpf || "").trim() || null;

  // Transação manual via BEGIN/COMMIT/ROLLBACK com cliente dedicado.
  // Pool.connect() pra garantir que todas queries rodam na mesma conexão.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO empresas (id, nome, cnpj_cpf, plano, ativo) VALUES ($1, $2, $3, $4, TRUE)",
      [empresaId, nomeTrim, cnpjTrim, plano || "gratuito"]
    );
    await client.query(
      "INSERT INTO escritorio (empresa_id, dados) VALUES ($1, '{}'::jsonb) ON CONFLICT (empresa_id) DO NOTHING",
      [empresaId]
    );
    await client.query(
      `INSERT INTO usuarios (id, empresa_id, nome, email, senha_hash, perfil, nivel, ativo)
       VALUES ($1, $2, $3, $4, $5, 'escritorio', 'admin', TRUE)`,
      [usuarioId, empresaId, adminNome, adminEmail, senhaHash]
    );
    await client.query("COMMIT");
    ok(res, {
      id: empresaId, nome: nomeTrim, cnpj_cpf: cnpjTrim,
      plano: plano || "gratuito", ativo: true,
      admin: { id: usuarioId, nome: adminNome, email: adminEmail, nivel: "admin" },
    });
  } catch(e) {
    await client.query("ROLLBACK").catch(() => {});
    err(res, e.message);
  } finally {
    client.release();
  }
});

app.put("/admin/empresas/:id", authMiddleware, masterOnly, async (req, res) => {
  try {
    const { nome, cnpj_cpf, plano, ativo } = req.body;
    // Bloqueia inativação da empresa master pra evitar auto-lockout:
    // se o master inativar emp_master, ele mesmo fica sem conseguir logar.
    if (req.params.id === "emp_master" && ativo === false) {
      return err(res, "Empresa master não pode ser inativada", 400);
    }
    await query(
      "UPDATE empresas SET nome=$1, cnpj_cpf=$2, plano=$3, ativo=$4, atualizado_em=NOW() WHERE id=$5",
      [nome, (cnpj_cpf || "").trim() || null, plano, ativo, req.params.id]
    );
    ok(res, { id: req.params.id, nome, cnpj_cpf, plano, ativo });
  } catch(e) { err(res, e.message); }
});

app.delete("/admin/empresas/:id", authMiddleware, masterOnly, async (req, res) => {
  try {
    if (req.params.id === "emp_master") {
      return err(res, "Empresa master não pode ser excluída", 400);
    }
    // ON DELETE CASCADE nas tabelas de negócio: dropar empresa apaga tudo junto
    await query("DELETE FROM empresas WHERE id = $1", [req.params.id]);
    ok(res, { id: req.params.id, deleted: true });
  } catch(e) { err(res, e.message); }
});

// Lista todos os usuários do sistema (de todas as empresas)
app.get("/admin/usuarios", authMiddleware, masterOnly, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.empresa_id, e.nome as empresa_nome,
              u.nome, u.email, u.perfil, u.nivel, u.ativo, u.criado_em
       FROM usuarios u
       LEFT JOIN empresas e ON e.id = u.empresa_id
       ORDER BY u.criado_em ASC`
    );
    ok(res, rows);
  } catch(e) { err(res, e.message); }
});

// Cria usuário em qualquer empresa (master decide onde)
app.post("/admin/usuarios", authMiddleware, masterOnly, async (req, res) => {
  try {
    const { empresa_id, nome, senha, perfil, nivel } = req.body;
    const email = (req.body.email || "").trim().toLowerCase();
    const nomeTrim = (nome || "").trim();
    if (!empresa_id || !nomeTrim || !email || !senha) {
      return err(res, "empresa_id, nome, email e senha são obrigatórios");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(res, "Email inválido");
    if (senha.length < 6) return err(res, "A senha deve ter no mínimo 6 caracteres");

    const { rows: empCheck } = await query("SELECT id FROM empresas WHERE id = $1", [empresa_id]);
    if (empCheck.length === 0) return err(res, "Empresa não encontrada", 404);

    const { rows: existe } = await query("SELECT id FROM usuarios WHERE email = $1", [email]);
    if (existe.length > 0) return err(res, "Email já cadastrado");

    const nivelValido = ["admin", "editor", "visualizador"];
    const nivelFinal = nivelValido.includes(nivel) ? nivel : "admin";
    const perfilFinal = perfil === "master" ? "master" : "escritorio";

    // Limite de 3 usuários master no sistema.
    // Masters têm acesso total e podem criar/remover empresas — por segurança
    // limitamos pra no máximo 3 (dono + 2 sócios/técnicos). Muitos masters
    // ativos aumentam superfície de ataque e risco de vazamento de credencial.
    if (perfilFinal === "master") {
      const { rows: mastersRows } = await query(
        "SELECT COUNT(*)::int AS total FROM usuarios WHERE perfil = 'master' AND ativo = TRUE"
      );
      const totalMasters = mastersRows[0]?.total || 0;
      if (totalMasters >= 3) {
        return err(res, "Limite de 3 usuários master atingido. Inative um existente antes de criar outro.");
      }
    }

    const id = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const senha_hash = bcrypt.hashSync(senha, 10);

    await query(
      `INSERT INTO usuarios (id, empresa_id, nome, email, senha_hash, perfil, nivel, ativo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
      [id, empresa_id, nomeTrim, email, senha_hash, perfilFinal, nivelFinal]
    );
    ok(res, { id, empresa_id, nome: nomeTrim, email, perfil: perfilFinal, nivel: nivelFinal, ativo: true });
  } catch(e) { err(res, e.message); }
});

app.put("/admin/usuarios/:id", authMiddleware, masterOnly, async (req, res) => {
  try {
    const { nome, perfil, nivel, ativo, senha } = req.body;
    const email = (req.body.email || "").trim().toLowerCase();
    const nomeTrim = (nome || "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(res, "Email inválido");

    // Se email mudou, checa duplicidade
    if (email) {
      const { rows: dup } = await query("SELECT id FROM usuarios WHERE email = $1 AND id <> $2", [email, req.params.id]);
      if (dup.length > 0) return err(res, "Email já cadastrado por outro usuário");
    }

    // Proteção contra "degradar" o último master ativo.
    // Se o update vai: trocar perfil de master → escritorio OU inativar o usuário,
    // verifica se ele é master E se tem outros masters ativos.
    const { rows: atualRows } = await query(
      "SELECT perfil, ativo FROM usuarios WHERE id = $1", [req.params.id]
    );
    const atual = atualRows[0];
    if (atual && atual.perfil === "master" && atual.ativo) {
      const perderiaMaster = (perfil === "escritorio") || (ativo === false);
      if (perderiaMaster) {
        const { rows: outros } = await query(
          "SELECT COUNT(*)::int AS total FROM usuarios WHERE perfil='master' AND ativo=TRUE AND id <> $1",
          [req.params.id]
        );
        if ((outros[0]?.total || 0) === 0) {
          return err(res, "Não é possível remover o perfil master ou inativar o último master ativo", 400);
        }
      }
    }

    if (senha) {
      if (senha.length < 6) return err(res, "A senha deve ter no mínimo 6 caracteres");
      const senha_hash = bcrypt.hashSync(senha, 10);
      await query(
        `UPDATE usuarios SET nome=$1,email=$2,perfil=$3,nivel=$4,ativo=$5,senha_hash=$6,atualizado_em=NOW()
         WHERE id=$7`,
        [nomeTrim, email, perfil, nivel, ativo, senha_hash, req.params.id]
      );
    } else {
      await query(
        `UPDATE usuarios SET nome=$1,email=$2,perfil=$3,nivel=$4,ativo=$5,atualizado_em=NOW()
         WHERE id=$6`,
        [nomeTrim, email, perfil, nivel, ativo, req.params.id]
      );
    }
    ok(res, { id: req.params.id, nome: nomeTrim, email, perfil, nivel, ativo });
  } catch(e) { err(res, e.message); }
});

app.delete("/admin/usuarios/:id", authMiddleware, masterOnly, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return err(res, "Você não pode excluir a si mesmo", 400);
    }
    // Se o alvo é master, garante que não é o último master ativo.
    // Sistema sem master = impossível gerenciar empresas/usuários master.
    const { rows: alvoRows } = await query(
      "SELECT perfil, ativo FROM usuarios WHERE id = $1", [req.params.id]
    );
    const alvo = alvoRows[0];
    if (alvo && alvo.perfil === "master" && alvo.ativo) {
      const { rows: mastersRows } = await query(
        "SELECT COUNT(*)::int AS total FROM usuarios WHERE perfil = 'master' AND ativo = TRUE AND id <> $1",
        [req.params.id]
      );
      const outrosMasters = mastersRows[0]?.total || 0;
      if (outrosMasters === 0) {
        return err(res, "Não é possível excluir o último usuário master ativo", 400);
      }
    }
    await query("DELETE FROM usuarios WHERE id = $1", [req.params.id]);
    ok(res, { id: req.params.id, deleted: true });
  } catch(e) { err(res, e.message); }
});

// ══════════════════════════════════════════════════════════════
// EMPRESA/USUARIOS — admin do escritório gerencia seu próprio time
// ══════════════════════════════════════════════════════════════

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

app.post("/empresa/usuarios", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { nome, senha, nivel, membro_id } = req.body;
    const email = (req.body.email || "").trim().toLowerCase();
    const nomeTrim = (nome || "").trim();
    if (!nomeTrim || !email || !senha) return err(res, "Nome, email e senha são obrigatórios");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(res, "Email inválido");
    if (senha.length < 6) return err(res, "A senha deve ter no mínimo 6 caracteres");

    const nivelValido = ["admin", "editor", "visualizador"];
    const nivelFinal = nivelValido.includes(nivel) ? nivel : "visualizador";

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

app.put("/empresa/usuarios/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { nome, senha, nivel, membro_id, ativo } = req.body;
    const email = (req.body.email || "").trim().toLowerCase();
    const nomeTrim = (nome || "").trim();

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(res, "Email inválido");

    const { rows: alvo } = await query(
      "SELECT id, empresa_id, perfil FROM usuarios WHERE id = $1",
      [req.params.id]
    );
    if (alvo.length === 0) return err(res, "Usuário não encontrado", 404);
    if (alvo[0].empresa_id !== req.user.empresa_id && req.user.perfil !== "master") {
      return err(res, "Usuário não pertence à sua empresa", 403);
    }
    if (req.params.id === req.user.id && ativo === false) {
      return err(res, "Você não pode desativar a si mesmo", 400);
    }

    // Checa email duplicado se mudou
    if (email) {
      const { rows: dup } = await query("SELECT id FROM usuarios WHERE email = $1 AND id <> $2", [email, req.params.id]);
      if (dup.length > 0) return err(res, "Email já cadastrado por outro usuário");
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

app.delete("/empresa/usuarios/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    if (req.params.id === req.user.id) return err(res, "Você não pode excluir a si mesmo", 400);

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

// ══════════════════════════════════════════════════════════════
// MANUTENÇÃO (cron/manual)
// ══════════════════════════════════════════════════════════════
app.post("/admin/manutencao", authMiddleware, masterOnly, async (req, res) => {
  try {
    const resumo = await rodarManutencao(query);
    ok(res, resumo);
  } catch(e) { err(res, e.message); }
});

// ══════════════════════════════════════════════════════════════
// SEED MASTER — cria usuário Renato se ainda não existir
// ══════════════════════════════════════════════════════════════
async function seedMaster() {
  const { rows: empRows } = await query("SELECT id FROM empresas WHERE id = 'emp_master'");
  if (empRows.length === 0) {
    await query("INSERT INTO empresas (id,nome,plano,ativo) VALUES ('emp_master','Vicke Master','master',TRUE)");
    console.log("  ✓ Empresa master criada");
  }
  const { rows: usrRows } = await query("SELECT id FROM usuarios WHERE email = 'renato@vicke.com.br'");
  if (usrRows.length === 0) {
    const senha_hash = bcrypt.hashSync("vicke2026", 10);
    await query(
      "INSERT INTO usuarios (id,empresa_id,nome,email,senha_hash,perfil,nivel,ativo) VALUES ('usr_master','emp_master','Renato','renato@vicke.com.br',$1,'master','admin',TRUE)",
      [senha_hash]
    );
    console.log("  ✓ Usuário master criado: renato@vicke.com.br / vicke2026");
  }
  // Garante linha de escritório da master
  await query(
    "INSERT INTO escritorio (empresa_id, dados) VALUES ('emp_master', '{}'::jsonb) ON CONFLICT (empresa_id) DO NOTHING"
  );
}

// ══════════════════════════════════════════════════════════════
// PROTEÇÃO GLOBAL DAS ROTAS /api/* + MULTI-TENANT
// ══════════════════════════════════════════════════════════════
// Todas as rotas /api/* passam por authMiddleware e, a partir daqui,
// são filtradas pelo empresa_id do JWT.
//
// Regras por nível (master passa em tudo de sua própria empresa):
//   - visualizador: só GET/HEAD
//   - editor: GET/HEAD + POST/PUT/DELETE em recursos de trabalho,
//             exceto config do escritório, backup, exclusões
//   - admin/master: tudo
//
// Exceção: /api/health é pública (Railway healthcheck sem token)
// ══════════════════════════════════════════════════════════════

const API_ADMIN_ONLY_PATHS = [
  "/escritorio",
  "/config",
  "/logo",
  "/backup/importar",
];

function isAdminOnlyApiPath(path) {
  return API_ADMIN_ONLY_PATHS.some(p => path === p || path.startsWith(p + "/"));
}

app.use("/api", (req, res, next) => {
  if (req.path === "/health") return next();

  authMiddleware(req, res, (errAuth) => {
    if (errAuth) return;

    const isMaster = req.user?.perfil === "master";
    const nivel    = req.user?.nivel;
    const isAdmin  = isMaster || nivel === "admin";
    const isEditor = nivel === "editor";
    const isWrite  = req.method !== "GET" && req.method !== "HEAD";
    const isDelete = req.method === "DELETE";

    if (!isWrite) return next();

    if (!isAdmin && !isEditor) {
      return err(res, "Seu nível de acesso não permite alterar dados", 403);
    }
    if (isDelete && !isAdmin) {
      return err(res, "Apenas administradores podem excluir registros", 403);
    }
    if (isAdminOnlyApiPath(req.path) && !isAdmin) {
      return err(res, "Esta operação requer permissão de administrador", 403);
    }
    next();
  });
});

// ── HELPER: empresa do JWT ────────────────────────────────────
// Centraliza a extração do empresa_id pra evitar repetir em toda rota.
// Se por algum motivo o JWT não tiver empresa_id (token antigo), rejeita.
function empresaId(req, res) {
  const eid = req.user?.empresa_id;
  if (!eid) {
    err(res, "Token sem empresa_id — faça login novamente", 401);
    return null;
  }
  return eid;
}

// ══════════════════════════════════════════════════════════════
// CLIENTES
// ══════════════════════════════════════════════════════════════
app.get("/api/clientes", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const { rows } = await query(
      "SELECT dados FROM clientes WHERE empresa_id = $1 ORDER BY criado_em ASC",
      [eid]
    );
    ok(res, rows.map(r => r.dados));
  } catch(e) { err(res, e.message); }
});

app.get("/api/clientes/:id", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const { rows } = await query(
      "SELECT dados FROM clientes WHERE id = $1 AND empresa_id = $2",
      [req.params.id, eid]
    );
    rows[0] ? ok(res, rows[0].dados) : err(res, "Não encontrado", 404);
  } catch(e) { err(res, e.message); }
});

app.post("/api/clientes", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const c = req.body;
    if (!c.id || !c.nome) return err(res, "id e nome são obrigatórios");
    // UPSERT só atualiza se o registro pertence à mesma empresa (evita sequestro)
    await query(
      `INSERT INTO clientes (id, empresa_id, dados) VALUES ($1, $2, $3)
       ON CONFLICT(id) DO UPDATE SET dados=$3, atualizado_em=NOW()
       WHERE clientes.empresa_id = $2`,
      [c.id, eid, c]
    );
    ok(res, c);
  } catch(e) { err(res, e.message); }
});

app.put("/api/clientes/:id", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const c = { ...req.body, id: req.params.id };
    const { rowCount } = await query(
      "UPDATE clientes SET dados=$1, atualizado_em=NOW() WHERE id=$2 AND empresa_id=$3",
      [c, req.params.id, eid]
    );
    rowCount === 0 ? err(res, "Não encontrado", 404) : ok(res, c);
  } catch(e) { err(res, e.message); }
});

app.delete("/api/clientes/:id", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    await query("DELETE FROM clientes WHERE id=$1 AND empresa_id=$2", [req.params.id, eid]);
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

// ══════════════════════════════════════════════════════════════
// FORNECEDORES
// ══════════════════════════════════════════════════════════════
app.get("/api/fornecedores", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const { rows } = await query(
      "SELECT dados FROM fornecedores WHERE empresa_id = $1 ORDER BY criado_em ASC",
      [eid]
    );
    ok(res, rows.map(r => r.dados));
  } catch(e) { err(res, e.message); }
});

app.post("/api/fornecedores", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const f = req.body;
    if (!f.id) return err(res, "id é obrigatório");
    await query(
      `INSERT INTO fornecedores (id, empresa_id, dados) VALUES ($1, $2, $3)
       ON CONFLICT(id) DO UPDATE SET dados=$3, atualizado_em=NOW()
       WHERE fornecedores.empresa_id = $2`,
      [f.id, eid, f]
    );
    ok(res, f);
  } catch(e) { err(res, e.message); }
});

app.put("/api/fornecedores/:id", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const f = { ...req.body, id: req.params.id };
    const { rowCount } = await query(
      "UPDATE fornecedores SET dados=$1, atualizado_em=NOW() WHERE id=$2 AND empresa_id=$3",
      [f, req.params.id, eid]
    );
    rowCount === 0 ? err(res, "Não encontrado", 404) : ok(res, f);
  } catch(e) { err(res, e.message); }
});

app.delete("/api/fornecedores/:id", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    await query("DELETE FROM fornecedores WHERE id=$1 AND empresa_id=$2", [req.params.id, eid]);
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

// ══════════════════════════════════════════════════════════════
// MATERIAIS
// ══════════════════════════════════════════════════════════════
app.get("/api/materiais", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const { rows } = await query(
      "SELECT dados FROM materiais WHERE empresa_id = $1 ORDER BY criado_em ASC",
      [eid]
    );
    ok(res, rows.map(r => r.dados));
  } catch(e) { err(res, e.message); }
});

app.post("/api/materiais", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const m = req.body;
    if (!m.id) return err(res, "id é obrigatório");
    await query(
      `INSERT INTO materiais (id, empresa_id, dados) VALUES ($1, $2, $3)
       ON CONFLICT(id) DO UPDATE SET dados=$3, atualizado_em=NOW()
       WHERE materiais.empresa_id = $2`,
      [m.id, eid, m]
    );
    ok(res, m);
  } catch(e) { err(res, e.message); }
});

app.delete("/api/materiais/:id", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    await query("DELETE FROM materiais WHERE id=$1 AND empresa_id=$2", [req.params.id, eid]);
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

// ══════════════════════════════════════════════════════════════
// OBRAS
// ══════════════════════════════════════════════════════════════
app.get("/api/obras", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const { rows } = await query(
      "SELECT dados FROM obras WHERE empresa_id = $1 ORDER BY criado_em ASC",
      [eid]
    );
    ok(res, rows.map(r => r.dados));
  } catch(e) { err(res, e.message); }
});

app.post("/api/obras", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const o = req.body;
    if (!o.id) return err(res, "id é obrigatório");
    await query(
      `INSERT INTO obras (id, empresa_id, dados) VALUES ($1, $2, $3)
       ON CONFLICT(id) DO UPDATE SET dados=$3, atualizado_em=NOW()
       WHERE obras.empresa_id = $2`,
      [o.id, eid, o]
    );
    ok(res, o);
  } catch(e) { err(res, e.message); }
});

app.delete("/api/obras/:id", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    await query("DELETE FROM obras WHERE id=$1 AND empresa_id=$2", [req.params.id, eid]);
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

// ══════════════════════════════════════════════════════════════
// LANÇAMENTOS
// ══════════════════════════════════════════════════════════════
app.get("/api/lancamentos", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const { rows } = await query(
      "SELECT dados FROM lancamentos WHERE empresa_id = $1 ORDER BY criado_em ASC",
      [eid]
    );
    ok(res, rows.map(r => r.dados));
  } catch(e) { err(res, e.message); }
});

app.post("/api/lancamentos", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const l = req.body;
    if (!l.id) return err(res, "id é obrigatório");
    await query(
      `INSERT INTO lancamentos (id, empresa_id, dados) VALUES ($1, $2, $3)
       ON CONFLICT(id) DO UPDATE SET dados=$3, atualizado_em=NOW()
       WHERE lancamentos.empresa_id = $2`,
      [l.id, eid, l]
    );
    ok(res, l);
  } catch(e) { err(res, e.message); }
});

app.delete("/api/lancamentos/:id", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    await query("DELETE FROM lancamentos WHERE id=$1 AND empresa_id=$2", [req.params.id, eid]);
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

// ══════════════════════════════════════════════════════════════
// ORÇAMENTOS
// ══════════════════════════════════════════════════════════════
app.get("/api/orcamentos", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const { clienteId } = req.query;
    const { rows } = clienteId
      ? await query(
          "SELECT dados FROM orcamentos_projeto WHERE cliente_id=$1 AND empresa_id=$2 ORDER BY criado_em ASC",
          [clienteId, eid]
        )
      : await query(
          "SELECT dados FROM orcamentos_projeto WHERE empresa_id=$1 ORDER BY criado_em ASC",
          [eid]
        );
    ok(res, rows.map(r => r.dados));
  } catch(e) { err(res, e.message); }
});

app.get("/api/orcamentos/:id", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const { rows } = await query(
      "SELECT dados FROM orcamentos_projeto WHERE id=$1 AND empresa_id=$2",
      [req.params.id, eid]
    );
    rows[0] ? ok(res, rows[0].dados) : err(res, "Não encontrado", 404);
  } catch(e) { err(res, e.message); }
});

app.post("/api/orcamentos", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const o = req.body;
    if (!o.id) return err(res, "id é obrigatório");
    await query(
      `INSERT INTO orcamentos_projeto (id, empresa_id, cliente_id, dados) VALUES ($1, $2, $3, $4)
       ON CONFLICT(id) DO UPDATE SET dados=$4, cliente_id=$3, atualizado_em=NOW()
       WHERE orcamentos_projeto.empresa_id = $2`,
      [o.id, eid, o.clienteId || null, o]
    );
    ok(res, o);
  } catch(e) { err(res, e.message); }
});

app.put("/api/orcamentos/:id", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const o = { ...req.body, id: req.params.id };
    const { rowCount } = await query(
      "UPDATE orcamentos_projeto SET dados=$1, cliente_id=$2, atualizado_em=NOW() WHERE id=$3 AND empresa_id=$4",
      [o, o.clienteId || null, req.params.id, eid]
    );
    rowCount === 0 ? err(res, "Não encontrado", 404) : ok(res, o);
  } catch(e) { err(res, e.message); }
});

app.delete("/api/orcamentos/:id", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    await query("DELETE FROM orcamentos_projeto WHERE id=$1 AND empresa_id=$2", [req.params.id, eid]);
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

// ══════════════════════════════════════════════════════════════
// RECEITAS
// ══════════════════════════════════════════════════════════════
app.get("/api/receitas", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const { orcId, clienteId } = req.query;
    const { rows } = orcId
      ? await query(
          "SELECT dados FROM receitas_financeiro WHERE orc_id=$1 AND empresa_id=$2 ORDER BY criado_em ASC",
          [orcId, eid]
        )
      : clienteId
        ? await query(
            "SELECT dados FROM receitas_financeiro WHERE cliente_id=$1 AND empresa_id=$2 ORDER BY criado_em ASC",
            [clienteId, eid]
          )
        : await query(
            "SELECT dados FROM receitas_financeiro WHERE empresa_id=$1 ORDER BY criado_em ASC",
            [eid]
          );
    ok(res, rows.map(r => r.dados));
  } catch(e) { err(res, e.message); }
});

app.post("/api/receitas", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const r = req.body;
    if (!r.id) return err(res, "id é obrigatório");
    await query(
      `INSERT INTO receitas_financeiro (id, empresa_id, orc_id, cliente_id, dados) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(id) DO UPDATE SET dados=$5, atualizado_em=NOW()
       WHERE receitas_financeiro.empresa_id = $2`,
      [r.id, eid, r.orcId || null, r.clienteId || null, r]
    );
    ok(res, r);
  } catch(e) { err(res, e.message); }
});

app.post("/api/receitas/batch", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const { receitas } = req.body;
    if (!Array.isArray(receitas)) return err(res, "receitas deve ser um array");
    for (const r of receitas) {
      if (!r.id) continue;
      await query(
        `INSERT INTO receitas_financeiro (id, empresa_id, orc_id, cliente_id, dados) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT(id) DO UPDATE SET dados=$5, atualizado_em=NOW()
         WHERE receitas_financeiro.empresa_id = $2`,
        [r.id, eid, r.orcId || null, r.clienteId || null, r]
      );
    }
    ok(res, receitas);
  } catch(e) { err(res, e.message); }
});

app.delete("/api/receitas/:id", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    await query(
      "DELETE FROM receitas_financeiro WHERE id=$1 AND empresa_id=$2",
      [req.params.id, eid]
    );
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

app.delete("/api/receitas/por-orcamento/:orcId", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const { rowCount } = await query(
      "DELETE FROM receitas_financeiro WHERE orc_id=$1 AND empresa_id=$2",
      [req.params.orcId, eid]
    );
    ok(res, { deleted: rowCount });
  } catch(e) { err(res, e.message); }
});

// ══════════════════════════════════════════════════════════════
// ESCRITÓRIO — por empresa (inclui logo no mesmo endpoint)
// ══════════════════════════════════════════════════════════════
app.get("/api/escritorio", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const { rows } = await query(
      "SELECT dados, logo FROM escritorio WHERE empresa_id=$1",
      [eid]
    );
    if (!rows[0]) {
      // Cria linha vazia se não existir (primeiro acesso)
      await query(
        "INSERT INTO escritorio (empresa_id, dados) VALUES ($1, '{}'::jsonb) ON CONFLICT DO NOTHING",
        [eid]
      );
      return ok(res, { ...{}, logo: null });
    }
    // Retorna merge de dados + logo pra manter API compatível com o frontend
    ok(res, { ...rows[0].dados, logo: rows[0].logo || null });
  } catch(e) { err(res, e.message); }
});

app.put("/api/escritorio", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    // Separa logo dos outros dados. Logo vai pra coluna dedicada;
    // o resto vai pro JSONB. Isso evita carregar logo gigante sempre
    // que só precisa dos dados textuais (futuro endpoint /api/escritorio/meta).
    //
    // logo = null (remoção explícita) → grava null no banco.
    // logo = undefined (campo não enviado) → também grava null aqui, mas o
    // frontend SEMPRE envia o campo logo no save (mesmo que null), então
    // não há perda silenciosa. Se algum dia houver endpoint de save parcial,
    // usar PATCH com COALESCE seletivo, não esse PUT.
    const { logo, ...dados } = req.body || {};
    const logoFinal = logo !== undefined ? logo : null;
    await query(
      `INSERT INTO escritorio (empresa_id, dados, logo) VALUES ($1, $2, $3)
       ON CONFLICT(empresa_id) DO UPDATE SET dados=$2, logo=$3, atualizado_em=NOW()`,
      [eid, dados, logoFinal]
    );
    ok(res, { ...dados, logo: logoFinal });
  } catch(e) { err(res, e.message); }
});

// ══════════════════════════════════════════════════════════════
// LOGO — endpoint dedicado (compat com api.logo.save do frontend)
// ══════════════════════════════════════════════════════════════
app.get("/api/logo", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const { rows } = await query(
      "SELECT logo FROM escritorio WHERE empresa_id=$1",
      [eid]
    );
    ok(res, rows[0]?.logo || null);
  } catch(e) { err(res, e.message); }
});

app.put("/api/logo", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const { data } = req.body;
    if (data === undefined) return err(res, "data é obrigatório (base64 ou null para remover)");
    await query(
      `INSERT INTO escritorio (empresa_id, logo) VALUES ($1, $2)
       ON CONFLICT(empresa_id) DO UPDATE SET logo=$2, atualizado_em=NOW()`,
      [eid, data]
    );
    ok(res, { saved: true });
  } catch(e) { err(res, e.message); }
});

// ══════════════════════════════════════════════════════════════
// CONFIG GERAL (chave-valor, escopo global mas protegido por admin)
// ══════════════════════════════════════════════════════════════
// NOTA: config_geral ainda é global (não tem empresa_id). Usado
// apenas pra configs que realmente devem ser compartilhadas entre
// todas as empresas (ex: feature flags do SaaS). Se no futuro
// precisar de config por-empresa, migrar pra nova tabela.
app.get("/api/config/:chave", async (req, res) => {
  try {
    const { rows } = await query("SELECT dados FROM config_geral WHERE chave=$1", [req.params.chave]);
    ok(res, rows[0]?.dados || null);
  } catch(e) { err(res, e.message); }
});

app.put("/api/config/:chave", async (req, res) => {
  try {
    const dados = req.body;
    await query(
      `INSERT INTO config_geral (chave,dados) VALUES ($1,$2)
       ON CONFLICT(chave) DO UPDATE SET dados=$2, atualizado_em=NOW()`,
      [req.params.chave, dados]
    );
    ok(res, dados);
  } catch(e) { err(res, e.message); }
});

// ══════════════════════════════════════════════════════════════
// BACKUP — exporta/importa dados da empresa logada
// ══════════════════════════════════════════════════════════════
app.get("/api/backup", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const [cl, fo, ma, ob, la, orc, rec, esc] = await Promise.all([
      query("SELECT dados FROM clientes WHERE empresa_id=$1", [eid]),
      query("SELECT dados FROM fornecedores WHERE empresa_id=$1", [eid]),
      query("SELECT dados FROM materiais WHERE empresa_id=$1", [eid]),
      query("SELECT dados FROM obras WHERE empresa_id=$1", [eid]),
      query("SELECT dados FROM lancamentos WHERE empresa_id=$1", [eid]),
      query("SELECT dados FROM orcamentos_projeto WHERE empresa_id=$1", [eid]),
      query("SELECT dados FROM receitas_financeiro WHERE empresa_id=$1", [eid]),
      query("SELECT dados, logo FROM escritorio WHERE empresa_id=$1", [eid]),
    ]);
    const backup = {
      clientes:           cl.rows.map(r => r.dados),
      fornecedores:       fo.rows.map(r => r.dados),
      materiais:          ma.rows.map(r => r.dados),
      obras:              ob.rows.map(r => r.dados),
      lancamentos:        la.rows.map(r => r.dados),
      orcamentosProjeto:  orc.rows.map(r => r.dados),
      receitasFinanceiro: rec.rows.map(r => r.dados),
      escritorio:         esc.rows[0] ? { ...esc.rows[0].dados, logo: esc.rows[0].logo || null } : {},
      empresa_id:         eid,
      exportadoEm:        now(),
    };
    res.setHeader("Content-Disposition", `attachment; filename="vicke-backup-${new Date().toISOString().slice(0,10)}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.json(backup);
  } catch(e) { err(res, e.message); }
});

app.post("/api/backup/importar", async (req, res) => {
  try {
    const eid = empresaId(req, res); if (!eid) return;
    const dados = req.body;

    // Importa forçando empresa_id da empresa logada, ignorando qualquer
    // empresa_id que estivesse no arquivo original. Isso evita que um
    // backup da empresa A seja importado na empresa B vazando dados.
    for (const c of (dados.clientes || [])) {
      if (!c.id) continue;
      await query(
        `INSERT INTO clientes (id, empresa_id, dados) VALUES ($1, $2, $3)
         ON CONFLICT(id) DO UPDATE SET dados=$3 WHERE clientes.empresa_id = $2`,
        [c.id, eid, c]
      );
    }
    for (const f of (dados.fornecedores || [])) {
      if (!f.id) continue;
      await query(
        `INSERT INTO fornecedores (id, empresa_id, dados) VALUES ($1, $2, $3)
         ON CONFLICT(id) DO UPDATE SET dados=$3 WHERE fornecedores.empresa_id = $2`,
        [f.id, eid, f]
      );
    }
    for (const m of (dados.materiais || [])) {
      if (!m.id) continue;
      await query(
        `INSERT INTO materiais (id, empresa_id, dados) VALUES ($1, $2, $3)
         ON CONFLICT(id) DO UPDATE SET dados=$3 WHERE materiais.empresa_id = $2`,
        [m.id, eid, m]
      );
    }
    for (const o of (dados.obras || [])) {
      if (!o.id) continue;
      await query(
        `INSERT INTO obras (id, empresa_id, dados) VALUES ($1, $2, $3)
         ON CONFLICT(id) DO UPDATE SET dados=$3 WHERE obras.empresa_id = $2`,
        [o.id, eid, o]
      );
    }
    for (const l of (dados.lancamentos || [])) {
      if (!l.id) continue;
      await query(
        `INSERT INTO lancamentos (id, empresa_id, dados) VALUES ($1, $2, $3)
         ON CONFLICT(id) DO UPDATE SET dados=$3 WHERE lancamentos.empresa_id = $2`,
        [l.id, eid, l]
      );
    }
    for (const o of (dados.orcamentosProjeto || [])) {
      if (!o.id) continue;
      await query(
        `INSERT INTO orcamentos_projeto (id, empresa_id, cliente_id, dados) VALUES ($1, $2, $3, $4)
         ON CONFLICT(id) DO UPDATE SET dados=$4, cliente_id=$3 WHERE orcamentos_projeto.empresa_id = $2`,
        [o.id, eid, o.clienteId || null, o]
      );
    }
    for (const r of (dados.receitasFinanceiro || [])) {
      if (!r.id) continue;
      await query(
        `INSERT INTO receitas_financeiro (id, empresa_id, orc_id, cliente_id, dados) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT(id) DO UPDATE SET dados=$5 WHERE receitas_financeiro.empresa_id = $2`,
        [r.id, eid, r.orcId || null, r.clienteId || null, r]
      );
    }
    if (dados.escritorio) {
      const { logo, ...escDados } = dados.escritorio;
      await query(
        `INSERT INTO escritorio (empresa_id, dados, logo) VALUES ($1, $2, $3)
         ON CONFLICT(empresa_id) DO UPDATE SET dados=$2, logo=COALESCE($3, escritorio.logo), atualizado_em=NOW()`,
        [eid, escDados, logo || null]
      );
    }
    ok(res, { importado: true });
  } catch(e) { err(res, e.message); }
});

// ══════════════════════════════════════════════════════════════
// HEALTH (sem auth — Railway healthcheck)
// ══════════════════════════════════════════════════════════════
app.get("/api/health", (req, res) => {
  res.json({ ok: true, version: "2.1.0", db: "postgresql", timestamp: now() });
});

// ── SPA fallback ───────────────────────────────────────────────
if (fs.existsSync(FRONTEND_PATH)) {
  app.get("*", (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, "index.html"));
  });
}

// ══════════════════════════════════════════════════════════════
// START
// ══════════════════════════════════════════════════════════════
async function start() {
  try {
    await initDB();
    await seedMaster();

    app.listen(PORT, () => {
      console.log(`\n✓ Vicke rodando em http://localhost:${PORT}`);
      console.log(`  Banco: PostgreSQL`);
      console.log(`  Ambiente: ${IS_PROD ? "produção" : "desenvolvimento"}`);
      console.log(`  Pressione Ctrl+C para parar\n`);
    });

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
    }
  } catch(e) {
    console.error("Erro ao iniciar:", e);
    process.exit(1);
  }
}

start();

// ── Tratamento global de exceções ──────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

process.on("SIGINT",  () => { pool.end(); process.exit(0); });
process.on("SIGTERM", () => { pool.end(); process.exit(0); });
