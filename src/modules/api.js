// ═══════════════════════════════════════════════════════════════
// ORBI — API Client
// Substitui o DB (localStorage/window.storage) pelo backend real
// ═══════════════════════════════════════════════════════════════

const API_URL = typeof window !== "undefined" && window.location.hostname !== "localhost"
  ? "https://orbi-production-0c32.up.railway.app"
  : "http://localhost:3000";

async function req(method, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Erro na API");
  return json.data;
}

const get  = (path)        => req("GET",    path);
const post = (path, body)  => req("POST",   path, body);
const put  = (path, body)  => req("PUT",    path, body);
const del  = (path)        => req("DELETE", path);

// ── Clientes ───────────────────────────────────────────────────
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

  escritorio: {
    get:    ()  => get("/api/escritorio"),
    save:   (e) => put("/api/escritorio", e),
  },

  logo: {
    get:  ()      => get("/api/logo"),
    save: (data)  => put("/api/logo", { data }),
  },

  config: {
    get:  (chave)        => get(`/api/config/${chave}`),
    save: (chave, dados) => put(`/api/config/${chave}`, dados),
  },

  backup: {
    exportar: () => get("/api/backup"),
    importar: (dados) => post("/api/backup/importar", dados),
  },

  health: () => get("/api/health"),
};

// ── Carrega todos os dados de uma vez (compatível com o data object atual) ──
// Substitui o DB.get("obramanager-v1")
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
    escritorio: escritorio || {},
  };
}

// ── Salva todos os dados (compatível com o save(newData) atual) ──
// Substitui o DB.set("obramanager-v1", newData)
// Por enquanto faz um diff simples — no futuro cada módulo salva individualmente
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

  // Escritório
  if (newData.escritorio && JSON.stringify(newData.escritorio) !== JSON.stringify(oldData.escritorio)) {
    tasks.push(api.escritorio.save(newData.escritorio));
  }

  await Promise.all(tasks);
}


