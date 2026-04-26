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

var INDICE_PADRAO = { Alto:0.5, Médio:0.2, Baixo:-0.2 };
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
