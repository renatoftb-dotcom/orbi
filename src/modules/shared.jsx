import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
// API URL — lê de VITE_API_URL com fallback pra produção
// ═══════════════════════════════════════════════════════════════
// Em dev local, criar .env.local com: VITE_API_URL=http://localhost:3000
// Em produção (Vercel), a variável já está setada como a URL do Railway.
// Fallback garante que mesmo sem env o app aponta pro Railway ativo.
const API_URL = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL)
  || "https://orbi-production-5f5c.up.railway.app";

// ═══════════════════════════════════════════════════════════════
// AUTH — decodificação de JWT e permissões (ANTES duplicado 3x)
// ═══════════════════════════════════════════════════════════════
// JWT usa base64url (não base64 padrão). A conversão abaixo normaliza.
// Retorna o payload decodado ou null se inválido/corrompido.
function decodeJWT(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const partes = token.split(".");
    if (partes.length !== 3) return null;
    const b64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - b64.length % 4) % 4);
    return JSON.parse(atob(padded));
  } catch { return null; }
}

// Checa se o token está expirado. Retorna true se exp < agora.
// Se não tiver campo exp, considera não-expirado (compat tokens antigos).
function isTokenExpirado(payload) {
  if (!payload || !payload.exp) return false;
  return payload.exp * 1000 < Date.now();
}

// Usuário atualmente logado. Fonte: localStorage('vicke-token').
// Retorna o payload do JWT ou null se não logado/inválido/expirado.
function getUsuarioAtual() {
  if (typeof localStorage === "undefined") return null;
  const token = localStorage.getItem("vicke-token");
  const payload = decodeJWT(token);
  if (!payload || isTokenExpirado(payload)) return null;
  return payload;
}

// Nível efetivo do usuário.
// - Master: sempre admin (tem tudo)
// - Usuário sem token: visualizador (mas app já redireciona pra login antes)
// - Token sem campo `nivel`: admin (retrocompat com tokens antigos)
function getNivelUsuario() {
  const u = getUsuarioAtual();
  if (!u) return "visualizador";
  if (u.perfil === "master") return "admin";
  return u.nivel || "admin";
}

// Flags de permissão de ação — base para esconder/desabilitar botões.
// Backend valida novamente (defesa em profundidade), mas o frontend já
// reflete as mesmas regras pra UX consistente.
function getPermissoes() {
  const u = getUsuarioAtual();
  const nivel = getNivelUsuario();
  const isMaster = u?.perfil === "master";
  const isAdmin  = nivel === "admin";
  const isEditor = nivel === "editor";
  return {
    usuario: u,
    nivel,
    isMaster,
    isAdmin,
    isEditor,
    isVisualizador: nivel === "visualizador",
    podeEditar: isAdmin || isEditor,
    podeExcluir: isAdmin,
    podeGerenciarUsuarios: isAdmin,
    podeAlterarConfig: isAdmin,
    podeGerenciar: isAdmin, // alias legado
  };
}

// ═══════════════════════════════════════════════════════════════
// FEATURE FLAGS por empresa
// ═══════════════════════════════════════════════════════════════
// Empresas em modo dev (escritorio.dev_mode === true) ganham botões de
// reset e veem features experimentais. Padovan e qualquer empresa real
// continuam vendo só o app estável. Padrão SaaS comum (LaunchDarkly etc).
//
// dev_mode: ativa o "ambiente de desenvolvimento dentro do app" — botões
//   de reset, features beta, banner indicando o modo. Ativado manualmente
//   via SQL: UPDATE escritorio SET dados=jsonb_set(dados,'{dev_mode}','true')
//   WHERE empresa_id='<id>';
//
// features.<nome>: flags por feature (ex: onboarding_orcamento_v2).
//   Ativa só o pedaço, sem precisar do dev_mode global.
function temDevMode(escritorio) {
  return escritorio?.dev_mode === true;
}

function temFeature(escritorio, nome) {
  return escritorio?.features?.[nome] === true || temDevMode(escritorio);
}

