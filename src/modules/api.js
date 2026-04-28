// v2 PostgreSQL — Sprint 2
// ═══════════════════════════════════════════════════════════════
// VICKE — API Client
// Centraliza comunicação HTTP com o backend. Todas as chamadas:
// - Enviam Authorization header automático (lê vicke-token do localStorage)
// - Tratam 401 com auto-logout (flag anti-cascata evita N reloads)
// - Retornam data desembrulhado (ou lançam Error em caso de falha)
// ═══════════════════════════════════════════════════════════════

// API_URL vem de shared.jsx (que lê VITE_API_URL ou usa fallback prod).
// Mantemos esta referência local pra não importar shared em cada chamada.
const _API_URL = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL)
  || "https://orbi-production-5f5c.up.railway.app";

// Flag pra evitar múltiplos reloads em cascata quando várias requisições
// retornam 401 ao mesmo tempo (ex: loadAllData faz 8 chamadas em paralelo)
let _sessionExpiredHandled = false;

async function req(method, path, body) {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("vicke-token") : null;
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${_API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handler global de 401: token expirado/inválido → limpa e volta pra login.
  // Não aplicamos isto a /auth/login (onde 401 significa senha errada).
  if (res.status === 401 && !path.startsWith("/auth/")) {
    if (!_sessionExpiredHandled) {
      _sessionExpiredHandled = true;
      try {
        localStorage.removeItem("vicke-token");
        localStorage.removeItem("vicke-user");
      } catch {}
      if (typeof location !== "undefined") location.reload();
    }
    throw new Error("Sessão expirada — faça login novamente");
  }

  const json = await res.json();
  if (!json.ok) {
    // Anexa status e tipo no Error pra que componentes possam distinguir
    // "sem permissão" (403) de outros erros e mostrar mensagem específica.
    // Ex: PainelEmpresas mostra "você não é master" em vez de erro genérico.
    const erro = new Error(json.error || "Erro na API");
    erro.status = res.status;
    erro.code   = res.status === 403 ? "FORBIDDEN" : "API_ERROR";
    throw erro;
  }
  return json.data;
}

const get  = (path)        => req("GET",    path);
const post = (path, body)  => req("POST",   path, body);
const put  = (path, body)  => req("PUT",    path, body);
const del  = (path)        => req("DELETE", path);

// ── API pública ────────────────────────────────────────────────
const api = {
  clientes: {
    list:   ()       => get("/api/clientes"),
    get:    (id)     => get(`/api/clientes/${id}`),
    save:   (c)      => post("/api/clientes", c),
    update: (id, c)  => put(`/api/clientes/${id}`, c),
    delete: (id)     => del(`/api/clientes/${id}`),
  },

  fornecedores: {
    list:   ()       => get("/api/fornecedores"),
    save:   (f)      => post("/api/fornecedores", f),
    update: (id, f)  => put(`/api/fornecedores/${id}`, f),
    delete: (id)     => del(`/api/fornecedores/${id}`),
  },

  materiais: {
    list:   ()       => get("/api/materiais"),
    save:   (m)      => post("/api/materiais", m),
    delete: (id)     => del(`/api/materiais/${id}`),
  },

  obras: {
    list:   ()       => get("/api/obras"),
    save:   (o)      => post("/api/obras", o),
    delete: (id)     => del(`/api/obras/${id}`),
  },

  lancamentos: {
    list:   ()       => get("/api/lancamentos"),
    save:   (l)      => post("/api/lancamentos", l),
    delete: (id)     => del(`/api/lancamentos/${id}`),
  },

  orcamentos: {
    list:       (clienteId) => get(`/api/orcamentos${clienteId ? `?clienteId=${clienteId}` : ""}`),
    save:       (o)         => post("/api/orcamentos", o),
    update:     (id, o)     => put(`/api/orcamentos/${id}`, o),
    delete:     (id)        => del(`/api/orcamentos/${id}`),
  },

  receitas: {
    list:           (filtros)    => get(`/api/receitas${filtros ? `?${new URLSearchParams(filtros)}` : ""}`),
    save:           (r)          => post("/api/receitas", r),
    batch:          (receitas)   => post("/api/receitas/batch", { receitas }),
    delete:         (id)         => del(`/api/receitas/${id}`),
    deleteByOrc:    (orcId)      => del(`/api/receitas/por-orcamento/${orcId}`),
  },

  // Escritório agora inclui logo no mesmo payload (get/save atômicos).
  // O backend separa internamente: logo vai pra coluna dedicada, resto
  // pro JSONB. Pro frontend, é um objeto só.
  escritorio: {
    get:    ()  => get("/api/escritorio"),
    save:   (e) => put("/api/escritorio", e),
  },

  // Logo continua disponível via endpoint dedicado (compat), mas
  // a rota /api/escritorio também retorna logo junto — preferir ela
  // nos fluxos de boot/carregamento pra evitar request extra.
  logo: {
    get:    ()     => get("/api/logo"),
    save:   (data) => put("/api/logo", { data }),
    clear:  ()     => put("/api/logo", { data: null }),
  },

  config: {
    get:  (chave)        => get(`/api/config/${chave}`),
    save: (chave, dados) => put(`/api/config/${chave}`, dados),
  },

  // ── ADMIN (só master) ──────────────────────────────────────
  admin: {
    empresas: {
      list:   ()           => get("/admin/empresas"),
      get:    (id)         => get(`/admin/empresas/${id}`),
      save:   (e)          => post("/admin/empresas", e),
      update: (id, e)      => put(`/admin/empresas/${id}`, e),
      delete: (id)         => del(`/admin/empresas/${id}`),
    },
    usuarios: {
      list:       ()           => get("/admin/usuarios"),
      save:       (u)          => post("/admin/usuarios", u),
      update:     (id, u)      => put(`/admin/usuarios/${id}`, u),
      delete:     (id)         => del(`/admin/usuarios/${id}`),
      // Reset administrativo: gera senha aleatória, retorna em texto puro.
      // Master pode resetar qualquer usuário (qualquer empresa). Backend
      // bloqueia self-reset (use /auth/trocar-senha pra trocar a própria).
      resetSenha: (id)         => post(`/admin/usuarios/${id}/reset-senha`),
    },
    mensagens: {
      // Caixa de email do Master (Sprint 3 Bloco E).
      // ?filtro=nao-lidas filtra só não lidas; sem param retorna todas.
      list:        (filtro) => get(`/admin/mensagens${filtro ? `?filtro=${filtro}` : ""}`),
      get:         (id)     => get(`/admin/mensagens/${id}`),
      marcarLida:  (id)     => put(`/admin/mensagens/${id}/lida`, {}),
      marcarNaoLida:(id)    => put(`/admin/mensagens/${id}/nao-lida`, {}),
      delete:      (id)     => del(`/admin/mensagens/${id}`),
      responder:   (id, dados) => post(`/admin/mensagens/${id}/responder`, dados),
    },
    manutencao: ()         => post("/admin/manutencao"),
    dashboard:  ()         => get("/admin/dashboard"),

    // Caixa de feedback in-app — listagem master com filtros, controle de status.
    // Diferente de admin.mensagens (que é caixa de email externo via Resend webhook).
    feedback: {
      list: (filtros = {}) => {
        const qs = new URLSearchParams();
        if (filtros.categoria) qs.set("categoria", filtros.categoria);
        if (filtros.status)    qs.set("status", filtros.status);
        if (filtros.busca)     qs.set("busca", filtros.busca);
        const s = qs.toString();
        return get(`/admin/feedback${s ? "?" + s : ""}`);
      },
      get:    (id)        => get(`/admin/feedback/${id}`),
      update: (id, dados) => put(`/admin/feedback/${id}`, dados),
      delete: (id)        => del(`/admin/feedback/${id}`),
    },

    // CUB — Custo Unitário Básico (Sprint 1)
    cub: {
      list:      ()           => get("/api/cub"),                    // todos os valores
      listEstado:(uf)         => get(`/api/cub/${uf}`),              // valores de um estado
      atualizar: (estados)    => post("/admin/cub/atualizar", estados ? { estados } : {}),
      log:       (limit = 50) => get(`/admin/cub/log?limit=${limit}`),
      status:    ()           => get("/admin/cub/status"),
    },
  },

  // ── EMPRESA/USUÁRIOS (admin do escritório) ─────────────────
  empresa: {
    usuarios: {
      list:       ()           => get("/empresa/usuarios"),
      save:       (u)          => post("/empresa/usuarios", u),
      update:     (id, u)      => put(`/empresa/usuarios/${id}`, u),
      delete:     (id)         => del(`/empresa/usuarios/${id}`),
      // Admin de empresa só reseta colegas da própria empresa (backend valida).
      // Não pode resetar usuário master nem a si mesmo.
      resetSenha: (id)         => post(`/empresa/usuarios/${id}/reset-senha`),
    },
  },

  // ── AUTH (qualquer usuário autenticado) ────────────────────
  auth: {
    me:           ()                          => get("/auth/me"),
    // Troca da própria senha. Exige senha atual pra prevenir abuso de
    // sessão sequestrada. Zera precisa_trocar_senha se a flag estiver setada.
    trocarSenha:  (senha_atual, senha_nova)   => post("/auth/trocar-senha", { senha_atual, senha_nova }),
    // Recuperação de senha self-service (público — sem token JWT).
    // recuperar: usuário pede via email; backend manda link com token único.
    // redefinir: usuário usa o token do link pra setar senha nova.
    recuperar:    (email)                     => post("/auth/recuperar-senha", { email }),
    redefinir:    (token, senha_nova)         => post("/auth/redefinir-senha", { token, senha_nova }),
  },

  // ── FEEDBACK IN-APP (qualquer usuário autenticado) ─────────
  // Botão flutuante no app dispara aqui. Backend grava em feedback_app
  // com snapshot de quem enviou + empresa.
  feedback: {
    enviar: (categoria, texto) => post("/feedback", { categoria, texto }),
  },

  backup: {
    exportar: () => get("/api/backup"),
    importar: (dados) => post("/api/backup/importar", dados),
  },

  health: () => get("/api/health"),
};

// ── Carrega todos os dados de uma vez ──────────────────────────
// Substitui o DB.get("obramanager-v1") do sistema antigo.
// Escritório agora vem com logo embutido (um só request).
async function loadAllData() {
  const [
    clientes,
    fornecedores,
    materiais,
    obras,
    lancamentos,
    orcamentosProjeto,
    receitasFinanceiro,
    escritorio,
  ] = await Promise.all([
    api.clientes.list(),
    api.fornecedores.list(),
    api.materiais.list(),
    api.obras.list(),
    api.lancamentos.list(),
    api.orcamentos.list(),
    api.receitas.list(),
    api.escritorio.get(),
  ]);

  return {
    clientes,
    fornecedores,
    materiais,
    obras,
    lancamentos,
    orcamentosProjeto,
    receitasFinanceiro,
    // escritorio já vem com { ...dados, logo } do backend
    escritorio: escritorio || {},
  };
}

// ── Salva diffs entre newData e oldData ────────────────────────
// Calcula o que mudou e só envia os itens modificados pro backend.
// Cada módulo é independente — erro em um não afeta os outros.
async function saveAllData(newData, oldData = {}) {
  const tasks = [];

  // Clientes
  const clientesNovos = (newData.clientes || []).filter(
    c => !oldData.clientes?.find(o => o.id === c.id && JSON.stringify(o) === JSON.stringify(c))
  );
  const clientesRemovidos = (oldData.clientes || []).filter(
    o => !newData.clientes?.find(c => c.id === o.id)
  );
  clientesNovos.forEach(c => tasks.push(api.clientes.save(c)));
  clientesRemovidos.forEach(c => tasks.push(api.clientes.delete(c.id)));

  // Fornecedores
  const fornsNovos = (newData.fornecedores || []).filter(
    f => !oldData.fornecedores?.find(o => o.id === f.id && JSON.stringify(o) === JSON.stringify(f))
  );
  const fornsRemovidos = (oldData.fornecedores || []).filter(
    o => !newData.fornecedores?.find(f => f.id === o.id)
  );
  fornsNovos.forEach(f => tasks.push(api.fornecedores.save(f)));
  fornsRemovidos.forEach(f => tasks.push(api.fornecedores.delete(f.id)));

  // Orçamentos
  const orcsNovos = (newData.orcamentosProjeto || []).filter(
    o => !oldData.orcamentosProjeto?.find(a => a.id === o.id && JSON.stringify(a) === JSON.stringify(o))
  );
  const orcsRemovidos = (oldData.orcamentosProjeto || []).filter(
    a => !newData.orcamentosProjeto?.find(o => o.id === a.id)
  );
  orcsNovos.forEach(o => tasks.push(api.orcamentos.save(o)));
  orcsRemovidos.forEach(o => tasks.push(api.orcamentos.delete(o.id)));

  // Receitas
  const recNovos = (newData.receitasFinanceiro || []).filter(
    r => !oldData.receitasFinanceiro?.find(a => a.id === r.id && JSON.stringify(a) === JSON.stringify(r))
  );
  const recRemovidos = (oldData.receitasFinanceiro || []).filter(
    a => !newData.receitasFinanceiro?.find(r => r.id === a.id)
  );
  recNovos.forEach(r => tasks.push(api.receitas.save(r)));
  recRemovidos.forEach(r => tasks.push(api.receitas.delete(r.id)));

  // Obras
  const obrasNovas = (newData.obras || []).filter(
    o => !oldData.obras?.find(a => a.id === o.id && JSON.stringify(a) === JSON.stringify(o))
  );
  const obrasRemovidas = (oldData.obras || []).filter(
    a => !newData.obras?.find(o => o.id === a.id)
  );
  obrasNovas.forEach(o => tasks.push(api.obras.save(o)));
  obrasRemovidas.forEach(o => tasks.push(api.obras.delete(o.id)));

  // Lançamentos
  const lancsNovos = (newData.lancamentos || []).filter(
    l => !oldData.lancamentos?.find(a => a.id === l.id && JSON.stringify(a) === JSON.stringify(l))
  );
  const lancsRemovidos = (oldData.lancamentos || []).filter(
    a => !newData.lancamentos?.find(l => l.id === a.id)
  );
  lancsNovos.forEach(l => tasks.push(api.lancamentos.save(l)));
  lancsRemovidos.forEach(l => tasks.push(api.lancamentos.delete(l.id)));

  // Escritório (inclui logo agregado no mesmo objeto)
  if (newData.escritorio && JSON.stringify(newData.escritorio) !== JSON.stringify(oldData.escritorio)) {
    tasks.push(api.escritorio.save(newData.escritorio));
  }

  await Promise.all(tasks);
}