// Helper: converte string em slug ascii-safe (lowercase, sem acentos,
// hífens em vez de espaços/símbolos). Usado nos data-tutorial-id dos
// botões dinâmicos pra o tutorial conseguir target via querySelector
// sem se preocupar com encoding de acentos/aspas.
function tutorialSlug(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ═══════════════════════════════════════════════════════════════
// BANNER MODO DEV — botões de reset visíveis só em empresas dev
// ═══════════════════════════════════════════════════════════════
// Card discreto no topo do app pra empresas com escritorio.dev_mode=true.
// Padovan e demais não veem nem o banner nem os botões. Backend re-checa.
// Cada botão tem confirmação inline (window.confirm) pra evitar reset
// acidental. Após reset, recarrega a página pra ler estado fresco.
function BannerModoDev({ escritorio }) {
  if (!temDevMode(escritorio)) return null;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function rodarReset(label, fn, perguntaConfirm) {
    if (!window.confirm(perguntaConfirm)) return;
    setBusy(true); setMsg("Resetando " + label + "…");
    try {
      await fn();
      setMsg("✓ " + label + " resetado. Recarregando…");
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      setBusy(false);
      setMsg("✗ Erro: " + (e?.message || "falha no reset"));
    }
  }

  const btn = {
    fontSize: 11.5, padding: "5px 10px", borderRadius: 6,
    border: "1px solid #d97706", background: "#fff", color: "#92400e",
    cursor: busy ? "wait" : "pointer", fontFamily: "inherit",
    opacity: busy ? 0.5 : 1, whiteSpace: "nowrap",
  };
  const sep = { width: 1, alignSelf: "stretch", background: "#f59e0b33" };

  return (
    <div style={{
      background: "#fffbeb", borderBottom: "1px solid #fde68a",
      padding: "8px 16px", display: "flex", alignItems: "center",
      gap: 12, flexWrap: "wrap", fontSize: 12, color: "#78350f",
    }}>
      <span style={{ fontWeight: 600 }}>🧪 Modo Dev</span>
      <span style={{ color: "#a16207" }}>·</span>
      <span style={{ flex: "1 1 auto", minWidth: 100 }}>
        Empresa em desenvolvimento. Resets só afetam esta empresa.
      </span>
      <button style={btn} disabled={busy}
        onClick={() => rodarReset("orçamentos", api.dev.resetOrcamentos,
          "Apagar TODOS os orçamentos e propostas desta empresa? Clientes/projetos serão mantidos.")}>
        Resetar orçamentos
      </button>
      <span style={sep} />
      <button style={btn} disabled={busy}
        onClick={() => rodarReset("onboarding empresa", api.dev.resetOnboardingEmpresa,
          "Apagar dados do escritório (nome, logo, responsáveis, PIX) e marcar onboarding inicial como pendente?")}>
        Resetar onboarding empresa
      </button>
      <span style={sep} />
      <button style={btn} disabled={busy}
        onClick={() => rodarReset("onboarding orçamento", api.dev.resetOnboardingOrcamento,
          "Apagar a flag de onboarding de orçamento concluído (pra refazer o tutorial)?")}>
        Resetar onboarding orçamento
      </button>
      <span style={sep} />
      <button
        style={{ ...btn, borderColor: "#dc2626", color: "#991b1b" }}
        disabled={busy}
        onClick={() => rodarReset("tudo", api.dev.resetTudo,
          "ATENÇÃO: apagar TUDO (clientes, fornecedores, materiais, obras, lançamentos, orçamentos, receitas) desta empresa? Empresa, usuários e escritório (com dev_mode) ficam intactos.")}>
        Resetar tudo
      </button>
      {msg && (
        <span style={{ marginLeft: 8, fontSize: 11.5, color: "#78350f" }}>{msg}</span>
      )}
    </div>
  );
}

// CalloutsRenderer — auxiliar do TutorialOverlay tipo "callouts".
// Mede múltiplos elementos via data-tutorial-id, renderiza círculo pulsante
// em cada e mostra texto único ACIMA do conjunto. Pode ter acaoAoIniciar
// (ex: desligar/ligar toggles em sincronia com a aparição da orientação).
function CalloutsRenderer({ ids, titulo, descricao, acaoAoIniciar, posicao = "left" }) {
  const [rects, setRects] = useState([]);
  const textRef = useRef(null);
  const [textBox, setTextBox] = useState({ w: 280, h: 60 });
  useEffect(() => {
    if (textRef.current) {
      const r = textRef.current.getBoundingClientRect();
      if (r.width > 0) setTextBox({ w: r.width, h: r.height });
    }
  }, [titulo, descricao, rects.length]);
  useEffect(() => {
    let cancelado = false;
    let tentativas = 0;
    function medir() {
      if (cancelado) return;
      const novos = ids.map(id => {
        const el = document.querySelector(`[data-tutorial-id="${id}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, left: r.left, width: r.width, height: r.height };
      }).filter(Boolean);
      if (novos.length === ids.length) setRects(novos);
      else if (tentativas < 8) { tentativas++; setTimeout(medir, 200); }
    }
    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      cancelado = true;
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [ids.join("|")]);

  // Executa ação ao montar (ex: desliga/liga toggles)
  useEffect(() => {
    if (typeof acaoAoIniciar !== "function") return;
    let cancelado = false;
    Promise.resolve(acaoAoIniciar(() => cancelado)).catch(e =>
      console.warn("[tutorial-callouts] acaoAoIniciar falhou:", e)
    );
    return () => { cancelado = true; };
  }, []);

  // Layout: UM ÚNICO spotlight envolvendo TODO o conjunto de elementos
  // (com padding generoso pra textos longos não vazarem) + backdrop
  // escurecido + balão único. Brilho intenso (mesma animação do
  // comSpotlight do cursorOnly). Posicionamento depende de `posicao`.
  const TEXT_MAX_W = 280;
  const GAP = 28;
  const PAD_X = 14, PAD_Y = 10; // padding em volta do conjunto
  let balaoLeft = 16, balaoTop = 16, balaoRight = 0, balaoCY = 0, balaoCX = 0;
  let conjuntoCenterX = 0, conjuntoMinTop = 0;
  // Bounds do spotlight único
  let spotL = 0, spotT = 0, spotW = 0, spotH = 0;
  if (rects.length > 0) {
    const minLeft = Math.min(...rects.map(r => r.left));
    const minTop = Math.min(...rects.map(r => r.top));
    const maxRight = Math.max(...rects.map(r => r.left + r.width));
    const maxBottom = Math.max(...rects.map(r => r.top + r.height));
    conjuntoCenterX = (minLeft + maxRight) / 2;
    conjuntoMinTop = minTop - PAD_Y;
    spotL = minLeft - PAD_X;
    spotT = minTop - PAD_Y;
    spotW = (maxRight - minLeft) + PAD_X * 2;
    spotH = (maxBottom - minTop) + PAD_Y * 2;
    if (posicao === "top") {
      balaoLeft = Math.max(16, conjuntoCenterX - textBox.w / 2);
      balaoTop = Math.max(16, conjuntoMinTop - textBox.h - 18);
    } else {
      const conjuntoCY = (minTop + maxBottom) / 2;
      balaoLeft = Math.max(16, spotL - textBox.w - GAP);
      balaoTop = Math.max(16, conjuntoCY - textBox.h / 2);
    }
    balaoRight = balaoLeft + textBox.w;
    balaoCY = balaoTop + textBox.h / 2;
    balaoCX = balaoLeft + textBox.w / 2;
  }

  return (
    <>
      {/* Backdrop escurecido — destaca o spotlight (mesmo padrão cursorOnly) */}
      {rects.length > 0 && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(15, 23, 42, 0.55)",
          zIndex: 1000, pointerEvents: "none",
        }} />
      )}

      {/* UM spotlight único envolvendo todo o conjunto, com brilho forte */}
      {rects.length > 0 && (
        <div className="vk-tut-spot-co" style={{
          position: "fixed",
          top: spotT, left: spotL,
          width: spotW, height: spotH,
          border: "3px solid #f59e0b", borderRadius: 12,
          zIndex: 1001, pointerEvents: "none",
        }} />
      )}

      {/* Seta CSS triangular única apontando pra baixo (modo "top") */}
      {(titulo || descricao) && rects.length > 0 && posicao === "top" && (
        <div className="vk-tut-arrow" style={{
          position: "fixed", zIndex: 1002, pointerEvents: "none",
          top: conjuntoMinTop - 20, left: conjuntoCenterX - 14,
          borderLeft: "14px solid transparent",
          borderRight: "14px solid transparent",
          borderTop: "16px solid #f59e0b",
          width: 0, height: 0,
        }} />
      )}

      {/* Setas SVG (uma por elemento) — modo "left" */}
      {(titulo || descricao) && rects.length > 0 && posicao === "left" && (
        <svg style={{
          position: "fixed", inset: 0, width: "100%", height: "100%",
          zIndex: 1002, pointerEvents: "none",
        }}>
          <defs>
            <marker id="vk-arrow-head" viewBox="0 0 10 10"
              refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
            </marker>
          </defs>
          {rects.map((r, i) => {
            const x1 = balaoRight + 2;
            const y1 = balaoCY;
            const x2 = r.left - 10;
            const y2 = r.top + r.height / 2;
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#f59e0b" strokeWidth="1.8"
                markerEnd="url(#vk-arrow-head)" />
            );
          })}
        </svg>
      )}

      {/* Balão tooltip — caixa branca com sombra */}
      {(titulo || descricao) && rects.length > 0 && (
        <div ref={textRef} className="vk-tut-tooltip" style={{
          position: "fixed",
          top: balaoTop, left: balaoLeft,
          maxWidth: TEXT_MAX_W, minWidth: 220,
          zIndex: 1003, pointerEvents: "none",
          fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif",
          textAlign: "left",
          background: "#fff", padding: "14px 18px",
          borderRadius: 10,
          boxShadow: "0 12px 32px rgba(0,0,0,0.2)",
        }}>
          {titulo && (
            <div style={{
              fontSize: 11, fontWeight: 700, color: "#92400e",
              textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4,
            }}>{titulo}</div>
          )}
          {descricao && (
            <div style={{
              fontSize: 13.5, color: "#111", lineHeight: 1.5,
            }}>{descricao}</div>
          )}
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// TUTORIAL OVERLAY — guia passo-a-passo destacando elementos da UI
// ═══════════════════════════════════════════════════════════════
// Spotlight + seta + balão descritivo apontando pra elementos com
// `data-tutorial-id="..."`. Usado pelo onboarding do orçamento (Beta)
// pra conduzir o user pela primeira vez.
//
// Props:
//   passos        — [{ targetId, titulo, descricao, posicao?, autoMs?, acao? }]
//                   targetId: valor de data-tutorial-id no DOM
//                   posicao: "top"|"bottom"|"left"|"right" (default "right")
//                   autoMs: ms até auto-avançar (default 3500ms)
//                   acao: opcional, executada DEPOIS do delay autoMs e ANTES de
//                         avançar pro próximo passo. Tipos:
//                           "click" — faz el.click() no targetId atual
//                           { tipo: "fill", valor: "X" } — preenche input
//                           function(el) — handler custom recebe o elemento
//   welcome       — { titulo, descricao } opcional. Tela inicial antes dos passos.
//   onConcluir    — callback após o último passo
//   onCancelar    — callback se o user clicar "Pular tutorial"
function TutorialOverlay({ passos, welcome, onConcluir, onCancelar }) {
  const [estagio, setEstagio] = useState(welcome ? "welcome" : "passo");
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null);
  // targetIdOverride: permite que ações em curso (ex: animação de cômodos)
  // movam o cursor pra outros elementos sem trocar de passo. Setado via
  // window.__vkTutorial.setTargetId(id). Limpado quando passo muda.
  const [targetIdOverride, setTargetIdOverride] = useState(null);
  // Esconde a UI do tutorial (spotlight/balão/cursor) ANTES de executar a
  // ação final do passo, pra evitar que a sinalização "vaze" pra próxima
  // tela enquanto o React processa a transição.
  const [ocultarUI, setOcultarUI] = useState(false);
  // Pausa: quando true, o autoMs preserva o tempo restante e ações async
  // (digitação, loop de cômodos) entram em loop de espera até despausar.
  const [pausado, setPausado] = useState(false);
  const pausadoRef = useRef(false);
  useEffect(() => { pausadoRef.current = pausado; }, [pausado]);
  const passo = passos[idx] || null;
  const targetIdAtual = targetIdOverride || passo?.targetId;

  // Expõe setter pra ações chamarem de fora durante a execução do passo.
  // proximo() avança imediatamente pro próximo passo (ou conclui se for o
  // último). esperarSeNecessario() é usado por animações async pra parar
  // quando o user pausa o tutorial.
  useEffect(() => {
    window.__vkTutorial = {
      setTargetId: (id) => setTargetIdOverride(id),
      clearTargetId: () => setTargetIdOverride(null),
      proximo: () => setIdx(i => {
        if (i < passos.length - 1) return i + 1;
        setTimeout(() => onConcluir && onConcluir(), 0);
        return i;
      }),
      // Aguarda enquanto pausado (polling 100ms). Async funcs do tutorial
      // chamam isso entre steps pra "congelar" sem state machine complexo.
      esperarSeNecessario: async () => {
        while (pausadoRef.current) {
          await new Promise(r => setTimeout(r, 100));
        }
      },
      // Sleep que respeita pausa: divide o tempo em pedaços de 100ms,
      // checa pausado entre cada pedaço. Substitui setTimeout cru.
      sleep: async (ms) => {
        const passo = 80;
        let restante = ms;
        while (restante > 0) {
          while (pausadoRef.current) await new Promise(r => setTimeout(r, 100));
          const dt = Math.min(passo, restante);
          await new Promise(r => setTimeout(r, dt));
          restante -= dt;
        }
      },
    };
    return () => { delete window.__vkTutorial; };
  }, [passos.length]);

  // Reseta override e visibilidade ao mudar de passo
  useEffect(() => { setTargetIdOverride(null); setOcultarUI(false); }, [idx]);

  // Bloqueio GLOBAL de eventos de interação — ignora eventos sintéticos
  // disparados pelo próprio tutorial (el.click() programático tem isTrusted
  // = false). Cobre clicks reais do user em qualquer lugar da app, mesmo
  // em elementos com z-index acima do bloqueador visual.
  // Eventos disparados de dentro da barra de controle são deixados passar.
  useEffect(() => {
    const dentroDoChrome = (el) => {
      while (el) {
        if (el.dataset && el.dataset.vkTutorialChrome) return true;
        el = el.parentElement;
      }
      return false;
    };
    const handler = (e) => {
      if (!e.isTrusted) return; // ações programáticas do tutorial passam
      if (dentroDoChrome(e.target)) return; // botões da barra funcionam
      e.stopPropagation();
      e.preventDefault();
      e.stopImmediatePropagation && e.stopImmediatePropagation();
    };
    const opts = { capture: true };
    const eventos = ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "touchend", "contextmenu", "keydown", "keyup"];
    eventos.forEach(ev => document.addEventListener(ev, handler, opts));
    return () => eventos.forEach(ev => document.removeEventListener(ev, handler, opts));
  }, []);

  // Mede o elemento alvo. Re-mede em scroll/resize. Tenta a cada 200ms
  // por até 1.5s pra suportar elementos que ainda estão renderizando.
  // Aceita também querySelector cru (data-comodo-btn etc) via prefixo "css:".
  useEffect(() => {
    if (estagio !== "passo" || !passo) return;
    if (!targetIdAtual) { setRect(null); return; }
    let cancelado = false;
    let tentativas = 0;
    const sel = targetIdAtual.startsWith("css:")
      ? targetIdAtual.slice(4)
      : `[data-tutorial-id="${targetIdAtual}"]`;
    function medir() {
      if (cancelado) return;
      const el = document.querySelector(sel);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        if (r.top < 0 || r.bottom > window.innerHeight) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } else if (tentativas < 8) {
        tentativas++;
        setTimeout(medir, 200);
      } else {
        setRect(null);
      }
    }
    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      cancelado = true;
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [estagio, targetIdAtual]);

  // Ação custom executada AO INICIAR o passo (em paralelo ao autoMs). Útil
  // pra animações longas que devem rodar enquanto o balão fica visível
  // (ex: sequência de cliques que preenche cômodos um por um).
  useEffect(() => {
    if (estagio !== "passo" || !passo) return;
    if (typeof passo.acaoAoIniciar !== "function") return;
    let cancelado = false;
    Promise.resolve(passo.acaoAoIniciar(() => cancelado)).catch(e =>
      console.warn("[tutorial] acaoAoIniciar falhou:", e)
    );
    return () => { cancelado = true; };
  }, [estagio, idx]);

  // Digitação animada (acao.tipo === "type"): roda em paralelo ao autoMs,
  // não no fim. Usa setter nativo + dispatch "input" pra o React reagir.
  // Cancela se o passo mudar antes de terminar.
  useEffect(() => {
    if (estagio !== "passo" || !passo) return;
    if (passo.acao?.tipo !== "type") return;
    let cancelado = false;
    let tentativas = 0;
    function digitar() {
      if (cancelado) return;
      const el = document.querySelector(`[data-tutorial-id="${passo.targetId}"]`);
      if (!el) {
        if (tentativas++ < 8) setTimeout(digitar, 200);
        return;
      }
      const valor = String(passo.acao.valor || "");
      const delay = Number(passo.acao.delayChar) || 60;
      const proto = el.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      el.focus && el.focus();
      let i = 0;
      async function passoChar() {
        while (i < valor.length) {
          if (cancelado) return;
          // Pausa o tutorial → digitação congela aqui
          while (pausadoRef.current) {
            if (cancelado) return;
            await new Promise(r => setTimeout(r, 100));
          }
          i++;
          try {
            setter.call(el, valor.slice(0, i));
            el.dispatchEvent(new Event("input", { bubbles: true }));
          } catch (e) { console.warn("[tutorial] type falhou:", e); }
          if (i < valor.length) await new Promise(r => setTimeout(r, delay));
        }
        // Dispara change ao final pra forms que escutam blur/change
        try { el.dispatchEvent(new Event("change", { bubbles: true })); } catch {}
        // Confirmação opcional via Enter (ex: form de referência)
        if (passo.acao.confirmEnter) {
          await new Promise(r => setTimeout(r, 200));
          if (cancelado) return;
          try {
            const ev = new KeyboardEvent("keydown", {
              key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true,
            });
            el.dispatchEvent(ev);
          } catch (e) { console.warn("[tutorial] confirmEnter falhou:", e); }
        }
      }
      passoChar();
    }
    digitar();
    return () => { cancelado = true; };
  }, [estagio, idx]);

  // Auto-avança após autoMs do passo atual. Sequência:
  //   1. Esconde UI do tutorial (spotlight/balão/cursor)
  //   2. Executa a ação (click, fill) — agora sem sinalização visível
  //   3. Avança pro próximo passo (ou conclui)
  // Esconder ANTES da ação evita que o spotlight da página atual "vaze"
  // pra próxima tela enquanto o React processa a mudança.
  // "type" é tratado em useEffect separado e NÃO re-executa aqui.
  // tempoRestanteRef: armazena ms restantes do passo atual. Resetado quando
  // o passo muda. Decrementa quando NÃO pausado, fica congelado quando pausado.
  const tempoRestanteRef = useRef(0);
  useEffect(() => {
    if (estagio !== "passo" || !passo) return;
    tempoRestanteRef.current = passo.autoMs || 3500;
  }, [estagio, idx]);

  useEffect(() => {
    if (estagio !== "passo" || !passo) return;
    if (pausado) return;
    // Usa o tempo restante (não o autoMs original) — preserva pausas
    const ms = tempoRestanteRef.current > 0 ? tempoRestanteRef.current : (passo.autoMs || 3500);
    const inicio = Date.now();
    const t = setTimeout(() => {
      const temAcaoFinal = passo.acao &&
        !(passo.acao && passo.acao.tipo === "type");
      // Esconde UI imediatamente se vai executar uma ação (click/fill/fn)
      if (temAcaoFinal) setOcultarUI(true);

      // Executa a ação no próximo tick pro React renderizar com UI escondida
      const exec = () => {
        if (passo.acao && passo.acao.tipo === "type") {
          // Já foi disparado no useEffect de digitação. Só avança.
        } else if (passo.acao) {
          const el = document.querySelector(`[data-tutorial-id="${passo.targetId}"]`);
          if (el) {
            try {
              if (passo.acao === "click") {
                el.click();
              } else if (typeof passo.acao === "function") {
                passo.acao(el);
              } else if (passo.acao && passo.acao.tipo === "fill") {
                const proto = el.tagName === "TEXTAREA"
                  ? window.HTMLTextAreaElement.prototype
                  : window.HTMLInputElement.prototype;
                const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
                setter.call(el, String(passo.acao.valor || ""));
                el.dispatchEvent(new Event("input", { bubbles: true }));
                el.dispatchEvent(new Event("change", { bubbles: true }));
              }
            } catch (e) {
              console.warn("[tutorial] acao falhou:", e);
            }
          }
        }
        if (idx < passos.length - 1) setIdx(idx + 1);
        else {
          // Último passo — chama onConcluir após pequeno buffer pra garantir
          // que a transição da app processou.
          setTimeout(() => onConcluir && onConcluir(), 200);
        }
      };
      // Se escondeu UI, dá 1 tick pro DOM atualizar antes de executar
      if (temAcaoFinal) setTimeout(exec, 30);
      else exec();
    }, ms);
    return () => {
      clearTimeout(t);
      // Atualiza tempo restante baseado no que passou desde o último start
      const decorrido = Date.now() - inicio;
      tempoRestanteRef.current = Math.max(0, tempoRestanteRef.current - decorrido);
    };
  }, [estagio, idx, pausado]);

  // Chrome do tutorial: overlay bloqueante de cliques + barra de controle
  // (Parar/Continuar/Pular). Renderizado em todos os estágios — usuário
  // não consegue clicar em nada da app enquanto o tutorial roda.
  // - Bloqueador (z-index 998): captura clicks da app. Tutorial usa
  //   el.click() programático que NÃO passa pelo overlay.
  // - Barra (z-index 1010): bottom-right. "Parar" vira "Continuar"
  //   quando pausado. "Pular" cancela.
  const _btnBase = {
    padding: "8px 14px", fontSize: 13, fontWeight: 500,
    borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
    border: "1px solid #d1d5db", background: "#fff", color: "#374151",
  };
  const _btnPrimary = {
    ..._btnBase,
    border: "1px solid #111", background: "#111", color: "#fff",
  };
  const chrome = (
    <>
      {/* Bloqueador: captura mouseDown + click + keydown da app inteira.
          Tutorial usa el.click() programático que NÃO passa pelo overlay. */}
      <div
        onMouseDownCapture={e => { e.stopPropagation(); e.preventDefault(); }}
        onClickCapture={e => { e.stopPropagation(); e.preventDefault(); }}
        onContextMenuCapture={e => { e.stopPropagation(); e.preventDefault(); }}
        style={{
          position: "fixed", inset: 0, background: "transparent",
          zIndex: 998, cursor: "default",
        }} />
      <div data-vk-tutorial-chrome="true" style={{
        position: "fixed", bottom: 16, right: 16,
        display: "flex", gap: 8, zIndex: 1010,
        background: "rgba(255,255,255,0.95)",
        padding: "8px 10px", borderRadius: 10,
        border: "1px solid #e5e7eb",
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif",
      }}>
        {pausado ? (
          <button style={_btnPrimary} onClick={() => setPausado(false)}>▶ Continuar</button>
        ) : (
          <button style={_btnBase} onClick={() => setPausado(true)}>⏸ Parar</button>
        )}
        <button style={_btnBase} onClick={() => onCancelar && onCancelar()}>✕ Pular</button>
      </div>
    </>
  );

  // Welcome: modal central de boas-vindas
  if (estagio === "welcome" && welcome) {
    return (
      <>
        {/* Backdrop SEM onClick — usuário só fecha via botões do modal */}
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
        }} />
        <div data-vk-tutorial-chrome="true" style={{
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          background: "#fff", borderRadius: 14,
          padding: "32px 36px", maxWidth: 440, width: "calc(100% - 48px)",
          zIndex: 1001, boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
          fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif",
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🧪</div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "#111", margin: "0 0 10px", letterSpacing: -0.3 }}>
            {welcome.titulo}
          </h2>
          <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, margin: "0 0 24px" }}>
            {welcome.descricao}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onCancelar} style={{
              background: "transparent", color: "#6b7280",
              border: "1px solid #e5e7eb", borderRadius: 8,
              padding: "9px 16px", fontSize: 13, fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit",
            }}>Cancelar</button>
            <button onClick={() => setEstagio("passo")} style={{
              background: "#111", color: "#fff",
              border: "1px solid #111", borderRadius: 8,
              padding: "9px 18px", fontSize: 13, fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit",
            }}>Começar →</button>
          </div>
        </div>
      </>
    );
  }

  // Sempre renderiza o chrome (bloqueador + barra) mesmo se passo for null
  // ou estiver oculto durante uma transição.
  if (!passo) return chrome;
  // Tutorial pediu pra esconder a UI antes de avançar — não renderiza nada
  // do passo, mas mantém o chrome (bloqueador + barra) visível.
  if (ocultarUI) return chrome;

  // Modo fullscreen — texto no TOPO da tela com fundo BRANCO sólido cobrindo
  // tudo abaixo. Evita que as opções da próxima etapa apareçam por trás
  // sobrepondo a orientação. Ao avançar pro próximo passo, o overlay some
  // e revela as opções de uma vez. Mesmo estilo tipográfico do
  // "Dê uma referência a esse projeto" (26px, font-weight 500).
  if (passo.tipo === "fullscreen") {
    return (
      <>
        {chrome}
        <style>{`
          @keyframes vk-tut-fs-fade { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
          .vk-tut-fs-card { animation: vk-tut-fs-fade 0.35s cubic-bezier(0.32, 0.72, 0, 1) both; }
          .vk-tut-fs-line2 { animation: vk-tut-fs-fade 0.35s cubic-bezier(0.32, 0.72, 0, 1) both; animation-delay: 0.4s; opacity: 0; }
        `}</style>
        <div style={{
          position: "fixed", inset: 0,
          background: "#fff",
          zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "flex-start",
          paddingTop: "20vh", paddingLeft: 24, paddingRight: 24,
          fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif",
        }}>
          <div className="vk-tut-fs-card" style={{ maxWidth: 720, textAlign: "center" }}>
            <h2 style={{
              fontSize: 26, fontWeight: 500, letterSpacing: "-0.022em",
              lineHeight: 1.2, margin: 0, color: "#111",
            }}>
              {passo.titulo}
            </h2>
            {passo.descricao && (
              <p className="vk-tut-fs-line2" style={{
                fontSize: 16, fontWeight: 400, color: "#6b7280",
                lineHeight: 1.55, marginTop: 14, marginBottom: 0,
              }}>
                {passo.descricao}
              </p>
            )}
          </div>
        </div>
      </>
    );
  }

  // Modo "callouts" — círculo azul escuro ao redor de múltiplos elementos
  // com texto único acima e linhas conectoras (callout) ligando cada
  // círculo ao texto. Texto também em azul escuro.
  if (passo.tipo === "callouts") {
    const ids = passo.targetIds || [];
    return (
      <>
        {chrome}
        <style>{`
          @keyframes vk-tut-spot-co {
            0%, 100% { box-shadow: 0 0 0 5px rgba(245, 158, 11, 0.45), 0 0 36px rgba(245, 158, 11, 0.80); border-color: #f59e0b; }
            50%      { box-shadow: 0 0 0 11px rgba(245, 158, 11, 0.65), 0 0 52px rgba(245, 158, 11, 1.0); border-color: #d97706; }
          }
          .vk-tut-spot-co { animation: vk-tut-spot-co 1.2s ease-in-out infinite; }
          .vk-tut-callout-text { animation: vk-tut-fs-fade 0.4s cubic-bezier(0.32, 0.72, 0, 1) both; }
        `}</style>
        <CalloutsRenderer ids={ids} titulo={passo.titulo} descricao={passo.descricao} acaoAoIniciar={passo.acaoAoIniciar} posicao={passo.posicao} />
      </>
    );
  }

  // Modo cursor-only — esconde spotlight + tooltip, mostra apenas o cursor
  // de mouse SVG se movendo até o elemento. Útil pras opções (Médio, Térreo,
  // etc.) que já mudam de cor ao serem selecionadas, dispensando o spotlight.
  if (passo.cursorOnly) {
    return (
      <>
        {chrome}
        <style>{`
          @keyframes vk-tut-cursor-fade { from { opacity: 0; } to { opacity: 1; } }
          .vk-tut-cursor { animation: vk-tut-cursor-fade 0.25s ease-out; }
          @keyframes vk-tut-spot-co {
            0%, 100% { box-shadow: 0 0 0 5px rgba(245, 158, 11, 0.45), 0 0 36px rgba(245, 158, 11, 0.80); border-color: #f59e0b; }
            50%      { box-shadow: 0 0 0 11px rgba(245, 158, 11, 0.65), 0 0 52px rgba(245, 158, 11, 1.0); border-color: #d97706; }
          }
          .vk-tut-spot-co { animation: vk-tut-spot-co 1.2s ease-in-out infinite; }
        `}</style>
        {/* Backdrop escurecido (modo comSpotlight) — destaca o spotlight */}
        {passo.comSpotlight && (
          <div style={{
            position: "fixed", inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 1000, pointerEvents: "none",
            transition: "opacity 0.2s",
          }} />
        )}
        {/* Spotlight pulsante em volta do alvo (modo comSpotlight) */}
        {passo.comSpotlight && rect && (
          <div className="vk-tut-spot-co" style={{
            position: "fixed",
            top: rect.top - 6, left: rect.left - 6,
            width: rect.width + 12, height: rect.height + 12,
            border: "3px solid #f59e0b", borderRadius: 10,
            zIndex: 1001, pointerEvents: "none",
            transition: "top 0.4s cubic-bezier(0.32, 0.72, 0, 1), left 0.4s cubic-bezier(0.32, 0.72, 0, 1), width 0.4s, height 0.4s",
          }} />
        )}
        {rect && (
          <div className="vk-tut-cursor" style={{
            position: "fixed", zIndex: 1003, pointerEvents: "none",
            // Posiciona a "ponta" do cursor sobre o centro do elemento
            top:  rect.top + rect.height / 2 - 4,
            left: rect.left + rect.width / 2 - 4,
            transition: "top 0.5s cubic-bezier(0.32, 0.72, 0, 1), left 0.5s cubic-bezier(0.32, 0.72, 0, 1)",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
          }}>
            {/* SVG cursor padrão */}
            <svg width="22" height="28" viewBox="0 0 22 28" fill="none">
              <path d="M2 2 L2 22 L7 17 L11 25 L14 23.5 L10 16 L17 16 Z"
                fill="#111" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </>
    );
  }

  // Calcula posição do balão tooltip e da seta baseado no rect e em "posicao"
  const tooltipMargem = 18;
  const posPref = passo.posicao || "right";
  let tooltipStyle = {};
  let setaStyle = {};
  if (rect) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    if (posPref === "right") {
      tooltipStyle = { top: cy - 50, left: rect.left + rect.width + tooltipMargem + 12 };
      setaStyle = {
        top: cy - 14, left: rect.left + rect.width + 4,
        borderTop: "14px solid transparent", borderBottom: "14px solid transparent",
        borderRight: "16px solid #f59e0b", width: 0, height: 0,
      };
    } else if (posPref === "left") {
      tooltipStyle = { top: cy - 50, right: window.innerWidth - rect.left + tooltipMargem + 12 };
      setaStyle = {
        top: cy - 14, left: rect.left - 20,
        borderTop: "14px solid transparent", borderBottom: "14px solid transparent",
        borderLeft: "16px solid #f59e0b", width: 0, height: 0,
      };
    } else if (posPref === "bottom") {
      tooltipStyle = { top: rect.top + rect.height + tooltipMargem + 12, left: cx - 160 };
      setaStyle = {
        top: rect.top + rect.height + 4, left: cx - 14,
        borderLeft: "14px solid transparent", borderRight: "14px solid transparent",
        borderBottom: "16px solid #f59e0b", width: 0, height: 0,
      };
    } else { // top
      tooltipStyle = { bottom: window.innerHeight - rect.top + tooltipMargem + 12, left: cx - 160 };
      setaStyle = {
        top: rect.top - 20, left: cx - 14,
        borderLeft: "14px solid transparent", borderRight: "14px solid transparent",
        borderTop: "16px solid #f59e0b", width: 0, height: 0,
      };
    }
  }

  return (
    <>
      {chrome}
      <style>{`
        @keyframes vk-tut-pulse-border {
          0%, 100% { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.2), 0 0 24px rgba(245, 158, 11, 0.5); border-color: #f59e0b; }
          50%      { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0.4), 0 0 32px rgba(245, 158, 11, 0.7); border-color: #d97706; }
        }
        @keyframes vk-tut-pulse-arrow {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50%      { opacity: 1;   transform: scale(1.15); }
        }
        @keyframes vk-tut-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .vk-tut-spotlight { animation: vk-tut-pulse-border 1.6s ease-in-out infinite; }
        .vk-tut-arrow     { animation: vk-tut-pulse-arrow 1s ease-in-out infinite; }
        .vk-tut-tooltip   { animation: vk-tut-fade-in 0.25s ease-out; }
      `}</style>

      {/* Backdrop semi-transparente — leve pra user ainda ver as outras telas */}
      <div onClick={onCancelar} style={{
        position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.35)",
        zIndex: 1000, transition: "opacity 0.2s",
      }} />

      {/* Spotlight em volta do elemento alvo (border + shadow pulsante) */}
      {rect && (
        <div className="vk-tut-spotlight" style={{
          position: "fixed",
          top: rect.top - 6, left: rect.left - 6,
          width: rect.width + 12, height: rect.height + 12,
          border: "2.5px solid #f59e0b",
          borderRadius: 10,
          zIndex: 1001, pointerEvents: "none",
        }} />
      )}

      {/* Seta apontando do tooltip pro elemento */}
      {rect && (
        <div className="vk-tut-arrow" style={{
          position: "fixed", zIndex: 1002, pointerEvents: "none",
          ...setaStyle,
        }} />
      )}

      {/* Tooltip com título + descrição */}
      {rect && (
        <div className="vk-tut-tooltip" style={{
          position: "fixed", zIndex: 1003,
          background: "#fff", borderRadius: 10,
          padding: "14px 18px", maxWidth: 320, minWidth: 240,
          boxShadow: "0 12px 32px rgba(0,0,0,0.2)",
          fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif",
          ...tooltipStyle,
        }}>
          {passo.titulo && (
            <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e",
              textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>
              {passo.titulo}
            </div>
          )}
          <div style={{ fontSize: 13.5, color: "#111", lineHeight: 1.5 }}>
            {passo.descricao}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "center", marginTop: 12, gap: 8 }}>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              {idx + 1} de {passos.length}
            </div>
            <button onClick={onCancelar} style={{
              background: "transparent", color: "#9ca3af",
              border: "none", fontSize: 11, cursor: "pointer",
              fontFamily: "inherit", padding: 0,
            }}>Pular tutorial</button>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE CONTAINER (padrão de largura das páginas)
// ═══════════════════════════════════════════════════════════════
// Envelopa módulos que são listas/formulários, limitando largura pra
// legibilidade em telas ultrawide. Kanbans não devem usar (precisam
// de largura máxima).
// ═══════════════════════════════════════════════════════════════
function PageContainer({ children, maxWidth = 1200, padding = "24px 28px", style = {} }) {
  return (
    <div style={{ padding, ...style }}>
      <div style={{ maxWidth, margin: "0 auto" }}>
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CARREGAMENTO DE BIBLIOTECAS EXTERNAS (jsPDF, html2canvas, pdf.js)
// ═══════════════════════════════════════════════════════════════
if (typeof window !== "undefined" && !document.getElementById("jspdf-script")) {
  const s = document.createElement("script");
  s.id  = "jspdf-script";
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  document.head.appendChild(s);
}
if (typeof window !== "undefined" && !document.getElementById("h2c-script")) {
  const s2 = document.createElement("script");
  s2.id  = "h2c-script";
  s2.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
  document.head.appendChild(s2);
}
// pdf.js — rasterizar PDF em imagens (snapshot de proposta enviada)
if (typeof window !== "undefined" && !document.getElementById("pdfjs-script")) {
  const s3 = document.createElement("script");
  s3.id  = "pdfjs-script";
  s3.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  s3.onload = () => {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
  };
  document.head.appendChild(s3);
}

// Utilitário: renderiza PDF (blob) como array de imagens JPEG base64.
// Usado pra gerar snapshot visual de propostas enviadas.
async function rasterizarPdfParaImagens(pdfBlob, { maxWidth = 1200, quality = 0.7 } = {}) {
  if (!window.pdfjsLib) throw new Error("pdf.js ainda não carregou — tente novamente em 1s");
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const imagens = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport0 = page.getViewport({ scale: 1 });
    const scale = maxWidth / viewport0.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    imagens.push(canvas.toDataURL("image/jpeg", quality));
  }
  return imagens;
}

// ═══════════════════════════════════════════════════════════════
// UTILITÁRIOS GERAIS
// ═══════════════════════════════════════════════════════════════
// NOTA: o objeto `DB` global (window.storage + localStorage) foi removido.
// Não era mais usado desde a migração para Postgres. Persistência agora é
// 100% via api.js → backend. Estado local efêmero (preferências de UI)
// continua podendo usar localStorage diretamente onde necessário.

var uid = () => Math.random().toString(36).slice(2, 9);

// Snapshot dos defaults — usado para restaurar configurações
var COMODOS_ORIGINAL = JSON.parse(JSON.stringify({})); // preenchido abaixo após COMODOS
var INDICE_PADRAO_ORIGINAL = {};

// ── Cálculo de Engenharia com desconto composto por faixas ──────
// 0-200m²: preço cheio (R$50/m²)
// A cada 100m² acima de 200m² até 600m²: aplica 8% de desconto composto
// A cada 100m² acima de 600m²: aplica 2% de desconto composto
function calcularEngenharia(areaTotal, precoM2 = 50) {
  const faixas = [];
  let fatorAtual = 1.0;
  let limiteAnterior = 0;
  let areaRestante = areaTotal;
  let totalEng = 0;

  const LIMITE_INICIAL = 200;
  const DESCONTO_ATE_600 = 0.08;
  const DESCONTO_APOS_600 = 0.02;

  // Faixa 1: 0-200m² sem desconto
  const area1 = Math.min(areaRestante, LIMITE_INICIAL);
  if (area1 > 0) {
    const preco = area1 * precoM2 * fatorAtual;
    faixas.push({ de: 0, ate: area1, area: area1, fator: fatorAtual, desconto: 0, preco });
    totalEng += preco;
    areaRestante -= area1;
    limiteAnterior = LIMITE_INICIAL;
  }

  // Faixas seguintes de 100m² com desconto composto (máximo 50%)
  let faixaNum = 1;
  while (areaRestante > 0) {
    const limiteAtual = limiteAnterior + 100;
    const desconto = limiteAnterior < 600 ? DESCONTO_ATE_600 : DESCONTO_APOS_600;
    fatorAtual = Math.max(0.5, fatorAtual * (1 - desconto));
    const areaFaixa = Math.min(areaRestante, 100);
    const preco = areaFaixa * precoM2 * fatorAtual;
    faixas.push({
      de: limiteAnterior, ate: limiteAnterior + areaFaixa,
      area: areaFaixa, fator: fatorAtual,
      desconto: Math.round((1 - fatorAtual) * 1000) / 10,
      preco
    });
    totalEng += preco;
    areaRestante -= areaFaixa;
    limiteAnterior = limiteAtual;
    faixaNum++;
    if (faixaNum > 5000) break; // safety
  }

  return { totalEng, faixas, precoM2Efetivo: areaTotal > 0 ? totalEng / areaTotal : 0 };
}

// ═══════════════════════════════════════════════════════════════
// DADOS ORÇAMENTO PROJETO
// ═══════════════════════════════════════════════════════════════
var COMODOS = {
  "Garagem":        { indice:0.03, medidas:{ Grande:[6,3.5],   Médio:[5.2,3],   Pequeno:[5,2.5],    Compacta:[4.5,2.5] }},
  "Hall de entrada":{ indice:0.03, medidas:{ Grande:[2,2],     Médio:[1.5,1.5], Pequeno:[1,1],      Compacta:[0.5,0.5] }},
  "Sala TV":        { indice:0.05, medidas:{ Grande:[6,4.5],   Médio:[4,4],     Pequeno:[3,3],      Compacta:[2.2,3]   }},
  "Living":         { indice:0.05, medidas:{ Grande:[14,7],    Médio:[8,4],     Pequeno:[3.5,2.5],  Compacta:[0,0]     }},
  "Cozinha":        { indice:0.08, medidas:{ Grande:[6,4],     Médio:[4,3],     Pequeno:[3,2.5],    Compacta:[3,1.8]   }},
  "Lavanderia":     { indice:0.05, medidas:{ Grande:[4,2.5],   Médio:[3,2],     Pequeno:[2,1.6],    Compacta:[1.5,1.5] }},
  "Depósito":       { indice:0.03, medidas:{ Grande:[4,2],     Médio:[3,0.7],   Pequeno:[1.5,0.7],  Compacta:[0,0]     }},
  "Lavabo":         { indice:0.05, medidas:{ Grande:[2.3,1.6], Médio:[2,1.4],   Pequeno:[1.6,1.35], Compacta:[1.4,1.2] }},
  "Escritório":     { indice:0.05, medidas:{ Grande:[3.5,3.5], Médio:[3,3],     Pequeno:[2,3],      Compacta:[2,2.5]   }},
  "Sala de jantar": { indice:0.05, medidas:{ Grande:[5,3.5],   Médio:[4,3],     Pequeno:[3,2],      Compacta:[2,1.8]   }},
  "Área de lazer":  { indice:0.08, medidas:{ Grande:[8,6],     Médio:[5,5],     Pequeno:[3,2],      Compacta:[2,1.5]   }},
  "Piscina":        { indice:0.08, medidas:{ Grande:[3.5,6],   Médio:[3,5],     Pequeno:[2.5,4.5],  Compacta:[2,3]     }},
  "Lavabo Lazer":   { indice:0.05, medidas:{ Grande:[3.5,2],   Médio:[3,2],     Pequeno:[2.1,1.35], Compacta:[1.4,1.2] }},
  "Sauna":          { indice:0.03, medidas:{ Grande:[2.3,1.7], Médio:[2,1.5],   Pequeno:[1.8,1.5],  Compacta:[0,0]     }},
  "Academia":       { indice:0.03, medidas:{ Grande:[6,5],     Médio:[5,4],     Pequeno:[3.5,3.5],  Compacta:[0,0]     }},
  "Brinquedoteca":  { indice:0.03, medidas:{ Grande:[4,4],     Médio:[3,3],     Pequeno:[2,2],      Compacta:[0,0]     }},
  "Louceiro":       { indice:0.03, medidas:{ Grande:[4,3],     Médio:[3,2.5],   Pequeno:[2,2],      Compacta:[1.5,2]   }},
  "Dormitório":     { indice:0.05, medidas:{ Grande:[3.5,4.5], Médio:[3,4],     Pequeno:[3,3],      Compacta:[2.5,3]   }},
  "Closet":         { indice:0.05, medidas:{ Grande:[4,4],     Médio:[3,2.5],   Pequeno:[1.6,2],    Compacta:[1.6,1.6] }},
  "WC":             { indice:0.05, medidas:{ Grande:[3.5,2],   Médio:[3,1.4],   Pequeno:[2.6,1.35], Compacta:[2.2,1.3] }},
  "Suíte":          { indice:0.05, medidas:{ Grande:[5.2,6],   Médio:[4.6,5.5], Pequeno:[4.1,4.5],  Compacta:[3.5,4.5] }},
  "Closet Suíte":   { indice:0.05, medidas:{ Grande:[4,4],     Médio:[3,2.5],   Pequeno:[1.6,2],    Compacta:[1.6,1.6] }},
  "Suíte Master":   { indice:0.05, medidas:{ Grande:[5.6,7.6], Médio:[5,6.5],   Pequeno:[4.5,6],    Compacta:[4,5]     }},
  "Escada":         { indice:0.08, medidas:{ Grande:[2.5,4.5], Médio:[2.2,4],   Pequeno:[2,3.8],    Compacta:[1,3.7]   }},
};
var GRUPOS_COMODOS = {
  "Áreas Sociais": ["Garagem","Hall de entrada","Sala TV","Living","Sala de jantar","Escritório","Lavabo"],
  "Serviço":       ["Cozinha","Lavanderia","Depósito"],
  "Lazer":         ["Área de lazer","Piscina","Lavabo Lazer","Sauna","Academia","Brinquedoteca","Louceiro"],
  "Dormitórios":   ["Dormitório","Closet","WC","Suíte","Closet Suíte","Suíte Master"],
  "Outros":        ["Escada"],
};
var COMODOS_CLINICA = {
  "Estacionamento":        { indice:0.025526, medidas:{ Grande:[6,3.5],   Médio:[5.2,3],   Pequeno:[5,2.5],   Compacta:[4.5,2.5] }},
  "Recepção":              { indice:0.076579, medidas:{ Grande:[6.5,3],   Médio:[4.5,2],   Pequeno:[3.5,1.8], Compacta:[2,1.8]   }},
  "Sala de espera":        { indice:0.051053, medidas:{ Grande:[8,7],     Médio:[6.5,5.5], Pequeno:[4.5,3.5], Compacta:[3.5,2.8] }},
  "Sala de café":          { indice:0.051053, medidas:{ Grande:[2,2],     Médio:[1.8,1.8], Pequeno:[1.5,1.5], Compacta:[1,1]     }},
  "PNE Masculino":         { indice:0.051053, medidas:{ Grande:[2.5,2],   Médio:[2,1.5],   Pequeno:[1.8,1.5], Compacta:[1.5,1.2] }},
  "PNE Feminino":          { indice:0.051053, medidas:{ Grande:[2.5,2],   Médio:[2,1.5],   Pequeno:[1.8,1.5], Compacta:[1.5,1.2] }},
  "Salas de Reunião":      { indice:0.051053, medidas:{ Grande:[7,4],     Médio:[6,3],     Pequeno:[4,4],     Compacta:[3,3]     }},
  "Consultórios":          { indice:0.076579, medidas:{ Grande:[7,4],     Médio:[6,3],     Pequeno:[4,4],     Compacta:[3,3]     }},
  "Salas de Procedimento": { indice:0.076579, medidas:{ Grande:[5,3],     Médio:[4,2.8],   Pequeno:[3.8,2.5], Compacta:[3,2]     }},
  "Espaço para maca":      { indice:0.025526, medidas:{ Grande:[3.8,1.7], Médio:[3.8,1.7], Pequeno:[3.8,1.7], Compacta:[3.8,1.7] }},
  "Salas Conforto":        { indice:0.051053, medidas:{ Grande:[5,4],     Médio:[4,3],     Pequeno:[3.5,2.5], Compacta:[2,2]     }},
  "Wcs":                   { indice:0.051053, medidas:{ Grande:[2.6,2],   Médio:[2,1.8],   Pequeno:[2,1.5],   Compacta:[1.8,1.3] }},
  "Vestiários":            { indice:0.051053, medidas:{ Grande:[6.5,2],   Médio:[4,2],     Pequeno:[3,1.55],  Compacta:[2.8,1.3] }},
  "Depósitos":             { indice:0.025526, medidas:{ Grande:[4,2],     Médio:[3,1.8],   Pequeno:[2.5,1.5], Compacta:[2,1.3]   }},
  "Copas":                 { indice:0.076579, medidas:{ Grande:[4,2],     Médio:[3,1.5],   Pequeno:[2,1.5],   Compacta:[1.5,1.5] }},
  "Esterilização":         { indice:0.051053, medidas:{ Grande:[3,2],     Médio:[2,1.8],   Pequeno:[2,1.5],   Compacta:[1.5,1.5] }},
  "Expurgo":               { indice:0.051053, medidas:{ Grande:[3,2],     Médio:[2,1.8],   Pequeno:[2,1.5],   Compacta:[1.5,1.5] }},
  "DML":                   { indice:0.051053, medidas:{ Grande:[4,3],     Médio:[3,2.5],   Pequeno:[1.5,2],   Compacta:[1.5,1.5] }},
  "Escada":                { indice:0.0776,       medidas:{ Grande:[2.5,4.5], Médio:[2.2,4],   Pequeno:[2,3.8],   Compacta:[1,3.7]   }},
};
var GRUPOS_COMODOS_CLINICA = {
  "Acesso e Circulação": ["Estacionamento","Recepção","Sala de espera","Sala de café"],
  "Sanitários":          ["PNE Masculino","PNE Feminino","Wcs","Vestiários"],
  "Atendimento":         ["Consultórios","Salas de Procedimento","Espaço para maca","Salas de Reunião","Salas Conforto"],
  "Apoio":               ["Copas","Esterilização","Expurgo","Depósitos","DML","Escada"],
};
var CUSTOM_CONFIG_KEY_CLINICA = "obramanager-config-clinica-v1";

// ═══════════════════════════════════════════════════════════════
// COMERCIAL — cômodos por bloco
// ═══════════════════════════════════════════════════════════════
var COMODOS_GALERIA_LOJA = {
  "Área de vendas (térrea)":  { indice:0.045, medidas:{ Grande:[10,8],  Médio:[8,6],    Pequeno:[6,5],    Compacta:[5,4]    }},
  "Mezanino":                 { indice:0.060, medidas:{ Grande:[10,4],  Médio:[8,3],    Pequeno:[6,2.5],  Compacta:[5,2]    }},
  "Banheiro":                 { indice:0.025, medidas:{ Grande:[2.6,2], Médio:[2,1.8],  Pequeno:[2,1.5],  Compacta:[1.8,1.3]}},
  "Copa":                     { indice:0.025, medidas:{ Grande:[2,2],   Médio:[1.8,1.8],Pequeno:[1.5,1.5],Compacta:[1,1]    }},
  "Depósito":                 { indice:0.015, medidas:{ Grande:[4,2],   Médio:[3,1.8],  Pequeno:[2.5,1.5],Compacta:[2,1.3]  }},
  "Vestiário":                { indice:0.020, medidas:{ Grande:[3,2],   Médio:[2.5,2],  Pequeno:[2,1.5],  Compacta:[1.5,1.5]}},
  "Recepção/Atendimento":     { indice:0.030, medidas:{ Grande:[4,3],   Médio:[3,2.5],  Pequeno:[2.5,2],  Compacta:[2,1.8]  }},
};
var COMODOS_GALERIA_ANCORA = {
  "Área principal":           { indice:0.040, medidas:{ Grande:[30,15], Médio:[25,12],  Pequeno:[20,10],  Compacta:[15,8]   }},
  "Recepção":                 { indice:0.030, medidas:{ Grande:[4,3],   Médio:[3,2.5],  Pequeno:[2.5,2],  Compacta:[2,1.8]  }},
  "Copa âncora":              { indice:0.025, medidas:{ Grande:[3,2],   Médio:[2.5,1.8],Pequeno:[2,1.5],  Compacta:[1.5,1.5]}},
  "Depósito âncora":          { indice:0.015, medidas:{ Grande:[6,4],   Médio:[4,3],    Pequeno:[3,2.5],  Compacta:[2.5,2]  }},
  "Vestiário âncora":         { indice:0.020, medidas:{ Grande:[4,2],   Médio:[3,2],    Pequeno:[2.5,1.5],Compacta:[2,1.3]  }},
  "Banheiro âncora":          { indice:0.025, medidas:{ Grande:[2.6,2], Médio:[2,1.8],  Pequeno:[2,1.5],  Compacta:[1.8,1.3]}},
  "PNE âncora":               { indice:0.025, medidas:{ Grande:[2.5,2], Médio:[2,1.5],  Pequeno:[1.8,1.5],Compacta:[1.5,1.2]}},
  "Escritório":               { indice:0.030, medidas:{ Grande:[4,3.5], Médio:[3.5,3],  Pequeno:[3,2.5],  Compacta:[2.5,2]  }},
};
var COMODOS_GALERIA_COMUM = {
  "Circulação interna":       { indice:0.020, medidas:{ Grande:[20,3],  Médio:[15,2.5], Pequeno:[10,2.5], Compacta:[8,2]    }},
  "Banheiro PNE":             { indice:0.025, medidas:{ Grande:[2.5,2], Médio:[2,1.5],  Pequeno:[1.8,1.5],Compacta:[1.5,1.2]}},
  "Vaga descoberta":          { indice:0.010, medidas:{ Grande:[5,2.5], Médio:[5,2.5],  Pequeno:[5,2.5],  Compacta:[4.5,2.5]}},
};
// Galpao — cômodos com áreas conforme tabela fornecida
var COMODOS_GALPAO = {
  "Area Principal":    { indice:0.060, medidas:{ Grande:[250,30],  Médio:[62.5,20], Pequeno:[40,15], Compacta:[20,10] }},
  "Mezanino (galp.)":  { indice:0.030, medidas:{ Grande:[30,25],   Médio:[12,10],   Pequeno:[10,6],  Compacta:[5,4]   }},
  "Banheiro (galp.)":  { indice:0.025, medidas:{ Grande:[2.6,2],   Médio:[2,1.8],   Pequeno:[2,1.5], Compacta:[1.8,1.3]}},
  "Copa (galp.)":      { indice:0.025, medidas:{ Grande:[3,2],     Médio:[2.5,1.8], Pequeno:[2,1.5], Compacta:[1.5,1.5]}},
  "Escritorio (galp.)":{ indice:0.030, medidas:{ Grande:[4,3.5],   Médio:[3.5,3],   Pequeno:[3,2.5], Compacta:[2.5,2]  }},
  "Deposito (galp.)":  { indice:0.015, medidas:{ Grande:[6,4],     Médio:[4,3],     Pequeno:[3,2.5], Compacta:[2.5,2]  }},
};
var GRUPOS_COMODOS_GALPAO = { "Galpao": Object.keys(COMODOS_GALPAO) };
var CUSTOM_CONFIG_KEY_GALPAO = "obramanager-config-galpao-v1";

var COMODOS_GALERIA_APTO = {
  "Hall de entrada":   { indice:0.020, medidas:{ Grande:[3,2.5],   Médio:[2.5,2],   Pequeno:[2,1.8],  Compacta:[1.8,1.5] }},
  "Sala de TV":        { indice:0.040, medidas:{ Grande:[5,4],     Médio:[4.5,3.5], Pequeno:[4,3],    Compacta:[3.5,3]   }},
  "Sala de Jantar":    { indice:0.035, medidas:{ Grande:[4.5,3.5], Médio:[4,3],     Pequeno:[3.5,3],  Compacta:[3,2.5]   }},
  "Cozinha":           { indice:0.040, medidas:{ Grande:[4,3],     Médio:[3.5,2.8], Pequeno:[3,2.5],  Compacta:[2.5,2]   }},
  "Lavanderia":        { indice:0.025, medidas:{ Grande:[3,2],     Médio:[2.5,1.8], Pequeno:[2,1.5],  Compacta:[1.8,1.3] }},
  "Escritório (apto)": { indice:0.030, medidas:{ Grande:[4,3.5],   Médio:[3.5,3],   Pequeno:[3,2.5],  Compacta:[2.5,2]   }},
  "Lavabo":            { indice:0.020, medidas:{ Grande:[1.8,1.2], Médio:[1.6,1.2], Pequeno:[1.5,1.2],Compacta:[1.4,1.1] }},
  "Dormitório":        { indice:0.050, medidas:{ Grande:[4.5,4],   Médio:[4,3.5],   Pequeno:[3.5,3],  Compacta:[3,2.8]   }},
  "WC":                { indice:0.025, medidas:{ Grande:[2.6,2],   Médio:[2.2,1.8], Pequeno:[2,1.6],  Compacta:[1.8,1.5] }},
  "Closet":            { indice:0.030, medidas:{ Grande:[3,2.5],   Médio:[2.5,2],   Pequeno:[2,1.8],  Compacta:[1.8,1.5] }},
};
var GRUPOS_COMODOS_GALERIA_LOJA   = { "Por Loja":        Object.keys(COMODOS_GALERIA_LOJA)   };
var GRUPOS_COMODOS_GALERIA_ANCORA = { "Espaço Âncora":   Object.keys(COMODOS_GALERIA_ANCORA) };
var GRUPOS_COMODOS_GALERIA_COMUM  = { "Áreas Comuns":    Object.keys(COMODOS_GALERIA_COMUM)  };
var GRUPOS_COMODOS_GALERIA_APTO   = { "Por Apartamento": Object.keys(COMODOS_GALERIA_APTO)   };
var INDICE_FACHADA_GALERIA = 0.15;
var CUSTOM_CONFIG_KEY_GALERIA = "obramanager-config-galeria-v1";

// Retorna COMODOS e GRUPOS conforme tipo de obra
function getComodosConfig(tipo) {
  if (tipo === "Clínica") return { comodos: COMODOS_CLINICA, grupos: GRUPOS_COMODOS_CLINICA, storageKey: CUSTOM_CONFIG_KEY_CLINICA };
  if (tipo === "Comercial" || tipo === "Galeria") return {
    comodos: { ...COMODOS_GALERIA_LOJA, ...COMODOS_GALERIA_ANCORA, ...COMODOS_GALERIA_COMUM, ...COMODOS_GALERIA_APTO, ...COMODOS_GALPAO },
    grupos:  { ...GRUPOS_COMODOS_GALERIA_LOJA, ...GRUPOS_COMODOS_GALERIA_ANCORA, ...GRUPOS_COMODOS_GALERIA_COMUM, ...GRUPOS_COMODOS_GALERIA_APTO, ...GRUPOS_COMODOS_GALPAO },
    storageKey: CUSTOM_CONFIG_KEY_GALERIA
  };
  if (tipo === "Galpao" || tipo === "Galpão") return {
    comodos: COMODOS_GALPAO,
    grupos:  GRUPOS_COMODOS_GALPAO,
    storageKey: CUSTOM_CONFIG_KEY_GALPAO
  };
  return { comodos: COMODOS, grupos: GRUPOS_COMODOS, storageKey: CUSTOM_CONFIG_KEY };
}

// INDICE_PADRAO — Sprint 3: valores reduzidos pra deixar o CUB do estado/padrão
// como principal driver de preço (CUB já tem Baixo/Normal/Alto diferenciados).
// Antes era ±0.5/±0.2 (variação grande); agora ±0.1 (apenas um traço sutil pra
// alto vs baixo padrão). Total de variação ≤ 20% no projeto típico.
var INDICE_PADRAO = { Alto:0.1, Médio:0, Baixo:-0.1 };
// Storage key para customizações globais
var CUSTOM_CONFIG_KEY = "obramanager-config-v1";
// Carrega customizações salvas (medidas/índices editados pelo usuário)
function loadCustomConfig() {
  try {
    const raw = localStorage ? null : null; // não usamos localStorage
    return null;
  } catch { return null; }
}
var PRECO_BASE = 45.00;
var PRECO_BASE_CLINICA = 32.00; // preço base clínica
var ACRESCIMO_AREA = 0.25;

// Configuracao centralizada por tipo — todos os parametros condicionais em um lugar
var TIPO_CONFIG = {
  Residencial: {
    precoBase:      45.00,
    acrescimoCirk:  0.25,   // +25% circulacao/estrutura
    faixasDesconto: [        // desconto progressivo arquitetura
      { ate: 200,      desconto: 0.00 },
      { ate: 300,      desconto: 0.30 },
      { ate: 400,      desconto: 0.35 },
      { ate: 500,      desconto: 0.40 },
      { ate: 600,      desconto: 0.45 },
      { ate: Infinity, desconto: 0.50 },
    ],
    repeticaoPcts: (acum) => acum < 1000 ? 0.25 : acum < 2000 ? 0.20 : 0.15,
    labelCirk: "25",
  },
  Clinica: {
    precoBase:      32.00,
    acrescimoCirk:  0.25,
    faixasDesconto: [
      { ate: 200,      desconto: 0.00 },
      { ate: 300,      desconto: 0.30 },
      { ate: 400,      desconto: 0.35 },
      { ate: 500,      desconto: 0.40 },
      { ate: 600,      desconto: 0.45 },
      { ate: Infinity, desconto: 0.50 },
    ],
    repeticaoPcts: (acum) => acum < 1000 ? 0.25 : acum < 2000 ? 0.20 : 0.15,
    labelCirk: "25",
  },
  Comercial: {
    precoBase:      45.00,
    acrescimoCirk:  0.25,
    faixasDesconto: [
      { ate: 200,      desconto: 0.00 },
      { ate: 300,      desconto: 0.30 },
      { ate: 400,      desconto: 0.35 },
      { ate: 500,      desconto: 0.40 },
      { ate: 600,      desconto: 0.45 },
      { ate: Infinity, desconto: 0.50 },
    ],
    repeticaoPcts: (acum) => acum < 1000 ? 0.25 : acum < 2000 ? 0.20 : 0.15,
    labelCirk: "25",
  },
  Galpao: {
    precoBase:      45.00,
    acrescimoCirk:  0.10,   // +10% circulacao para galpoes
    faixasDesconto: [
      { ate: 200,      desconto: 0.00 },
      { ate: 300,      desconto: 0.30 },
      { ate: 400,      desconto: 0.35 },
      { ate: 500,      desconto: 0.40 },
      { ate: 600,      desconto: 0.45 },
      { ate: Infinity, desconto: 0.50 },
    ],
    repeticaoPcts: (acum) => acum < 1000 ? 0.25 : acum < 2000 ? 0.20 : 0.15,
    labelCirk: "10",
  },
};
// Helper — retorna config do tipo, com fallback para Residencial
function getTipoConfig(tipo) {
  const key = tipo === "Clínica" ? "Clinica"
            : tipo === "Galpão"  ? "Galpao"
            : (tipo || "Residencial");
  return TIPO_CONFIG[key] || TIPO_CONFIG.Residencial;
}

// ═══════════════════════════════════════════════════════════════
// PREÇO BASE DINÂMICO (Sprint 3 — modelo CUB)
// ═══════════════════════════════════════════════════════════════
// Calcula o preço base por m² de arquitetura usando:
//   precoBase = pct_efetivo × CUB[estado][R-1][padrão_normalizado]
//
// pct_efetivo: pct_calibrado se preenchido (calibragem pessoal do usuário),
//              senão pct_matriz_calculado (calculado pelo onboarding).
//
// Padrão do PROJETO ("Alto", "Médio", "Baixo") → padrão do CUB ("Alto", "Normal", "Baixo")
// Mapeamento: Médio → Normal (oficial NBR 12721, mas UI mostra "Médio").
//
// Empresas SEM onboarding completo (sem usuario.pct_*  ou sem data.cub):
//   → fallback pro precoBase fixo do TIPO_CONFIG (R$ 45 / R$ 32).
//
// Parâmetros:
//   tipoProjeto: "Residencial", "Clínica", "Conj. Comercial", "Galpão"
//   padrao:      "Alto" | "Médio" | "Baixo" (padrão do projeto, NÃO do CUB)
//   usuario:     objeto do JWT (com pct_calibrado, pct_matriz_calculado, estado)
//   cub:         data.cub do loadAllData (objeto { estado, Baixo, Normal, Alto })
//
// Retorna: { precoBase, modo } — modo "dinamico" ou "fixo"
// ═══════════════════════════════════════════════════════════════
function getPrecoBaseDinamico(tipoProjeto, padrao, usuario, cub) {
  const tcfg = getTipoConfig(tipoProjeto === "Clínica" ? "Clinica"
                          : tipoProjeto === "Galpão" ? "Galpao"
                          : (tipoProjeto || "Residencial"));
  const fallback = { precoBase: tcfg.precoBase, modo: "fixo" };

  // Sem dados de pricing → fallback fixo (orçamento ainda funciona).
  if (!usuario || !cub) return fallback;
  const pct = (usuario.pct_calibrado != null && usuario.pct_calibrado > 0)
    ? usuario.pct_calibrado
    : usuario.pct_matriz_calculado;
  if (!pct || pct <= 0) return fallback;

  // Padrão Médio do projeto = Normal do CUB (NBR 12721).
  const padraoCub = padrao === "Médio" ? "Normal" : padrao;
  const cubObj = cub[padraoCub];
  if (!cubObj || !cubObj.valor_m2 || cubObj.valor_m2 <= 0) return fallback;

  const precoBase = Math.round(pct * cubObj.valor_m2 * 100) / 100;
  return { precoBase, modo: "dinamico", pct, cubM2: cubObj.valor_m2, padraoCub };
}
var fmt = (v) => (v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
var fmtM2 = (v) => `${(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})} m²`;
var fmtA  = (v, dec=2) => (v||0).toLocaleString("pt-BR",{minimumFractionDigits:dec,maximumFractionDigits:dec});

// ═══════════════════════════════════════════════════════════════
// SEED DATA
// Fallback vazio usado apenas quando o backend está offline.
// Dados reais vêm exclusivamente do banco via loadAllData().
// ═══════════════════════════════════════════════════════════════
var SEED = {
  clientes:           [],
  fornecedores:       [],
  materiais:          [],
  lancamentos:        [],
  obras:              [],
  orcamentosProjeto:  [],
  escritorio:         {},
  receitasFinanceiro: [],
};

var ESTADOS_BR = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
var CATS_FORNECEDOR = ["Cimento","Concreto","Agregados","Alvenaria","Estrutura","Cobertura","Elétrico","Hidráulico","Revestimento","Acabamento","Ferramentas","Tintas","Vidros","Geral","Outros"];

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE DIÁLOGOS E TOASTS (substitui alert/confirm nativos)
// ═══════════════════════════════════════════════════════════════
// Rationale:
// - Diálogos nativos (alert/confirm) têm UX feia, mostram URL do site,
//   quebram o fluxo visual e não combinam com o design do VICKE.
// - Este sistema oferece 3 helpers globais chamáveis de qualquer função
//   (não só dentro de componentes React) pra facilitar migração:
//     toast.sucesso(msg)   → balão verde que some em 3s (avisos positivos)
//     toast.erro(msg)      → balão vermelho que some em 4s
//     dialogo.confirmar({titulo, mensagem, confirmar, destrutivo}) → Promise<boolean>
//     dialogo.alertar({titulo, mensagem, tipo}) → Promise<void>
//
// Arquitetura:
// - Estado vive num objeto _dialogState fora do React.
// - Listeners são callbacks registrados por DialogosHost.
// - DialogosHost é um componente renderizado uma vez no app.jsx que
//   desenha os modais/toasts ativos.
// ═══════════════════════════════════════════════════════════════

var _dialogState = {
  modais: [],      // { id, tipo: "confirm"|"alert", titulo, mensagem, confirmar, cancelar, destrutivo, tipoAlert, resolver }
  toasts: [],      // { id, tipo: "sucesso"|"erro", mensagem }
  listeners: new Set(),
  _nextId: 1,
};

function _dialogNotify() {
  _dialogState.listeners.forEach(fn => { try { fn(); } catch {} });
}

// API pública
var toast = {
  sucesso: (mensagem, duracao = 3000) => {
    const id = _dialogState._nextId++;
    _dialogState.toasts.push({ id, tipo: "sucesso", mensagem });
    _dialogNotify();
    setTimeout(() => {
      _dialogState.toasts = _dialogState.toasts.filter(t => t.id !== id);
      _dialogNotify();
    }, duracao);
  },
  erro: (mensagem, duracao = 4000) => {
    const id = _dialogState._nextId++;
    _dialogState.toasts.push({ id, tipo: "erro", mensagem });
    _dialogNotify();
    setTimeout(() => {
      _dialogState.toasts = _dialogState.toasts.filter(t => t.id !== id);
      _dialogNotify();
    }, duracao);
  },
};

var dialogo = {
  // Retorna Promise<boolean> — true se confirmou, false se cancelou.
  // Use async/await: const ok = await dialogo.confirmar({...});
  confirmar: (opts) => {
    return new Promise(resolver => {
      const id = _dialogState._nextId++;
      _dialogState.modais.push({
        id,
        tipo: "confirm",
        titulo: opts.titulo || "Confirmar?",
        mensagem: opts.mensagem || "",
        confirmar: opts.confirmar || "Confirmar",
        cancelar: opts.cancelar || "Cancelar",
        destrutivo: !!opts.destrutivo,
        resolver,
      });
      _dialogNotify();
    });
  },
  // Retorna Promise<void> — resolve quando usuário clica OK.
  alertar: (opts) => {
    return new Promise(resolver => {
      const id = _dialogState._nextId++;
      _dialogState.modais.push({
        id,
        tipo: "alert",
        titulo: opts.titulo || "",
        mensagem: opts.mensagem || "",
        confirmar: opts.confirmar || "OK",
        tipoAlert: opts.tipo || "info", // info | erro | sucesso | aviso
        resolver,
      });
      _dialogNotify();
    });
  },
};

// Host React: renderiza modais e toasts. Deve ser montado UMA VEZ
// no topo da app (app.jsx, dentro do root mas independente das telas).
function DialogosHost() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const fn = () => forceRender(n => n + 1);
    _dialogState.listeners.add(fn);
    return () => { _dialogState.listeners.delete(fn); };
  }, []);

  function fecharModal(id, valor) {
    const m = _dialogState.modais.find(x => x.id === id);
    if (!m) return;
    _dialogState.modais = _dialogState.modais.filter(x => x.id !== id);
    _dialogNotify();
    if (m.resolver) m.resolver(valor);
  }

  // Suporte a ESC pra fechar modal ativo (cancela em confirm, fecha em alert)
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== "Escape") return;
      const m = _dialogState.modais[_dialogState.modais.length - 1];
      if (!m) return;
      fecharModal(m.id, m.tipo === "confirm" ? false : undefined);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const modais = _dialogState.modais;
  const toasts = _dialogState.toasts;
  const modalTopo = modais[modais.length - 1] || null;

  const coresAlert = {
    info:    { borda: "#e5e7eb", texto: "#111" },
    sucesso: { borda: "#bbf7d0", texto: "#15803d" },
    erro:    { borda: "#fecaca", texto: "#b91c1c" },
    aviso:   { borda: "#fde68a", texto: "#b45309" },
  };

  return (
    <>
      {/* Modal ativo — só renderiza o último da fila (topo) */}
      {modalTopo && (
        <div
          onClick={() => fecharModal(modalTopo.id, modalTopo.tipo === "confirm" ? false : undefined)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 100000,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
            fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif",
            animation: "vickeDialogFade 0.15s ease",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff",
              border: `1px solid ${modalTopo.tipo === "alert" ? (coresAlert[modalTopo.tipoAlert]?.borda || "#e5e7eb") : "#e5e7eb"}`,
              borderRadius: 12,
              padding: "24px 28px",
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
              animation: "vickeDialogPop 0.18s cubic-bezier(0.2, 0.7, 0.3, 1.1)",
            }}
          >
            {modalTopo.titulo && (
              <div style={{
                fontSize: 15,
                fontWeight: 700,
                color: modalTopo.tipo === "alert" ? (coresAlert[modalTopo.tipoAlert]?.texto || "#111") : "#111",
                marginBottom: modalTopo.mensagem ? 10 : 18,
              }}>
                {modalTopo.titulo}
              </div>
            )}
            {modalTopo.mensagem && (
              <div style={{
                fontSize: 13.5,
                color: "#4b5563",
                lineHeight: 1.55,
                marginBottom: 20,
                whiteSpace: "pre-wrap",
              }}>
                {modalTopo.mensagem}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              {modalTopo.tipo === "confirm" && (
                <button
                  onClick={() => fecharModal(modalTopo.id, false)}
                  style={{
                    background: "#fff",
                    color: "#6b7280",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: "8px 18px",
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {modalTopo.cancelar}
                </button>
              )}
              <button
                autoFocus
                onClick={() => fecharModal(modalTopo.id, modalTopo.tipo === "confirm" ? true : undefined)}
                style={{
                  background: modalTopo.destrutivo ? "#dc2626" : "#111",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 20px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {modalTopo.confirmar}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts — pilha no canto superior direito. Recente embaixo. */}
      {toasts.length > 0 && (
        <div style={{
          position: "fixed",
          top: 20,
          right: 20,
          zIndex: 100001,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif",
          pointerEvents: "none",
        }}>
          {toasts.map(t => (
            <div
              key={t.id}
              style={{
                background: "#fff",
                border: `1px solid ${t.tipo === "sucesso" ? "#bbf7d0" : "#fecaca"}`,
                borderLeft: `4px solid ${t.tipo === "sucesso" ? "#16a34a" : "#dc2626"}`,
                borderRadius: 8,
                padding: "10px 14px 10px 12px",
                fontSize: 13,
                color: t.tipo === "sucesso" ? "#15803d" : "#b91c1c",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                minWidth: 240,
                maxWidth: 360,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 500,
                animation: "vickeToastSlide 0.24s cubic-bezier(0.2, 0.7, 0.3, 1.1)",
                pointerEvents: "auto",
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>
                {t.tipo === "sucesso" ? "✓" : "⚠"}
              </span>
              <span>{t.mensagem}</span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes vickeDialogFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes vickeDialogPop {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes vickeToastSlide {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// VERSION WATCHER — detecta novos deploys e avisa o usuário
// ═══════════════════════════════════════════════════════════════
// Problema resolvido: mesmo com vercel.json definindo no-cache pro HTML,
// uma sessão aberta há horas continua rodando o JS antigo. Quando o master
// faz npm run cpush, quem está com a app aberta não vê as mudanças até dar
// F5 — e pode cair em bugs como "escritório não aparece no PDF" porque
// o JS em memória não sabe da nova coluna que o backend já espera.
//
// Como funciona:
// 1. No boot, captura o hash do bundle principal (ex: "index-Bkt6z0GT.js")
//    lendo a própria <script type="module" src="/assets/index-XXXX.js"> do HTML.
// 2. A cada 5 min, faz fetch("/?v=timestamp") pra forçar bypass de cache
//    intermediário, lê o HTML retornado, extrai o hash atual do bundle.
// 3. Se o hash mudou → mostra banner persistente com botão "Atualizar".
//    O usuário clica → location.reload() com bypass de cache.
//
// Não reload automático: pode perder trabalho não salvo do usuário.
// Notificação + ação manual é o equilíbrio entre segurança e agilidade.
//
// IGNORA erros de rede silenciosamente: se o usuário está offline,
// o próximo check acaba funcionando. Não queremos poluir com avisos.
// ═══════════════════════════════════════════════════════════════

function _extrairHashBundle(htmlOuDoc) {
  // Aceita documento atual (document) ou string HTML crua do fetch.
  // Padrão: <script type="module" crossorigin src="/assets/index-HASH.js">
  // ou <script type="module" src="/assets/index-HASH.js">
  try {
    let src = "";
    if (typeof htmlOuDoc === "string") {
      const m = htmlOuDoc.match(/<script[^>]*src=["']([^"']*\/assets\/index-[^"']+\.js)["']/);
      src = m ? m[1] : "";
    } else {
      // document atual: procura a tag script que referenciou o bundle
      const scripts = htmlOuDoc.querySelectorAll('script[src*="/assets/index-"]');
      src = scripts.length > 0 ? scripts[0].getAttribute("src") : "";
    }
    if (!src) return null;
    // Extrai só o hash: "/assets/index-Bkt6z0GT.js" → "Bkt6z0GT"
    const h = src.match(/index-([^.]+)\.js/);
    return h ? h[1] : null;
  } catch {
    return null;
  }
}

function VersionWatcher() {
  const [novaVersao, setNovaVersao] = useState(false);
  const hashAtualRef = useRef(null);

  // Limpa o param `_v` da URL se ele existir.
  // Esse param é adicionado pelo botão "Atualizar" deste mesmo componente
  // como cache-buster do reload — depois do reload, ele fica grudado na
  // URL/histórico, o que é feio e desnecessário. Remove silenciosamente
  // sem disparar nova navegação (history.replaceState).
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.has("_v")) {
        u.searchParams.delete("_v");
        const novaUrl = u.pathname + (u.searchParams.toString() ? "?" + u.searchParams.toString() : "") + u.hash;
        window.history.replaceState({}, "", novaUrl);
      }
    } catch {
      // URL inválida ou ambiente sem history API — ignora silenciosamente
    }
  }, []);

  useEffect(() => {
    // Captura hash inicial do bundle que está rodando agora
    hashAtualRef.current = _extrairHashBundle(document);

    // Se não conseguiu capturar (ex: dev mode sem bundling), desiste silenciosamente
    if (!hashAtualRef.current) return;

    let cancelado = false;

    async function verificar() {
      if (cancelado) return;
      try {
        // Query string quebra cache intermediário — garante que pegamos
        // o HTML mais novo do Vercel, não de proxy/CDN
        const res = await fetch("/?_vck=" + Date.now(), { cache: "no-store" });
        if (!res.ok) return;
        const html = await res.text();
        const hashRemoto = _extrairHashBundle(html);
        if (hashRemoto && hashRemoto !== hashAtualRef.current) {
          setNovaVersao(true);
        }
      } catch {
        // Rede caiu, etc. Ignora — próximo tick tenta de novo.
      }
    }

    // Primeira checagem 30s depois do boot (evita correr na hora do load)
    const t0 = setTimeout(verificar, 30_000);
    // Depois, a cada 5 minutos
    const interval = setInterval(verificar, 5 * 60 * 1000);

    // Re-checa quando a aba volta a ficar visível (usuário voltou depois de
    // horas, muito comum em SaaS) — a 5-min interval pode ter pulado checagem
    function onVisibility() { if (document.visibilityState === "visible") verificar(); }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelado = true;
      clearTimeout(t0);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!novaVersao) return null;

  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 100002, // acima de toasts (100001) e modais (100000)
        background: "#111",
        color: "#fff",
        padding: "14px 18px",
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif",
        fontSize: 13,
        animation: "vickeToastSlide 0.28s cubic-bezier(0.2, 0.7, 0.3, 1.1)",
        maxWidth: 360,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>Nova versão disponível</div>
        <div style={{ fontSize: 12, color: "#d1d5db" }}>Atualize para ver as últimas melhorias.</div>
      </div>
      <button
        onClick={() => {
          // reload(true) é deprecated — cache-busting via query string funciona
          const u = new URL(window.location.href);
          u.searchParams.set("_v", Date.now());
          window.location.href = u.toString();
        }}
        style={{
          background: "#fff",
          color: "#111",
          border: "none",
          borderRadius: 7,
          padding: "7px 14px",
          fontSize: 12.5,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
        }}
      >
        Atualizar
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SESSION COORDINATOR — múltiplas abas, mesma origem
// ═══════════════════════════════════════════════════════════════
// Problema: localStorage é compartilhado entre TODAS as abas do mesmo
// domínio. Quando o usuário faz login na Aba B, o token salvo na Aba A
// é sobrescrito. Aba A continua com state em memória apontando pra
// usuário antigo, mas qualquer F5 ou bootstrap puxa o novo token →
// inconsistência (UI diz X, backend trata como Y).
//
// Solução: BroadcastChannel (API moderna, suportada em todos browsers
// relevantes) pra coordenar abas em tempo real. Quando uma aba muda
// estado de auth, todas as outras são notificadas e reagem:
//
// - Login com USUÁRIO IGUAL: aba antiga atualiza token silenciosamente.
//   Caso comum quando alguém abre uma 2ª aba pra "trabalhar em paralelo".
//   Sem fricção, sem reload — mesma sessão, token novo válido.
//
// - Login com USUÁRIO DIFERENTE: aba antiga mostra modal "Sessão alterada"
//   e força reload. Inevitável: a sessão atual não é mais válida pra
//   usuário X, e continuar usando geraria erros 403 imprevisíveis.
//
// - Logout: outras abas mostram "Você foi desconectado" e recarregam
//   (caem na tela de login).
//
// - Storage event como fallback: caso BroadcastChannel falhe (rara),
//   o evento `storage` do localStorage também dispara entre abas.
//
// O "líder" (aba atual) NÃO recebe mensagens que ela própria envia —
// API garante isso, então não há eco/loop.
// ═══════════════════════════════════════════════════════════════

const _SESSION_CHANNEL_NAME = "vicke-session";
let _sessionChannel = null;

function _getSessionChannel() {
  if (typeof BroadcastChannel === "undefined") return null;
  if (_sessionChannel) return _sessionChannel;
  try {
    _sessionChannel = new BroadcastChannel(_SESSION_CHANNEL_NAME);
  } catch {
    _sessionChannel = null;
  }
  return _sessionChannel;
}

// Anuncia evento de sessão pras outras abas. Chamar APÓS já ter
// atualizado localStorage (as outras abas vão ler de lá pra atualizar).
function anunciarSessao(tipo, payload) {
  const ch = _getSessionChannel();
  if (!ch) return;
  try {
    ch.postMessage({ tipo, payload, ts: Date.now() });
  } catch { /* canal pode estar fechado, ignora */ }
}

// Hook que aba consumidora usa pra reagir a mudanças vindas de outras abas.
// onOutroUsuario: outra aba logou com user diferente → exibir modal + reload
// onMesmoUsuario: outra aba logou com user igual → atualizar token em memória
// onLogout: outra aba fez logout → exibir modal "desconectado" + reload
function useSessionCoordinator({ usuarioAtual, onOutroUsuario, onMesmoUsuario, onLogout }) {
  useEffect(() => {
    const ch = _getSessionChannel();
    if (!ch) return; // browser sem BroadcastChannel — fallback storage event abaixo

    function handleMessage(ev) {
      const msg = ev.data || {};
      if (!msg.tipo) return;

      if (msg.tipo === "login") {
        const novoUserId = msg.payload?.userId;
        const usuarioIdAtual = usuarioAtual?.id;
        // Sem usuário em memória ainda? Não é nosso problema — ainda na tela de login
        if (!usuarioIdAtual) return;
        if (novoUserId === usuarioIdAtual) {
          onMesmoUsuario && onMesmoUsuario(msg.payload);
        } else {
          onOutroUsuario && onOutroUsuario(msg.payload);
        }
      } else if (msg.tipo === "logout") {
        // Só reagir se a aba atual estava logada
        if (usuarioAtual?.id) {
          onLogout && onLogout();
        }
      }
    }

    ch.addEventListener("message", handleMessage);

    // Fallback: evento `storage` do localStorage. Dispara em outras abas
    // quando o valor de uma chave muda. Útil se BroadcastChannel falhar
    // ou se o navegador for muito antigo.
    function handleStorage(ev) {
      if (ev.key !== "vicke-token" && ev.key !== "vicke-user") return;
      // Token foi removido em outra aba (logout)
      if (ev.key === "vicke-token" && !ev.newValue && usuarioAtual?.id) {
        onLogout && onLogout();
        return;
      }
      // User mudou em outra aba → comparar IDs
      if (ev.key === "vicke-user" && ev.newValue && usuarioAtual?.id) {
        try {
          const novoUser = JSON.parse(ev.newValue);
          if (novoUser?.id && novoUser.id !== usuarioAtual.id) {
            onOutroUsuario && onOutroUsuario({ userId: novoUser.id });
          } else if (novoUser?.id === usuarioAtual.id) {
            onMesmoUsuario && onMesmoUsuario({ userId: novoUser.id });
          }
        } catch { /* JSON ruim, ignora */ }
      }
    }
    window.addEventListener("storage", handleStorage);

    return () => {
      ch.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
    };
  }, [usuarioAtual?.id, onOutroUsuario, onMesmoUsuario, onLogout]);
}
