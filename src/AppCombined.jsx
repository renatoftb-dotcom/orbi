// ════════════════════════════════════════════════════════════
// shared.jsx
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// Carrega jsPDF e html2canvas
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


// ═══════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════
var DB = {
  get: async (key) => {
    // Tenta window.storage primeiro, depois localStorage como fallback
    try {
      const r = await window.storage.get(key);
      if (r?.value) {
        const parsed = JSON.parse(r.value);
        // Sincroniza com localStorage
        try { localStorage.setItem(key, r.value); } catch {}
        return parsed;
      }
    } catch {}
    // Fallback: localStorage (persiste entre sessões do mesmo navegador)
    try {
      const local = localStorage.getItem(key);
      if (local) return JSON.parse(local);
    } catch {}
    return null;
  },
  set: async (key, val) => {
    const str = JSON.stringify(val);
    // Salva em ambos
    try { await window.storage.set(key, str); } catch {}
    try { localStorage.setItem(key, str); } catch {}
    return true;
  }
};

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

  // Gera faixas dinamicamente
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

  // Faixas seguintes de 100m² com desconto composto (máximo 50% de desconto)
  let faixaNum = 1;
  while (areaRestante > 0) {
    const limiteAtual = limiteAnterior + 100;
    const desconto = limiteAnterior < 600 ? DESCONTO_ATE_600 : DESCONTO_APOS_600;
    fatorAtual = Math.max(0.5, fatorAtual * (1 - desconto)); // mínimo fator 0.5 = máx 50% desconto
    const areaFaixa = Math.min(areaRestante, 100);
    const preco = areaFaixa * precoM2 * fatorAtual;
    faixas.push({
      de: limiteAnterior, ate: limiteAnterior + areaFaixa,
      area: areaFaixa, fator: fatorAtual,
      desconto: Math.round((1 - fatorAtual) * 1000) / 10, // % acumulado
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
// COMERCIAL — comodos por bloco
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
// ═══════════════════════════════════════════════════════════════
var SEED = {
  "clientes": [
    {"id":"c1","tipo":"PF","nome":"Ricardo Almeida","cpfCnpj":"123.456.789-00","email":"ricardo@email.com","cep":"01310-100","logradouro":"Av. Paulista","numero":"1000","complemento":"Apto 52","bairro":"Bela Vista","cidade":"São Paulo","estado":"SP","contatos":[{"id":"ct1","nome":"Ricardo","telefone":"(11) 99234-5678","cargo":"Proprietário","whatsapp":true}],"observacoes":"Cliente VIP, obras de alto padrão.","ativo":true,"desde":"2023-05-10","servicos":{"projeto":true,"acompanhamentoObra":true,"gestaoObra":false,"empreendimento":false}},
    {"id":"c2","tipo":"PJ","nome":"Construtora Horizonte Ltda","cpfCnpj":"12.345.678/0001-90","email":"contato@horizonte.com","cep":"01310-200","logradouro":"Av. Paulista","numero":"1200","complemento":"Sala 301","bairro":"Bela Vista","cidade":"São Paulo","estado":"SP","contatos":[{"id":"ct2","nome":"Ana Souza","telefone":"(11) 3456-7890","cargo":"Diretora","whatsapp":false},{"id":"ct3","nome":"Carlos Lima","telefone":"(11) 98765-4321","cargo":"Engenheiro","whatsapp":true}],"observacoes":"Incorporadora com foco em alto padrão comercial.","ativo":true,"desde":"2022-01-15","servicos":{"projeto":true,"acompanhamentoObra":false,"gestaoObra":false,"empreendimento":false}},
    {"id":"0dqq9g5","tipo":"PF","nome":"Renato Fernandes Teixeira de Barros","cpfCnpj":"29796602806","email":"renatoftb@gmail.com","cep":"19910090","logradouro":"Rua Sebastião Simeão de Souza","numero":"205","complemento":"Casa 06","bairro":"Jardim Santa Fé","cidade":"Ourinhos","estado":"SP","contatos":[{"id":"llu6djh","nome":"Renato Fernandes Teixeira de Barros","telefone":"14998528593","cargo":"Marido","whatsapp":true}],"observacoes":"","ativo":true,"desde":"2026-03-09","servicos":{"projeto":true,"acompanhamentoObra":false,"gestaoObra":false,"empreendimento":false}},
    {"id":"2wbid3d","tipo":"PF","nome":"Rodrigo Redondo","cpfCnpj":"29796602806","email":"renatoftb@gmail.com","cep":"19910090","logradouro":"Rua Sebastião Simeão de Souza","numero":"205","complemento":"Casa 06","bairro":"Jardim Santa Fé","cidade":"Ourinhos","estado":"SP","contatos":[{"id":"2ublk9f","nome":"Renato Barros","telefone":"14998528593","cargo":"Prestador de serviços","whatsapp":true}],"observacoes":"Médico","ativo":true,"desde":"2026-03-11","servicos":{"projeto":true,"acompanhamentoObra":false,"gestaoObra":false,"empreendimento":false}},
    {"id":"0lfdgf0","tipo":"PF","nome":"Talita Melo","cpfCnpj":"29796602806","email":"","cep":"","logradouro":"","numero":"","complemento":"","bairro":"","cidade":"","estado":"SP","contatos":[{"id":"v8l4y2h","nome":"Talita Melo","telefone":"14998528593","cargo":"Clinete","whatsapp":false}],"observacoes":"","ativo":true,"desde":"2026-03-27","servicos":{"projeto":true,"acompanhamentoObra":false,"gestaoObra":false,"empreendimento":false}},
    {"id":"h6d5p5e","tipo":"PF","nome":"Rodrigo Macedo","cpfCnpj":"29796602806","email":"","cep":"","logradouro":"","numero":"","complemento":"","bairro":"","cidade":"","estado":"SP","contatos":[{"id":"4ifddtz","nome":"Rodrigo Macedo","telefone":"14998528593","cargo":"Cliente","whatsapp":true}],"observacoes":"","ativo":true,"desde":"2026-03-28","servicos":{"projeto":false,"acompanhamentoObra":false,"gestaoObra":false,"empreendimento":false}}
  ],
  "fornecedores": [
    {"id":"f1","nome":"Leroy Merlin","cnpj":"00.000.001/0001-00","email":"compras@leroy.com","telefone":"(11) 3000-1000","categorias":["Geral","Ferramentas","Acabamento"],"prazoEntrega":3,"condicoesPagamento":"30/60/90 dias","rating":4,"contatos":[{"id":"cf1","nome":"Vendas","telefone":"(11) 3000-1001","cargo":"Vendas","whatsapp":false}],"observacoes":"Bom para material de acabamento e ferramentas.","ativo":true,"historicoPrecosIds":["m1","m3"]},
    {"id":"f2","nome":"Votorantim Cimentos","cnpj":"00.000.002/0001-00","email":"vendas@votorantim.com","telefone":"(11) 3000-2000","categorias":["Cimento","Concreto","Agregados"],"prazoEntrega":5,"condicoesPagamento":"28 dias","rating":5,"contatos":[{"id":"cf2","nome":"João Pedro","telefone":"(11) 99000-1111","cargo":"Representante","whatsapp":true}],"observacoes":"Melhor fornecedor de cimento.","ativo":true,"historicoPrecosIds":["m1"]},
    {"id":"f3","nome":"Elgin Materiais","cnpj":"00.000.003/0001-00","email":"elgin@email.com","telefone":"(11) 3000-3000","categorias":["Elétrico","Hidráulico"],"prazoEntrega":2,"condicoesPagamento":"À vista 5% desconto / 30 dias","rating":3,"contatos":[{"id":"cf3","nome":"Suporte","telefone":"(11) 3000-3001","cargo":"Atendimento","whatsapp":false}],"observacoes":"Entrega rápida.","ativo":true,"historicoPrecosIds":["m5"]}
  ],
  "materiais": [
    {"id":"m1","nome":"Cimento CP-II 50kg","unidade":"sc","categoria":"Cimento","ultimoPreco":42.9,"fornecedorId":"f2"},
    {"id":"m2","nome":"Areia média","unidade":"m³","categoria":"Agregados","ultimoPreco":180,"fornecedorId":"f1"},
    {"id":"m3","nome":"Tijolo cerâmico 9furos","unidade":"un","categoria":"Alvenaria","ultimoPreco":1.2,"fornecedorId":"f1"},
    {"id":"m4","nome":"Ferro CA-50 10mm","unidade":"kg","categoria":"Estrutura","ultimoPreco":8.5,"fornecedorId":"f1"},
    {"id":"m5","nome":"Fio elétrico 2,5mm","unidade":"m","categoria":"Elétrico","ultimoPreco":3.8,"fornecedorId":"f3"}
  ],
  "lancamentos": [
    {"id":"l1","obraId":"o1","materialId":"m1","fornecedorId":"f2","quantidade":200,"valorUnit":42.9,"total":8580,"data":"2024-11-05","etapa":"Fundação","nf":"NF-00123","pago":true},
    {"id":"l2","obraId":"o1","materialId":"m2","fornecedorId":"f1","quantidade":30,"valorUnit":180,"total":5400,"data":"2024-11-12","etapa":"Fundação","nf":"NF-00156","pago":true},
    {"id":"l3","obraId":"o2","materialId":"m1","fornecedorId":"f2","quantidade":800,"valorUnit":42.9,"total":34320,"data":"2024-11-20","etapa":"Fundação","nf":"NF-00178","pago":true}
  ],
  "obras": [
    {"id":"o1","nome":"Residência Almeida","clienteId":"c1","status":"Em andamento","orcamento":450000},
    {"id":"o2","nome":"Ed. Horizonte Tower","clienteId":"c2","status":"Em andamento","orcamento":2800000}
  ],
  "orcamentosProjeto": [
    {"id":"rosxc12","clienteId":"0dqq9g5","cliente":"Renato Fernandes Teixeira de Barros","whatsapp":"14998528593","tipo":"Residencial","subtipo":"Construção nova","padrao":"Alto","tipologia":"Térrea","tamanho":"Grande","precoBase":"45","repeticao":true,"nUnidades":"10","estacCoberto":true,"comodos":[{"nome":"Garagem","qtd":2},{"nome":"Hall de entrada","qtd":2},{"nome":"Sala TV","qtd":1},{"nome":"Living","qtd":1},{"nome":"Cozinha","qtd":1},{"nome":"Piscina","qtd":1},{"nome":"Suíte","qtd":2},{"nome":"Closet Suíte","qtd":2},{"nome":"Suíte Master","qtd":1}],"resultado":{"areaBruta":442.39,"areaPiscina":21,"areaTotal":552.99,"precoFinal":51342.53,"precoTotal":130923.44,"nUnidades":10,"engTotal":24623.43},"criadoEm":"2026-03-13T13:27:51.479Z"},
    {"id":"2q5j4k4","clienteId":"c1","cliente":"Ricardo Almeida","whatsapp":"(11) 99234-5678","tipo":"Residencial","subtipo":"Construção nova","padrao":"Alto","tipologia":"Térreo","tamanho":"Médio","precoBase":45,"repeticao":false,"nUnidades":1,"comodos":[{"nome":"Garagem","qtd":2},{"nome":"Living","qtd":1},{"nome":"Piscina","qtd":1},{"nome":"Suíte","qtd":3},{"nome":"Suíte Master","qtd":1}],"resultado":{"areaBruta":240.95,"areaPiscina":15,"areaTotal":301.19,"precoFinal":26319.03,"precoTotal":26319.03,"nUnidades":1,"engTotal":14650.26},"criadoEm":"2026-03-10T22:48:27.174Z"},
    {"id":"gozge26","clienteId":"2wbid3d","cliente":"Rodrigo Redondo","whatsapp":"14998528593","tipo":"Clínica","subtipo":"Construção nova","padrao":"Alto","tipologia":"Térreo","tamanho":"Médio","precoBase":45,"repeticao":false,"nUnidades":1,"comodos":[{"nome":"Estacionamento","qtd":2},{"nome":"Recepção","qtd":1},{"nome":"Consultórios","qtd":3},{"nome":"Salas de Procedimento","qtd":2}],"resultado":{"areaBruta":184.45,"areaPiscina":31.2,"areaTotal":230.56,"precoFinal":27872.04,"precoTotal":27872.04,"nUnidades":1,"engTotal":11405.88},"criadoEm":"2026-03-13T13:37:56.131Z","status":"ganho"},
    {"id":"zo6bgop","clienteId":"c2","cliente":"Construtora Horizonte Ltda","whatsapp":"(11) 98765-4321","tipo":"Clínica","subtipo":"Construção nova","padrao":"Baixo","tipologia":"Térreo","tamanho":"Médio","precoBase":32,"repeticao":false,"nUnidades":1,"comodos":[{"nome":"Estacionamento","qtd":2},{"nome":"Recepção","qtd":1},{"nome":"Consultórios","qtd":3}],"resultado":{"areaBruta":181.05,"areaPiscina":31.2,"areaTotal":226.31,"precoFinal":14661.20,"precoTotal":14661.20,"nUnidades":1,"engTotal":11210.38},"criadoEm":"2026-03-12T19:00:19.912Z"},
    {"id":"nkxbmoe","clienteId":"0dqq9g5","cliente":"Renato Fernandes Teixeira de Barros","whatsapp":"14998528593","tipo":"Galeria","subtipo":"Construção nova","padrao":"Médio","tipologia":"Térreo","tamanho":"Médio","precoBase":45,"nLojas":15,"nAncoras":3,"nApartamentos":2,"repeticao":false,"nUnidades":1,"estacCoberto":true,"comodos":[{"nome":"Área de vendas (térrea)","qtd":1},{"nome":"Mezanino","qtd":1}],"resultado":{"tipo":"Galeria","areaBruta":3285.07,"areaTotal":4106.34,"nLojas":15,"nAncoras":3,"nApartamentos":2,"precoFinal":116431.84,"precoTotal":116431.84,"engTotal":115390.75},"criadoEm":"2026-03-27T15:09:32.526Z"},
    {"id":"hrjrq63","clienteId":"0lfdgf0","cliente":"Talita Melo","whatsapp":"","tipo":"Residencial","subtipo":"Construção nova","padrao":"Médio","tipologia":"Sobrado","tamanho":"Médio","precoBase":45,"repeticao":false,"nUnidades":1,"comodos":[{"nome":"Hall de entrada","qtd":1},{"nome":"Sala TV","qtd":1},{"nome":"Living","qtd":1},{"nome":"Escada","qtd":1}],"resultado":{"areaBruta":59.05,"areaPiscina":0,"areaTotal":73.81,"precoFinal":4683.40,"precoTotal":4683.40,"nUnidades":1,"engTotal":3690.63},"criadoEm":"2026-03-27T21:36:29.489Z","status":null},
    {"id":"14b7hqs","clienteId":"0lfdgf0","cliente":"Talita Melo","whatsapp":"","tipo":"Clínica","subtipo":"Construção nova","padrao":"Médio","tipologia":"Sobrado","tamanho":"Médio","precoBase":32,"repeticao":false,"nUnidades":1,"comodos":[{"nome":"Estacionamento","qtd":1},{"nome":"Recepção","qtd":1},{"nome":"Wcs","qtd":1},{"nome":"Escada","qtd":1}],"resultado":{"areaBruta":92.99,"areaPiscina":0,"areaTotal":116.24,"precoFinal":6271.33,"precoTotal":6271.33,"nUnidades":1,"engTotal":5811.88},"criadoEm":"2026-03-27T22:55:11.105Z"},
    {"id":"s9o0oai","clienteId":"0lfdgf0","cliente":"Talita Melo","whatsapp":"","tipo":"Galeria","subtipo":"Construção nova","padrao":"Médio","tipologia":"Sobrado","tamanho":"Médio","precoBase":45,"nLojas":9,"nAncoras":0,"nApartamentos":0,"repeticao":false,"nUnidades":1,"estacCoberto":true,"comodos":[{"nome":"Área de vendas (térrea)","qtd":1},{"nome":"Mezanino","qtd":1},{"nome":"Banheiro","qtd":1},{"nome":"Copa","qtd":1}],"resultado":{"tipo":"Galeria","areaBruta":709.56,"areaTotal":886.95,"nLojas":9,"nAncoras":0,"nApartamentos":0,"precoFinal":20731.35,"precoTotal":20731.35,"engTotal":36189.21},"criadoEm":"2026-03-27T22:40:49.651Z"}
  ],
  "escritorio": {
    "nome": "Padovan Arquitetos",
    "cnpj": "36.122.417/0001-74",
    "email": "Leopadovan.arq@gmail.com",
    "telefone": "14 99767-4200",
    "endereco": "Rua Augusto Fernandes Alonso, 344, Jardim Paulista",
    "cidade": "Ourinhos",
    "estado": "SP",
    "responsavel": "",
    "cau": "",
    "cpfResponsavel": "",
    "site": "www.padovanarquitetos.com.br",
    "instagram": "@padovan_arquitetos",
    "banco": "Sicoob",
    "agencia": "4399",
    "conta": "3893-8",
    "tipoConta": "Corrente",
    "pixTipo": "CNPJ",
    "pixChave": "36.122.417/0001-74",
    "equipe": [
      {"id":"otrfpw8","nome":"Leonardo Diba Gonçalves Padovan","cargo":"Arquiteto","email":"Leopadovan.arq@gmail.com","telefone":"14910058050","cau":"A30278-3","cpf":"25264255814","rg":"18346127","nascimento":"1975-06-17","admissao":"2010-06-22","endereco":"Rua Augusto Fernandes Alonso 344 Jardim Paulista","cidade":"Ourinhos","estado":"SP","cep":"19910090"},
      {"id":"ixq3jhj","nome":"Victor Minucci","cargo":"Arquiteto","email":"renatoftb@gmail.com","telefone":"14998528593","cau":"452587","cpf":"29796602806","rg":"305937704","nascimento":"2026-03-05","admissao":"2026-03-12","endereco":"Rua vicente oropallo 52","cidade":"Ourinhos","estado":"SP","cep":"19910090"}
    ],
    "responsaveis": [
      {"id":"iqkvj7i","nome":"Leonardo Diba Gonçalves Padovan","cau":"A30278-3","cpf":"25264255814"}
    ]
  },
  "receitasFinanceiro": []
};

var ESTADOS_BR = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
var CATS_FORNECEDOR = ["Cimento","Concreto","Agregados","Alvenaria","Estrutura","Cobertura","Elétrico","Hidráulico","Revestimento","Acabamento","Ferramentas","Tintas","Vidros","Geral","Outros"];


// ════════════════════════════════════════════════════════════
// api.js
// ════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// ORBI — API Client
// Substitui o DB (localStorage/window.storage) pelo backend real
// ═══════════════════════════════════════════════════════════════

const API_URL = "http://localhost:3000";

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




// ════════════════════════════════════════════════════════════
// outros.jsx
// ════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// FORNECEDORES
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// MÓDULO PROJETOS
// ═══════════════════════════════════════════════════════════════
function Projetos({ data, save }) {
  const projetos = data.projetos || [];
  const clientes = data.clientes || [];

  const ETAPAS = [
    { key:"estudo",     label:"Estudo Preliminar",    cor:"#f59e0b" },
    { key:"aprovacao",  label:"Aprovação Prefeitura", cor:"#ef4444" },
    { key:"executivo",  label:"Projeto Executivo",    cor:"#10b981" },
    { key:"reuniao",    label:"Reunião de Obra",      cor:"#7c3aed" },
  ];

  const STATUS = [
    { key:"nao_iniciada", label:"Não Iniciada", cor:"#475569" },
    { key:"em_andamento", label:"Em Andamento", cor:"#3b82f6" },
    { key:"concluida",    label:"Concluída",    cor:"#10b981" },
  ];

  return (
    <div style={{ padding:"32px 28px" }}>
      {/* Cabeçalho */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontWeight:900, fontSize:22, margin:0 }}>📐 Projetos</h2>
          <p style={{ color:"#64748b", fontSize:13, marginTop:4 }}>Gestão de projetos e etapas</p>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button style={{ background:"#1e3a5f", color:"#60a5fa", border:"1px solid #2563eb", borderRadius:8, padding:"8px 16px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            + Novo Projeto
          </button>
        </div>
      </div>

      {/* Em construção */}
      <div style={{ background:"#0d1526", border:"1px solid #1e293b", borderRadius:12, padding:"60px 32px", textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>📐</div>
        <div style={{ color:"#f1f5f9", fontWeight:700, fontSize:18, marginBottom:8 }}>Módulo Projetos</div>
        <div style={{ color:"#64748b", fontSize:14, marginBottom:32, maxWidth:480, margin:"0 auto 32px" }}>
          Este módulo está sendo estruturado. Em breve você poderá gerenciar projetos por colaborador ou cliente, com controle de etapas, prazos e status.
        </div>

        {/* Preview das funcionalidades */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, maxWidth:700, margin:"0 auto" }}>
          {[
            { icon:"👥", label:"Por Colaborador", desc:"Visualize projetos agrupados por responsável" },
            { icon:"🗂", label:"Por Cliente", desc:"Visualize projetos agrupados por cliente" },
            { icon:"📋", label:"Etapas", desc:"Estudo Preliminar · Aprovação · Executivo · Obra" },
          ].map(f => (
            <div key={f.label} style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:10, padding:"20px 16px" }}>
              <div style={{ fontSize:28, marginBottom:10 }}>{f.icon}</div>
              <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:13, marginBottom:6 }}>{f.label}</div>
              <div style={{ color:"#475569", fontSize:12 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Etapas disponíveis */}
        <div style={{ marginTop:32, display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
          {ETAPAS.map(e => (
            <div key={e.key} style={{ background:e.cor+"22", border:`1px solid ${e.cor}`, borderRadius:6, padding:"5px 14px", color:e.cor, fontSize:12, fontWeight:600 }}>
              {e.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO OBRAS
// ═══════════════════════════════════════════════════════════════
function Obras({ data, save }) {
  return (
    <div style={{ padding:"32px 28px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontWeight:900, fontSize:22, margin:0 }}>🏗 Obras</h2>
          <p style={{ color:"#64748b", fontSize:13, marginTop:4 }}>Gestão, acompanhamento e execução de obras</p>
        </div>
        <button style={{ background:"#1e3a5f", color:"#60a5fa", border:"1px solid #2563eb", borderRadius:8, padding:"8px 16px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
          + Nova Obra
        </button>
      </div>

      <div style={{ background:"#0d1526", border:"1px solid #1e293b", borderRadius:12, padding:"60px 32px", textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🏗</div>
        <div style={{ color:"#f1f5f9", fontWeight:700, fontSize:18, marginBottom:8 }}>Módulo Obras</div>
        <div style={{ color:"#64748b", fontSize:14, marginBottom:32, maxWidth:480, margin:"0 auto 32px" }}>
          Módulo em estruturação. Aqui você poderá gerenciar gestão, acompanhamento e execução de obras vinculadas aos clientes.
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, maxWidth:700, margin:"0 auto" }}>
          {[
            { icon:"📋", label:"Gestão de Obra", desc:"Planejamento e controle geral" },
            { icon:"🔍", label:"Acompanhamento", desc:"Visitas técnicas e relatórios" },
            { icon:"⚙", label:"Execução", desc:"Equipes e etapas de execução" },
          ].map(f => (
            <div key={f.label} style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:10, padding:"20px 16px" }}>
              <div style={{ fontSize:28, marginBottom:10 }}>{f.icon}</div>
              <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:13, marginBottom:6 }}>{f.label}</div>
              <div style={{ color:"#475569", fontSize:12 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO FINANCEIRO
// ═══════════════════════════════════════════════════════════════
function Financeiro({ data, save }) {
  const receitas = data.receitasFinanceiro || [];
  const [busca, setBusca]           = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todas");
  const [editDesc, setEditDesc]     = useState(null);
  const [selecionados, setSelecionados] = useState(new Set());
  const [filtroCol, setFiltroCol]   = useState(null);
  const [filtroVals, setFiltroVals] = useState({});

  function exportarCSV() {
    const cols = [
      "Codigo","Cod. Cliente","Nome Cliente","Categoria","Produto","Fornecedor",
      "Descricao","Tipo Conta","Conta Contabil 1","Sub Conta 1","Sub Conta 2",
      "Sub Conta 3","Sub Conta 4","Sub Conta 5",
      "Comprovante","Competencia","Recebimento","Valor",
      "Data Lancamento","Periodo Contabil","Periodo Caixa"
    ];
    const rows = receitas.map(r => [
      r.codigo||"", r.clienteId||"", r.cliente||"", r.categoria||"", r.produto||"", r.fornecedor||"",
      r.descricao||"", r.tipoConta||"", r.contabil1||"", r.subContabil1||"", r.subContabil2||"",
      r.subContabil3||"", r.subContabil4||"", r.subContabil5||"",
      r.nComprovante||"", r.competencia||"", r.recebimento||"", r.valor||0,
      r.dataLancamento||"", r.periodoContabil||"", r.periodoCaixa||""
    ]);
    const esc = v => { const s = String(v).replace(/"/g,'""'); return s.includes(";")||s.includes("\n")||s.includes('"') ? '"'+s+'"' : s; };
    const csv = [cols,...rows].map(row => row.map(esc).join(";")).join("\n");
    const url = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csv);
    const a = document.createElement("a"); a.href=url; a.download="financeiro.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function excluirSelecionados() {
    const novos = receitas.filter((_r, i) => !selecionados.has(i));
    save({...data, receitasFinanceiro: novos});
    setSelecionados(new Set());
  }

  function salvarDesc(idx, novaDesc) {
    const novos = receitas.map((r,i) => i===idx ? {...r, descricao:novaDesc} : r);
    save({...data, receitasFinanceiro: novos});
    setEditDesc(null);
  }

  function valoresUnicos(campo) {
    return [...new Set(receitas.map(r => r[campo]||"").filter(Boolean))].sort();
  }

  function toggleFiltroVal(campo, val) {
    setFiltroVals(prev => {
      const set = new Set(prev[campo] || []);
      if (set.has(val)) set.delete(val); else set.add(val);
      return { ...prev, [campo]: set };
    });
  }

  const fmtV = v => (v||0).toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
  const fmtD = iso => iso ? new Date(iso+"T00:00:00").toLocaleDateString("pt-BR") : "--";

  const totalContabil = receitas.filter(r=>r.contabil1==="Receita Total").reduce((s,r)=>s+(r.valor||0),0);
  const totalCaixa    = receitas.filter(r=>r.contabil1==="Caixa" && r.recebimento==="Recebido").reduce((s,r)=>s+(r.valor||0),0);
  const totalReceber  = receitas.filter(r=>r.contabil1==="Caixa" && r.recebimento==="A Receber").reduce((s,r)=>s+(r.valor||0),0);
  const temFiltroAtivo = Object.values(filtroVals).some(s => s && s.size > 0);

  const lancs = receitas.filter(r => {
    if (filtroTipo==="contabil" && r.contabil1!=="Receita Total") return false;
    if (filtroTipo==="caixa"    && r.contabil1!=="Caixa") return false;
    for (const [campo, set] of Object.entries(filtroVals)) {
      if (set && set.size > 0 && !set.has(r[campo]||"")) return false;
    }
    if (busca) {
      const b = busca.toLowerCase();
      return (r.cliente||"").toLowerCase().includes(b) ||
             (r.descricao||"").toLowerCase().includes(b) ||
             (r.codigo||"").toLowerCase().includes(b);
    }
    return true;
  });

  const thS = { padding:"6px 8px", fontSize:10, fontWeight:600, textTransform:"uppercase",
    letterSpacing:0.4, whiteSpace:"nowrap", color:"#64748b",
    background:"#0a1122", borderBottom:"1px solid #1e293b", textAlign:"left" };
  const tdS = { padding:"6px 8px", fontSize:11, whiteSpace:"nowrap",
    borderBottom:"1px solid #0f172a", color:"#94a3b8" };

  // Colunas filtaveis: [label, campo]
  const COLS_FILTER = [
    ["Categoria","categoria"],["Produto","produto"],["Fornecedor","fornecedor"],
    ["Tipo Conta","tipoConta"],["Conta Contabil 1","contabil1"],
    ["Sub Conta 1","subContabil1"],["Sub Conta 2","subContabil2"],
    ["Competencia","competencia"],["Recebimento","recebimento"],
  ];

  return (
    <div style={{ padding:"24px 20px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontWeight:900, fontSize:22, margin:0 }}>Financeiro</h2>
          <p style={{ color:"#64748b", fontSize:13, marginTop:4 }}>Livro de lancamentos</p>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:20 }}>
        {[
          { label:"Receita Contabil",  v:totalContabil, c:"#3b82f6", sub: receitas.filter(r=>r.contabil1==="Receita Total").length + " lancamentos" },
          { label:"Caixa Recebido",    v:totalCaixa,    c:"#10b981", sub: receitas.filter(r=>r.recebimento==="Recebido").length + " lancamentos" },
          { label:"A Receber",         v:totalReceber,  c:"#f59e0b", sub: receitas.filter(r=>r.recebimento==="A Receber").length + " lancamentos" },
        ].map(c => (
          <div key={c.label} style={{ background:"#0d1526", border:"1px solid #1e293b", borderRadius:10, padding:"16px 20px" }}>
            <div style={{ color:"#64748b", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>{c.label}</div>
            <div style={{ color:c.c, fontWeight:800, fontSize:20 }}>R$ {fmtV(c.v)}</div>
            <div style={{ color:"#334155", fontSize:11, marginTop:4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:"flex", gap:10, marginBottom:12, alignItems:"center", flexWrap:"wrap" }}>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar cliente, codigo, descricao..."
          style={{ background:"#0a1122", border:"1px solid #1e293b", borderRadius:6, color:"#f1f5f9",
            padding:"6px 12px", fontSize:12, outline:"none", fontFamily:"inherit", width:260 }} />
        {[["todas","Todos"],["contabil","Contabil"],["caixa","Caixa"]].map(([v,l]) => (
          <button key={v} onClick={()=>setFiltroTipo(v)}
            style={{ background:filtroTipo===v?"#1e3a5f":"transparent",
              color:filtroTipo===v?"#60a5fa":"#64748b",
              border:"1px solid "+(filtroTipo===v?"#2563eb":"#1e293b"),
              borderRadius:6, padding:"5px 14px", fontSize:11, fontWeight:600,
              cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
        ))}
        <span style={{ color:"#334155", fontSize:11, marginLeft:"auto" }}>{lancs.length} registro{lancs.length!==1?"s":""}</span>
        <button onClick={exportarCSV} disabled={receitas.length===0}
          style={{ background:"#164e2a", border:"1px solid #16a34a", borderRadius:6,
            color:"#4ade80", padding:"5px 14px", fontSize:11, fontWeight:600,
            cursor:receitas.length===0?"not-allowed":"pointer", fontFamily:"inherit", opacity:receitas.length===0?0.4:1 }}>
          Exportar CSV
        </button>
        {selecionados.size > 0 && (
          <button onClick={excluirSelecionados}
            style={{ background:"rgba(248,113,113,0.15)", border:"1px solid #f87171", borderRadius:6,
              color:"#f87171", padding:"5px 14px", fontSize:11, fontWeight:600,
              cursor:"pointer", fontFamily:"inherit" }}>
            Excluir {selecionados.size} selecionado{selecionados.size!==1?"s":""}
          </button>
        )}
        {temFiltroAtivo && (
          <button onClick={()=>setFiltroVals({})}
            style={{ background:"rgba(99,102,241,0.12)", border:"1px solid #6366f1",
              borderRadius:6, color:"#818cf8", padding:"5px 14px", fontSize:11,
              fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            Limpar filtros
          </button>
        )}
      </div>

      {/* Dropdown filtro por coluna */}
      {filtroCol && (
        <div style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:10,
          padding:"14px 16px", maxWidth:280, marginBottom:10, boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ color:"#e2e8f0", fontSize:12, fontWeight:700 }}>Filtrar: {filtroCol.label}</span>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setFiltroVals(prev=>{const n={...prev};delete n[filtroCol.campo];return n;})}
                style={{ background:"transparent", border:"none", color:"#64748b", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                Limpar
              </button>
              <button onClick={()=>setFiltroCol(null)}
                style={{ background:"transparent", border:"none", color:"#64748b", fontSize:16, cursor:"pointer", lineHeight:1 }}>
                x
              </button>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:180, overflowY:"auto" }}>
            {valoresUnicos(filtroCol.campo).map(val => {
              const ativo = filtroVals[filtroCol.campo]?.has(val);
              return (
                <label key={val} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer",
                  padding:"4px 6px", borderRadius:5, background:ativo?"rgba(59,130,246,0.12)":"transparent" }}>
                  <input type="checkbox" checked={!!ativo}
                    onChange={()=>toggleFiltroVal(filtroCol.campo, val)}
                    style={{ accentColor:"#3b82f6", cursor:"pointer" }} />
                  <span style={{ color:ativo?"#60a5fa":"#94a3b8", fontSize:12 }}>{val}</span>
                </label>
              );
            })}
            {valoresUnicos(filtroCol.campo).length===0 && (
              <span style={{ color:"#334155", fontSize:11 }}>Sem valores</span>
            )}
          </div>
        </div>
      )}

      {/* Tabela */}
      {lancs.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 0", color:"#334155" }}>
          <div style={{ fontSize:13 }}>Nenhum lancamento. Confirme orcamentos como Ganho para gerar receitas.</div>
        </div>
      ) : (
        <div style={{ overflowX:"auto", borderRadius:10, border:"1px solid #1e293b" }}>
          <table style={{ borderCollapse:"collapse", width:"100%", minWidth:2000 }}>
            <thead>
              <tr>
                {[
                  ["",1,"#0a1122","#475569"],
                  ["Identificacao",3,"#0a1122","#475569"],
                  ["Partes",4,"#0a1122","#475569"],
                  ["Descricao",1,"#0a1122","#475569"],
                  ["Plano de Contas",8,"#0d1a2e","#60a5fa"],
                  ["Comprovante",2,"#0a1122","#475569"],
                  ["Financeiro",5,"#0a1122","#475569"],
                ].map(([lbl,span,bg,cor])=>(
                  <th key={lbl||"chk"} colSpan={span}
                    style={{...thS,background:bg,color:cor,textAlign:"center",borderRight:"1px solid #1e293b"}}>
                    {lbl}
                  </th>
                ))}
              </tr>
              <tr>
                {/* Checkbox todos */}
                <th style={{...thS, width:36, textAlign:"center"}}>
                  <input type="checkbox"
                    checked={lancs.length>0 && lancs.every(r=>selecionados.has(receitas.indexOf(r)))}
                    onChange={e=>setSelecionados(e.target.checked?new Set(lancs.map(r=>receitas.indexOf(r))):new Set())}
                    style={{ cursor:"pointer", accentColor:"#3b82f6" }} />
                </th>
                {/* Identificacao */}
                {["Cod. Lanc.","Cod. Cliente","Data Lanc."].map(h=>(
                  <th key={h} style={thS}>{h}</th>
                ))}
                {/* Partes -- com filtro */}
                {[["Nome do Cliente","cliente"],["Categoria","categoria"],["Produto","produto"],["Fornecedor","fornecedor"]].map(([h,campo])=>{
                  const ativo = filtroVals[campo]?.size > 0;
                  return (
                    <th key={h} onClick={()=>setFiltroCol(filtroCol?.campo===campo?null:{campo,label:h})}
                      style={{...thS,borderLeft:"1px solid #1e293b",cursor:"pointer",userSelect:"none",
                        color:ativo?"#60a5fa":"#64748b",background:ativo?"#0d1a2e":undefined}}>
                      {h}{ativo?" [F]":""}
                    </th>
                  );
                })}
                {/* Descricao */}
                <th style={{...thS,borderLeft:"1px solid #1e293b"}}>Descricao do Lancamento</th>
                {/* Plano de contas -- com filtro */}
                {[["Tipo Conta","tipoConta"],["Conta Contabil 1","contabil1"],["Sub Conta 1","subContabil1"],
                  ["Sub Conta 2","subContabil2"],["Sub Conta 3",""],["Sub Conta 4",""],["Sub Conta 5",""],
                  ["Competencia","competencia"]].map(([h,campo])=>{
                  const ativo = campo && filtroVals[campo]?.size > 0;
                  return (
                    <th key={h} onClick={campo?()=>setFiltroCol(filtroCol?.campo===campo?null:{campo,label:h}):undefined}
                      style={{...thS,borderLeft:"1px solid #1e293b",background:ativo?"#131f3a":"#0d1a2e",
                        color:ativo?"#60a5fa":"#475569",cursor:campo?"pointer":"default",userSelect:"none"}}>
                      {h}{ativo?" [F]":""}
                    </th>
                  );
                })}
                {/* Comprovante */}
                {["No Comprovante","No Nota"].map(h=>(
                  <th key={h} style={{...thS,borderLeft:"1px solid #1e293b"}}>{h}</th>
                ))}
                {/* Financeiro -- com filtro em Recebimento */}
                {[["Recebimento","recebimento"],["Valor (R$)",""],["Data Lancamento",""],["Periodo Contabil",""],["Periodo Caixa",""]].map(([h,campo])=>{
                  const ativo = campo && filtroVals[campo]?.size > 0;
                  return (
                    <th key={h} onClick={campo?()=>setFiltroCol(filtroCol?.campo===campo?null:{campo,label:h}):undefined}
                      style={{...thS,borderLeft:"1px solid #1e293b",
                        color:ativo?"#60a5fa":"#64748b",cursor:campo?"pointer":"default",userSelect:"none"}}>
                      {h}{ativo?" [F]":""}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {lancs.map((r, idx) => {
                const realIdx = receitas.indexOf(r);
                const isEdit  = editDesc?.idx === realIdx;
                const isCaixa = r.contabil1 === "Caixa";
                const isReceb = r.recebimento === "Recebido";
                const isAReceber = r.recebimento === "A Receber";
                const rowBg = selecionados.has(realIdx) ? "rgba(59,130,246,0.1)"
                  : isCaixa ? (idx%2===0?"#060d1a":"#080e1a")
                  : (idx%2===0?"#0a1122":"#0c1420");
                return (
                  <tr key={r.id||idx} style={{ background:rowBg }}>
                    <td style={{...tdS,width:36,textAlign:"center"}}>
                      <input type="checkbox" checked={selecionados.has(realIdx)}
                        onChange={e=>setSelecionados(prev=>{const n=new Set(prev);if(e.target.checked)n.add(realIdx);else n.delete(realIdx);return n;})}
                        style={{ cursor:"pointer", accentColor:"#3b82f6" }} />
                    </td>
                    <td style={{...tdS,fontFamily:"monospace",fontSize:10,color:"#475569"}}>{r.codigo||"--"}</td>
                    <td style={{...tdS,fontFamily:"monospace",fontSize:10,color:"#475569"}}>{r.clienteId||"--"}</td>
                    <td style={{...tdS}}>{fmtD(r.dataLancamento)}</td>
                    {/* Partes */}
                    <td style={{...tdS,borderLeft:"1px solid #1e293b",color:"#e2e8f0",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis"}}>{r.cliente||"--"}</td>
                    <td style={{...tdS}}>{r.categoria||"--"}</td>
                    <td style={{...tdS}}>{r.produto||"--"}</td>
                    <td style={{...tdS,maxWidth:130,overflow:"hidden",textOverflow:"ellipsis"}}>{r.fornecedor||"--"}</td>
                    {/* Descricao */}
                    <td style={{...tdS,borderLeft:"1px solid #1e293b",maxWidth:200}}>
                      {isEdit ? (
                        <input autoFocus defaultValue={r.descricao}
                          onBlur={e=>salvarDesc(realIdx,e.target.value)}
                          onKeyDown={e=>{if(e.key==="Enter")salvarDesc(realIdx,e.target.value);if(e.key==="Escape")setEditDesc(null);}}
                          style={{background:"#0a1122",border:"1px solid #2563eb",borderRadius:4,color:"#f1f5f9",
                            padding:"3px 6px",fontSize:11,outline:"none",fontFamily:"inherit",width:"100%"}} />
                      ):(
                        <span onClick={()=>setEditDesc({idx:realIdx})}
                          style={{color:"#94a3b8",cursor:"pointer",display:"block",maxWidth:200,
                            overflow:"hidden",textOverflow:"ellipsis",borderBottom:"1px dashed #1e293b"}}>
                          {r.descricao||"--"}
                        </span>
                      )}
                    </td>
                    {/* Plano de Contas */}
                    <td style={{...tdS,borderLeft:"1px solid #1e293b",background:"#0d1a2e",
                      color:r.tipoConta==="Conta Redutora"?"#f87171":"#10b981",fontWeight:600,fontSize:10}}>
                      {r.tipoConta||"--"}
                    </td>
                    <td style={{...tdS,background:"#0d1a2e",color:isCaixa?"#f59e0b":"#3b82f6",fontWeight:600}}>{r.contabil1||"--"}</td>
                    <td style={{...tdS,background:"#0d1a2e",color:"#64748b"}}>{r.subContabil1||"--"}</td>
                    <td style={{...tdS,background:"#0d1a2e",color:"#64748b"}}>{r.subContabil2||"--"}</td>
                    <td style={{...tdS,background:"#0d1a2e",color:"#334155"}}>{r.subContabil3||"--"}</td>
                    <td style={{...tdS,background:"#0d1a2e",color:"#334155"}}>{r.subContabil4||"--"}</td>
                    <td style={{...tdS,background:"#0d1a2e",color:"#334155"}}>{r.subContabil5||"--"}</td>
                    <td style={{...tdS,background:"#0d1a2e",
                      color:r.competencia==="Contabil"?"#a78bfa":isReceb?"#10b981":"#f59e0b"}}>
                      {r.competencia||"--"}
                    </td>
                    {/* Comprovante */}
                    <td style={{...tdS,borderLeft:"1px solid #1e293b",fontFamily:"monospace",fontSize:10}}>{r.nComprovante||"--"}</td>
                    <td style={{...tdS,fontFamily:"monospace",fontSize:10}}>{r.nNota||"--"}</td>
                    {/* Financeiro */}
                    <td style={{...tdS,borderLeft:"1px solid #1e293b",
                      color:isReceb?"#10b981":isAReceber?"#f59e0b":r.recebimento==="Conta contabil"?"#a78bfa":"#94a3b8"}}>
                      {r.recebimento||"--"}
                    </td>
                    <td style={{...tdS,fontWeight:700,textAlign:"right",color:"#10b981"}}>
                      R$ {fmtV(r.valor||0)}
                    </td>
                    <td style={{...tdS}}>{fmtD(r.dataLancamento)}</td>
                    <td style={{...tdS,color:r.periodoContabil?"#e2e8f0":"#334155"}}>{fmtD(r.periodoContabil)}</td>
                    <td style={{...tdS,color:r.periodoCaixa?"#10b981":"#334155"}}>{r.periodoCaixa?fmtD(r.periodoCaixa):"--"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Fornecedores({ data, save }) {
  const [view, setView] = useState("list");
  const [sel, setSel] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtroRating, setFiltroRating] = useState(0);

  const emptyForn = {
    nome:"", cnpj:"", email:"", telefone:"", categorias:[],
    prazoEntrega:"", condicoesPagamento:"", rating:3,
    contatos:[{id:uid(), nome:"", telefone:"", cargo:"", whatsapp:false}],
    observacoes:"", ativo:true, historicoPrecosIds:[]
  };
  const [form, setForm] = useState(emptyForn);

  const filtrados = data.fornecedores.filter(f => {
    const matchBusca = f.nome.toLowerCase().includes(busca.toLowerCase());
    const matchRating = filtroRating === 0 || f.rating >= filtroRating;
    return matchBusca && matchRating;
  });

  function openNew() { setForm(emptyForn); setView("form"); }
  function openEdit(f) { setForm(f); setView("form"); }
  function openDetail(f) { setSel(f); setView("detail"); }

  function saveForn(e) {
    e.preventDefault();
    const novos = form.id
      ? data.fornecedores.map(f => f.id === form.id ? form : f)
      : [...data.fornecedores, { ...form, id: uid() }];
    save({ ...data, fornecedores: novos });
    setView("list");
  }

  function toggleCat(cat) {
    const cats = form.categorias || [];
    setForm({ ...form, categorias: cats.includes(cat) ? cats.filter(c=>c!==cat) : [...cats, cat] });
  }

  // LISTA
  if (view === "list") return (
    <div style={S.moduleWrap}>
      <div style={S.toolbar}>
        <div style={S.toolbarLeft}>
          <div style={S.searchWrap}>
            <span style={S.searchIcon}>🔍</span>
            <input style={S.searchInput} placeholder="Buscar fornecedor..." value={busca} onChange={e=>setBusca(e.target.value)} />
          </div>
          <div style={S.filterGroup}>
            <span style={{ color:"#64748b", fontSize:12 }}>Rating mín:</span>
            {[0,3,4,5].map(r => (
              <button key={r} className="filter-btn" style={{ ...S.filterBtn, ...(filtroRating===r?S.filterBtnActive:{}) }} onClick={()=>setFiltroRating(r)}>
                {r===0?"Todos":"★".repeat(r)}
              </button>
            ))}
          </div>
        </div>
        <button style={S.btnPrimary} onClick={openNew}>+ Novo Fornecedor</button>
      </div>

      <div style={S.statsRow}>
        {[
          ["Total", data.fornecedores.length, "#3b82f6"],
          ["Ativos", data.fornecedores.filter(f=>f.ativo).length, "#10b981"],
          ["5 estrelas", data.fornecedores.filter(f=>f.rating===5).length, "#f59e0b"],
          ["Categorias", [...new Set(data.fornecedores.flatMap(f=>f.categorias||[]))].length, "#8b5cf6"],
        ].map(([l,v,c]) => (
          <div key={l} style={{ ...S.statCard, borderLeft:`3px solid ${c}` }}>
            <span style={{ color:"#64748b", fontSize:11, textTransform:"uppercase", letterSpacing:1 }}>{l}</span>
            <span style={{ color:c, fontWeight:800, fontSize:22 }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={S.cardGrid}>
        {filtrados.map(f => {
          const compras = data.lancamentos.filter(l => l.fornecedorId === f.id);
          const totalComprado = compras.reduce((s,l)=>s+l.total,0);
          return (
            <div key={f.id} className="client-card" style={S.clientCard} onClick={() => openDetail(f)}>
              <div style={S.clientCardHeader}>
                <div style={{ ...S.avatar, background:"linear-gradient(135deg,#f59e0b,#d97706)" }}>
                  {f.nome.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={S.clientName}>{f.nome}</div>
                  <div style={S.clientCpf}>{f.cnpj}</div>
                </div>
                <div style={{ display:"flex", gap:2 }}>
                  {[1,2,3,4,5].map(s => <span key={s} style={{ fontSize:12, color: s<=f.rating?"#f59e0b":"#1e293b" }}>★</span>)}
                </div>
              </div>

              <div style={{ display:"flex", flexWrap:"wrap", gap:4, margin:"10px 0" }}>
                {(f.categorias||[]).map(c => <span key={c} style={S.catTag}>{c}</span>)}
              </div>

              <div style={S.clientInfo}>
                {f.prazoEntrega && <div style={S.infoRow}><span style={S.infoIcon}>🚚</span><span>Prazo: {f.prazoEntrega} dias</span></div>}
                {f.condicoesPagamento && <div style={S.infoRow}><span style={S.infoIcon}>💳</span><span>{f.condicoesPagamento}</span></div>}
                {totalComprado > 0 && <div style={S.infoRow}><span style={S.infoIcon}>📊</span><span>{compras.length} compras · {totalComprado.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span></div>}
              </div>

              <div style={S.clientFooter}>
                <span style={{ ...S.statusDot, color: f.ativo?"#4ade80":"#f87171" }}>● {f.ativo?"Ativo":"Inativo"}</span>
              </div>
              <div style={S.clientActions} onClick={e=>e.stopPropagation()}>
                <button className="action-btn" style={S.actionBtn} onClick={()=>openEdit(f)}>✏ Editar</button>
              </div>
            </div>
          );
        })}
        {filtrados.length === 0 && (
          <div style={S.empty}>
            <div style={S.emptyIcon}>🏭</div>
            <div style={S.emptyText}>Nenhum fornecedor encontrado</div>
            <button style={S.btnPrimary} onClick={openNew}>Cadastrar primeiro fornecedor</button>
          </div>
        )}
      </div>
    </div>
  );

  // DETALHE FORNECEDOR
  if (view === "detail" && sel) {
    const forn = data.fornecedores.find(f=>f.id===sel.id) || sel;
    const compras = data.lancamentos.filter(l=>l.fornecedorId===forn.id);
    const totalComprado = compras.reduce((s,l)=>s+l.total,0);

    // Histórico de preços por material
    const historicoPrecos = {};
    compras.forEach(l => {
      const mat = data.materiais.find(m=>m.id===l.materialId);
      if (!mat) return;
      if (!historicoPrecos[mat.nome]) historicoPrecos[mat.nome] = [];
      historicoPrecos[mat.nome].push({ data:l.data, preco:l.valorUnit, total:l.total, qtd:l.quantidade, unidade:mat.unidade });
    });

    return (
      <div style={S.moduleWrap}>
        <div style={S.detailHeader}>
          <button style={S.backBtn} onClick={()=>setView("list")}>← Voltar</button>
          <button style={S.btnPrimary} onClick={()=>openEdit(forn)}>✏ Editar</button>
        </div>
        <div style={S.detailWrap}>
          <div style={S.detailCard}>
            <div style={S.detailProfile}>
              <div style={{ ...S.avatarLg, background:"linear-gradient(135deg,#f59e0b,#d97706)" }}>
                {forn.nome.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <h2 style={{ color:"#f1f5f9", fontWeight:800, fontSize:20, margin:0 }}>{forn.nome}</h2>
                <p style={{ color:"#64748b", fontSize:13, margin:"4px 0 8px" }}>{forn.cnpj}</p>
                <div style={{ display:"flex", gap:4 }}>
                  {[1,2,3,4,5].map(s=><span key={s} style={{ fontSize:18, color:s<=forn.rating?"#f59e0b":"#1e293b" }}>★</span>)}
                  <span style={{ color:"#64748b", fontSize:13, marginLeft:6 }}>{forn.rating}/5</span>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ color:"#64748b", fontSize:11 }}>Total comprado</div>
                <div style={{ color:"#f59e0b", fontWeight:800, fontSize:20 }}>{totalComprado.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</div>
                <div style={{ color:"#64748b", fontSize:12 }}>{compras.length} compras</div>
              </div>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:16 }}>
              {(forn.categorias||[]).map(c=><span key={c} style={S.catTag}>{c}</span>)}
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <div style={S.detailCard}>
              <div style={S.detailCardTitle}>📋 Informações Comerciais</div>
              <div style={S.detailFields}>
                <DetailRow label="E-mail" value={forn.email} />
                <DetailRow label="Telefone" value={forn.telefone} />
                <DetailRow label="Prazo de Entrega" value={forn.prazoEntrega ? `${forn.prazoEntrega} dias úteis` : "—"} />
                <DetailRow label="Condições de Pagamento" value={forn.condicoesPagamento || "—"} />
              </div>
            </div>
            <div style={S.detailCard}>
              <div style={S.detailCardTitle}>📞 Contatos</div>
              {forn.contatos?.map(ct=>(
                <div key={ct.id} style={S.contatoRow}>
                  <div style={{ fontWeight:600, color:"#e2e8f0", fontSize:13 }}>{ct.nome} <span style={{ color:"#64748b", fontWeight:400 }}>({ct.cargo})</span></div>
                  <div style={{ color:"#94a3b8", fontSize:12, marginTop:2 }}>
                    {ct.telefone} {ct.whatsapp && <span style={S.waBadge}>WhatsApp</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Histórico de preços */}
          {Object.keys(historicoPrecos).length > 0 && (
            <div style={S.detailCard}>
              <div style={S.detailCardTitle}>📈 Histórico de Preços por Material</div>
              {Object.entries(historicoPrecos).map(([matNome, hist]) => (
                <div key={matNome} style={{ marginBottom:20 }}>
                  <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:13, marginBottom:8 }}>{matNome}</div>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr>{["Data","Qtd","Preço Unit.","Total"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {hist.sort((a,b)=>new Date(b.data)-new Date(a.data)).map((h,i)=>(
                        <tr key={i} style={{ borderBottom:"1px solid #0f172a" }}>
                          <td style={S.td}>{new Date(h.data).toLocaleDateString("pt-BR")}</td>
                          <td style={S.td}>{h.qtd} {h.unidade}</td>
                          <td style={{ ...S.td, color:"#10b981", fontWeight:600 }}>{h.preco.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td>
                          <td style={{ ...S.td, color:"#f59e0b" }}>{h.total.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {forn.observacoes && (
            <div style={S.detailCard}>
              <div style={S.detailCardTitle}>📝 Observações</div>
              <p style={{ color:"#94a3b8", fontSize:13, lineHeight:1.6 }}>{forn.observacoes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // FORMULÁRIO FORNECEDOR
  return (
    <div style={S.moduleWrap}>
      <div style={S.formHeader}>
        <button style={S.backBtn} onClick={()=>setView("list")}>← Voltar</button>
        <h2 style={S.formTitle}>{form.id?"Editar Fornecedor":"Novo Fornecedor"}</h2>
      </div>
      <form onSubmit={saveForn} style={S.formWrap}>
        <div style={S.formSection}>
          <div style={S.sectionTitle}>Dados da Empresa</div>
          <div style={S.formGrid2}>
            <FormField label="Razão Social / Nome" value={form.nome} onChange={v=>setForm({...form,nome:v})} required />
            <FormField label="CNPJ" value={form.cnpj} onChange={v=>setForm({...form,cnpj:v})} placeholder="00.000.000/0001-00" />
          </div>
          <div style={S.formGrid2}>
            <FormField label="E-mail" type="email" value={form.email} onChange={v=>setForm({...form,email:v})} />
            <FormField label="Telefone principal" value={form.telefone} onChange={v=>setForm({...form,telefone:v})} />
          </div>
        </div>

        <div style={S.formSection}>
          <div style={S.sectionTitle}>Categorias de Produtos</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:8 }}>
            {CATS_FORNECEDOR.map(cat=>(
              <button type="button" key={cat} onClick={()=>toggleCat(cat)}
                style={{ ...S.catToggle, ...(form.categorias?.includes(cat)?S.catToggleActive:{}) }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div style={S.formSection}>
          <div style={S.sectionTitle}>Condições Comerciais</div>
          <div style={S.formGrid2}>
            <FormField label="Prazo médio de entrega (dias)" type="number" value={form.prazoEntrega} onChange={v=>setForm({...form,prazoEntrega:v})} />
            <FormField label="Condições de pagamento" value={form.condicoesPagamento} onChange={v=>setForm({...form,condicoesPagamento:v})} placeholder="Ex: 30/60/90 dias, À vista -5%..." />
          </div>
          <div style={{ marginTop:12 }}>
            <label style={S.fieldLabel}>Avaliação geral</label>
            <div style={{ display:"flex", gap:8, marginTop:6 }}>
              {[1,2,3,4,5].map(s=>(
                <button type="button" key={s} onClick={()=>setForm({...form,rating:s})}
                  style={{ fontSize:24, background:"none", border:"none", cursor:"pointer", color:s<=form.rating?"#f59e0b":"#1e293b", transition:"color 0.15s" }}>
                  ★
                </button>
              ))}
              <span style={{ color:"#64748b", fontSize:13, alignSelf:"center" }}>{form.rating}/5</span>
            </div>
          </div>
        </div>

        <div style={S.formSection}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={S.sectionTitle}>Contatos</div>
            <button type="button" style={S.btnSecondary} onClick={()=>setForm({...form,contatos:[...form.contatos,{id:uid(),nome:"",telefone:"",cargo:"",whatsapp:false}]})}>
              + Adicionar contato
            </button>
          </div>
          {form.contatos?.map((ct,i)=>(
            <div key={ct.id} style={S.contatoFormRow}>
              <div style={S.formGrid3}>
                <FormField label="Nome" value={ct.nome} onChange={v=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,nome:v}:x)})} />
                <FormField label="Telefone" value={ct.telefone} onChange={v=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,telefone:v}:x)})} />
                <FormField label="Cargo" value={ct.cargo} onChange={v=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,cargo:v}:x)})} />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:8 }}>
                <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", color:"#64748b", fontSize:13 }}>
                  <input type="checkbox" checked={ct.whatsapp} onChange={e=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,whatsapp:e.target.checked}:x)})} />
                  <span style={{ color:"#25d366" }}>WhatsApp</span>
                </label>
                {form.contatos.length > 1 && (
                  <button type="button" style={{ ...S.btnSecondary, color:"#f87171", fontSize:12 }} onClick={()=>setForm({...form,contatos:form.contatos.filter((_,j)=>j!==i)})}>
                    Remover
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={S.formSection}>
          <div style={S.sectionTitle}>Observações Internas</div>
          <textarea style={S.textarea} value={form.observacoes} onChange={e=>setForm({...form,observacoes:e.target.value})} placeholder="Condições especiais, notas de negociação, alertas..." rows={3} />
        </div>

        <div style={S.formActions}>
          <button type="button" style={S.btnCancel} onClick={()=>setView("list")}>Cancelar</button>
          <button type="submit" style={S.btnPrimary}>{form.id?"Salvar alterações":"Cadastrar fornecedor"}</button>
        </div>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// IMPORTAR NOTA FISCAL (PDF → IA → Extração)
// ═══════════════════════════════════════════════════════════════
function ImportarNF({ data, save }) {
  const [stage, setStage] = useState("upload"); // upload | processing | review | done
  const [pdfBase64, setPdfBase64] = useState(null);
  const [pdfName, setPdfName] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [editResult, setEditResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const dropRef = useRef();

  function handleFile(file) {
    if (!file || file.type !== "application/pdf") { setError("Por favor envie um arquivo PDF."); return; }
    setError(null);
    setPdfName(file.name);
    const reader = new FileReader();
    reader.onload = e => { setPdfBase64(e.target.result.split(",")[1]); setStage("ready"); };
    reader.readAsDataURL(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  }

  async function processarNF() {
    setStage("processing");
    setError(null);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: pdfBase64 }
              },
              {
                type: "text",
                text: `Você é um extrator de dados de Notas Fiscais brasileiras. Analise esta NF-e e extraia TODOS os dados em formato JSON puro, sem texto extra, sem markdown.

Retorne EXATAMENTE este formato:
{
  "numero": "número da NF",
  "serie": "série",
  "dataEmissao": "YYYY-MM-DD",
  "chaveAcesso": "chave de acesso 44 dígitos se disponível",
  "emitente": {
    "razaoSocial": "nome",
    "cnpj": "CNPJ formatado",
    "endereco": "endereço completo",
    "cidade": "cidade",
    "estado": "UF"
  },
  "destinatario": {
    "razaoSocial": "nome",
    "cpfCnpj": "CPF ou CNPJ",
    "endereco": "endereço"
  },
  "itens": [
    {
      "descricao": "descrição do produto",
      "ncm": "código NCM se disponível",
      "unidade": "unidade (sc, un, m, kg, m², etc.)",
      "quantidade": 0.00,
      "valorUnitario": 0.00,
      "valorTotal": 0.00
    }
  ],
  "totais": {
    "produtos": 0.00,
    "frete": 0.00,
    "desconto": 0.00,
    "impostos": 0.00,
    "totalNF": 0.00
  },
  "transportadora": "nome se disponível",
  "formaPagamento": "forma de pagamento",
  "observacoes": "observações da NF"
}`
              }
            ]
          }]
        })
      });

      const resData = await response.json();
      if (resData.error) throw new Error(resData.error.message);

      const texto = resData.content.map(b => b.text || "").join("");
      const cleanJson = texto.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      setResult(parsed);
      setEditResult(parsed);
      setStage("review");
    } catch (e) {
      setError(`Erro ao processar NF: ${e.message}`);
      setStage("ready");
    }
  }

  async function confirmarImportacao() {
    setSaving(true);
    const r = editResult;

    // Tenta encontrar ou criar fornecedor
    let fornecedorId = data.fornecedores.find(f =>
      f.cnpj?.replace(/\D/g,"") === r.emitente?.cnpj?.replace(/\D/g,"")
    )?.id;

    let novosFornecedores = [...data.fornecedores];
    if (!fornecedorId && r.emitente?.razaoSocial) {
      fornecedorId = uid();
      novosFornecedores.push({
        id: fornecedorId,
        nome: r.emitente.razaoSocial,
        cnpj: r.emitente.cnpj || "",
        email: "", telefone: "", categorias: [],
        prazoEntrega: "", condicoesPagamento: "", rating: 3,
        contatos: [], observacoes: "Criado automaticamente via importação de NF.", ativo: true,
        historicoPrecosIds: []
      });
    }

    // Cria lançamentos para cada item
    const novosLancamentos = [...data.lancamentos];
    const novosMateriais = [...data.materiais];

    for (const item of (r.itens || [])) {
      // Busca material existente
      let matId = data.materiais.find(m =>
        m.nome.toLowerCase().includes(item.descricao?.toLowerCase().slice(0,10))
      )?.id;

      if (!matId) {
        matId = uid();
        novosMateriais.push({
          id: matId,
          nome: item.descricao,
          unidade: item.unidade || "un",
          categoria: "Outros",
          ultimoPreco: item.valorUnitario,
          fornecedorId: fornecedorId || ""
        });
      } else {
        // Atualiza último preço
        const idx = novosMateriais.findIndex(m=>m.id===matId);
        if (idx>=0) novosMateriais[idx] = { ...novosMateriais[idx], ultimoPreco: item.valorUnitario };
      }

      novosLancamentos.push({
        id: uid(),
        obraId: "",
        materialId: matId,
        fornecedorId: fornecedorId || "",
        quantidade: item.quantidade,
        valorUnit: item.valorUnitario,
        total: item.valorTotal,
        data: r.dataEmissao || new Date().toISOString().slice(0,10),
        etapa: "",
        nf: `NF-${r.numero || "000"}`,
        pago: false,
        pendente_vincular_obra: true
      });
    }

    save({ ...data, fornecedores: novosFornecedores, lancamentos: novosLancamentos, materiais: novosMateriais });
    setSaving(false);
    setStage("done");
  }

  if (stage === "done") return (
    <div style={S.moduleWrap}>
      <div style={S.successBox}>
        <div style={S.successIcon}>✅</div>
        <h2 style={{ color:"#f1f5f9", fontWeight:800, fontSize:22 }}>NF importada com sucesso!</h2>
        <p style={{ color:"#64748b", fontSize:14, maxWidth:400, textAlign:"center", lineHeight:1.6 }}>
          Os materiais e lançamentos foram cadastrados. Vá em <strong style={{ color:"#f59e0b" }}>Lançamentos</strong> para vincular cada item a uma obra.
        </p>
        <button style={S.btnPrimary} onClick={()=>{ setStage("upload"); setPdfBase64(null); setResult(null); }}>
          Importar outra NF
        </button>
      </div>
    </div>
  );

  return (
    <div style={S.moduleWrap}>
      <div style={S.nfHeader}>
        <h2 style={{ color:"#f1f5f9", fontWeight:800, fontSize:18, margin:0 }}>Importar Nota Fiscal (PDF)</h2>
        <p style={{ color:"#64748b", fontSize:13, margin:"6px 0 0" }}>
          Faça upload de uma NF-e em PDF. A IA vai extrair automaticamente todos os dados: emitente, itens, preços, quantidades e totais.
        </p>
      </div>

      {/* UPLOAD */}
      {(stage === "upload" || stage === "ready") && (
        <div
          ref={dropRef}
          style={{ ...S.dropZone, ...(pdfBase64 ? S.dropZoneDone : {}) }}
          onDragOver={e=>e.preventDefault()}
          onDrop={handleDrop}
          onClick={()=>{ if(!pdfBase64) document.getElementById("nf-file-input").click(); }}
        >
          <input id="nf-file-input" type="file" accept=".pdf" style={{ display:"none" }} onChange={e=>handleFile(e.target.files[0])} />
          {pdfBase64 ? (
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:40, marginBottom:8 }}>📄</div>
              <div style={{ color:"#f1f5f9", fontWeight:700 }}>{pdfName}</div>
              <div style={{ color:"#4ade80", fontSize:13, marginTop:4 }}>PDF carregado ✓</div>
              <button style={{ ...S.btnSecondary, marginTop:12 }} onClick={e=>{ e.stopPropagation(); setPdfBase64(null); setPdfName(""); setStage("upload"); }}>
                Trocar arquivo
              </button>
            </div>
          ) : (
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📁</div>
              <div style={{ color:"#94a3b8", fontSize:15, fontWeight:600 }}>Arraste o PDF aqui</div>
              <div style={{ color:"#475569", fontSize:13, marginTop:6 }}>ou clique para selecionar</div>
              <div style={{ color:"#334155", fontSize:12, marginTop:10 }}>Aceita NF-e em formato PDF</div>
            </div>
          )}
        </div>
      )}

      {error && <div style={S.errorBox}>{error}</div>}

      {stage === "ready" && pdfBase64 && (
        <div style={{ textAlign:"center", marginTop:8 }}>
          <button style={{ ...S.btnPrimary, fontSize:15, padding:"12px 32px" }} onClick={processarNF}>
            🤖 Processar com IA
          </button>
        </div>
      )}

      {/* PROCESSING */}
      {stage === "processing" && (
        <div style={S.processingBox}>
          <div style={S.processingAnim}>
            <Spinner size={40} />
          </div>
          <h3 style={{ color:"#f1f5f9", fontWeight:700, margin:"16px 0 8px" }}>Analisando Nota Fiscal...</h3>
          <p style={{ color:"#64748b", fontSize:13 }}>A IA está lendo o PDF e extraindo todos os dados. Isso leva alguns segundos.</p>
          <div style={S.processingSteps}>
            {["Lendo o PDF", "Identificando emitente e destinatário", "Extraindo itens e preços", "Calculando totais"].map((s,i)=>(
              <div key={i} style={S.processingStep}>
                <span style={{ color:"#3b82f6", fontSize:14 }}>◎</span>
                <span style={{ color:"#94a3b8", fontSize:13 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REVISÃO */}
      {stage === "review" && editResult && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={S.reviewHeader}>
            <div style={S.reviewBadge}>✓ NF extraída com sucesso</div>
            <p style={{ color:"#94a3b8", fontSize:13, margin:"8px 0 0" }}>Revise os dados abaixo antes de importar. Você pode editar qualquer campo.</p>
          </div>

          {/* Emitente */}
          <div style={S.detailCard}>
            <div style={S.detailCardTitle}>🏭 Emitente (Fornecedor)</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12 }}>
              <div>
                <label style={S.fieldLabel}>Razão Social</label>
                <input style={S.inputSm} value={editResult.emitente?.razaoSocial||""} onChange={e=>setEditResult({...editResult,emitente:{...editResult.emitente,razaoSocial:e.target.value}})} />
              </div>
              <div>
                <label style={S.fieldLabel}>CNPJ</label>
                <input style={S.inputSm} value={editResult.emitente?.cnpj||""} onChange={e=>setEditResult({...editResult,emitente:{...editResult.emitente,cnpj:e.target.value}})} />
              </div>
            </div>
            {data.fornecedores.find(f=>f.cnpj?.replace(/\D/g,"")===editResult.emitente?.cnpj?.replace(/\D/g,"")) ? (
              <div style={S.matchFound}>✓ Fornecedor já cadastrado — será vinculado automaticamente</div>
            ) : (
              <div style={S.matchNew}>+ Novo fornecedor será criado automaticamente</div>
            )}
          </div>

          {/* NF Info */}
          <div style={S.detailCard}>
            <div style={S.detailCardTitle}>📋 Dados da NF</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginTop:12 }}>
              <div><label style={S.fieldLabel}>Número</label><input style={S.inputSm} value={editResult.numero||""} onChange={e=>setEditResult({...editResult,numero:e.target.value})} /></div>
              <div><label style={S.fieldLabel}>Data Emissão</label><input style={S.inputSm} type="date" value={editResult.dataEmissao||""} onChange={e=>setEditResult({...editResult,dataEmissao:e.target.value})} /></div>
              <div><label style={S.fieldLabel}>Forma Pagamento</label><input style={S.inputSm} value={editResult.formaPagamento||""} onChange={e=>setEditResult({...editResult,formaPagamento:e.target.value})} /></div>
            </div>
          </div>

          {/* Itens */}
          <div style={S.detailCard}>
            <div style={S.detailCardTitle}>📦 Itens da Nota ({editResult.itens?.length || 0})</div>
            <table style={{ width:"100%", borderCollapse:"collapse", marginTop:12 }}>
              <thead>
                <tr>{["Descrição","Unidade","Quantidade","Valor Unit.","Total"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {(editResult.itens||[]).map((item,i) => (
                  <tr key={i} style={{ borderBottom:"1px solid #0f172a" }}>
                    <td style={S.td}>
                      <input style={{ ...S.inputSm, width:"100%" }} value={item.descricao||""} onChange={e=>setEditResult({...editResult,itens:editResult.itens.map((x,j)=>j===i?{...x,descricao:e.target.value}:x)})} />
                    </td>
                    <td style={S.td}>
                      <input style={{ ...S.inputSm, width:60 }} value={item.unidade||""} onChange={e=>setEditResult({...editResult,itens:editResult.itens.map((x,j)=>j===i?{...x,unidade:e.target.value}:x)})} />
                    </td>
                    <td style={S.td}>
                      <input style={{ ...S.inputSm, width:80 }} type="number" value={item.quantidade||""} onChange={e=>setEditResult({...editResult,itens:editResult.itens.map((x,j)=>j===i?{...x,quantidade:parseFloat(e.target.value),valorTotal:parseFloat(e.target.value)*x.valorUnitario}:x)})} />
                    </td>
                    <td style={S.td}>
                      <input style={{ ...S.inputSm, width:100 }} type="number" step="0.01" value={item.valorUnitario||""} onChange={e=>setEditResult({...editResult,itens:editResult.itens.map((x,j)=>j===i?{...x,valorUnitario:parseFloat(e.target.value),valorTotal:parseFloat(e.target.value)*x.quantidade}:x)})} />
                    </td>
                    <td style={{ ...S.td, color:"#f59e0b", fontWeight:700 }}>
                      {(item.valorTotal||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totais */}
          <div style={S.detailCard}>
            <div style={S.detailCardTitle}>💰 Totais</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginTop:12 }}>
              {[["Produtos","produtos"],["Frete","frete"],["Desconto","desconto"],["Total NF","totalNF"]].map(([l,k])=>(
                <div key={k}>
                  <label style={S.fieldLabel}>{l}</label>
                  <input style={{ ...S.inputSm, color: k==="totalNF"?"#f59e0b":"#f1f5f9", fontWeight:k==="totalNF"?700:400 }}
                    type="number" step="0.01" value={editResult.totais?.[k]||""}
                    onChange={e=>setEditResult({...editResult,totais:{...editResult.totais,[k]:parseFloat(e.target.value)}})} />
                </div>
              ))}
            </div>
          </div>

          <div style={S.formActions}>
            <button style={S.btnCancel} onClick={()=>{ setStage("ready"); setResult(null); }}>← Voltar</button>
            <button style={S.btnPrimary} onClick={confirmarImportacao} disabled={saving}>
              {saving ? "Importando..." : "✓ Confirmar e Importar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTES AUXILIARES
// ═══════════════════════════════════════════════════════════════
function FormField({ label, value, onChange, type="text", placeholder="", required=false, step }) {
  return (
    <div>
      <label style={S.fieldLabel}>{label}{required && <span style={{ color:"#ef4444" }}> *</span>}</label>
      <input style={S.input} type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} required={required} step={step} />
    </div>
  );
}
function DetailRow({ label, value }) {
  return (
    <div style={{ display:"flex", gap:8, padding:"6px 0", borderBottom:"1px solid #0f172a" }}>
      <span style={{ color:"#64748b", fontSize:12, minWidth:140 }}>{label}</span>
      <span style={{ color:"#e2e8f0", fontSize:13 }}>{value || "—"}</span>
    </div>
  );
}
function Spinner({ size=24 }) {
  return <div style={{ width:size, height:size, border:`${size/8}px solid #1e293b`, borderTop:`${size/8}px solid #3b82f6`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />;
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
var CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; background:#07101f; overflow-x:hidden; scroll-behavior:auto !important; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  .tab-btn:hover { background:#1e293b !important; color:#e2e8f0 !important; }
  .client-card:hover { border-color:#3b82f6 !important; transform:translateY(-2px); box-shadow:0 8px 32px rgba(59,130,246,0.12); }
  .client-card { transition: all 0.2s ease; }
  .filter-btn:hover { background:#1e293b !important; }
  .action-btn:hover { background:#1e3a5f !important; color:#60a5fa !important; }
`;

var S = {
  app: { fontFamily:"'Sora',system-ui,sans-serif", background:"#07101f", minHeight:"100vh", color:"#f1f5f9", display:"flex", flexDirection:"column" },
  center: { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", background:"#07101f" },
  topbar: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 28px", background:"#0d1526", borderBottom:"1px solid #1e293b" },
  topbarLeft: { display:"flex", alignItems:"center", gap:10 },
  logoMark: { fontSize:20 },
  logoText: { color:"#f1f5f9", fontWeight:800, fontSize:16 },
  logoDivider: { color:"#334155", fontSize:16 },
  logoSub: { color:"#64748b", fontSize:14 },
  topbarRight: { display:"flex", alignItems:"center", gap:6 },
  onlineDot: { color:"#4ade80", fontSize:10 },
  tabBar: { display:"flex", gap:0, background:"#0d1526", borderBottom:"1px solid #1e293b", padding:"0 20px" },
  tabBtn: { background:"transparent", border:"none", color:"#64748b", padding:"14px 20px", fontSize:13, fontWeight:600, cursor:"pointer", borderBottom:"2px solid transparent", display:"flex", alignItems:"center", gap:8, transition:"all 0.15s" },
  tabBtnActive: { color:"#60a5fa", borderBottom:"2px solid #3b82f6" },
  tabCount: { background:"#1e293b", color:"#94a3b8", borderRadius:12, padding:"2px 8px", fontSize:11 },
  content: { padding:"24px 28px", animation:"fadeIn 0.3s ease", flex:1 },
  moduleWrap: { display:"flex", flexDirection:"column", gap:20 },
  toolbar: { display:"flex", justifyContent:"space-between", alignItems:"center", gap:16, flexWrap:"wrap" },
  toolbarLeft: { display:"flex", alignItems:"center", gap:12, flex:1 },
  searchWrap: { position:"relative", display:"flex", alignItems:"center" },
  searchIcon: { position:"absolute", left:12, fontSize:13, pointerEvents:"none" },
  searchInput: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:8, color:"#f1f5f9", padding:"9px 12px 9px 34px", fontSize:13, outline:"none", width:280, fontFamily:"inherit" },
  filterGroup: { display:"flex", alignItems:"center", gap:6 },
  filterBtn: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:6, color:"#64748b", padding:"6px 12px", fontSize:12, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" },
  filterBtnActive: { background:"#1e3a5f", color:"#60a5fa", borderColor:"#3b82f6" },
  statsRow: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 },
  statCard: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:10, padding:"14px 16px", display:"flex", flexDirection:"column", gap:6 },
  cardGrid: { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 },
  clientCard: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:12, padding:18, cursor:"pointer", position:"relative" },
  clientCardHeader: { display:"flex", alignItems:"center", gap:12, marginBottom:12 },
  avatar: { width:44, height:44, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:15, flexShrink:0, fontFamily:"'Sora',sans-serif" },
  avatarLg: { width:60, height:60, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:20, flexShrink:0 },
  clientName: { color:"#f1f5f9", fontWeight:700, fontSize:14 },
  clientCpf: { color:"#475569", fontSize:12, marginTop:2, fontFamily:"'JetBrains Mono',monospace" },
  tipoBadge: { fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:6, letterSpacing:0.5 },
  clientInfo: { display:"flex", flexDirection:"column", gap:5, marginBottom:12 },
  infoRow: { display:"flex", alignItems:"center", gap:6, color:"#64748b", fontSize:12 },
  infoIcon: { fontSize:11, width:16 },
  waBadge: { background:"#052e16", color:"#25d366", fontSize:10, padding:"1px 6px", borderRadius:4, fontWeight:700, marginLeft:4 },
  waBtnSm: { background:"#052e16", color:"#25d366", border:"1px solid #14532d", borderRadius:6, padding:"4px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit", fontWeight:600, whiteSpace:"nowrap" },
  // Orçamento styles
    emptyState: { display:"flex", flexDirection:"column", alignItems:"center", padding:"80px 20px", textAlign:"center" },
    kpi: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:10, padding:"16px 18px" },
    orcCard: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:12, padding:18, cursor:"pointer" },
    orcStat: { background:"#0f172a", borderRadius:8, padding:"8px 10px" },
    badge: { fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:12, alignSelf:"flex-start" },
    steps: { display:"flex", alignItems:"center", gap:12 },
    stepDot: { width:28, height:28, borderRadius:"50%", background:"#1e293b", color:"#64748b", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700 },
    stepDotActive: { background:"linear-gradient(135deg,#3b82f6,#2563eb)", color:"#fff" },
    stepLine: { width:40, height:2, background:"#1e293b" },
    radioGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 },
    radioCard: { display:"flex", alignItems:"center", gap:10, background:"#0f172a", border:"1px solid #1e293b", borderRadius:10, padding:"10px 14px", cursor:"pointer", userSelect:"none", transition:"all 0.15s" },
    radioCardActive: { background:"#1e3a5f", borderColor:"#3b82f6" },
    comodoRow: { display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid #0a1222" },
    qtdControl: { display:"flex", alignItems:"center", gap:6 },
    qtdBtn: { width:28, height:28, background:"#1e293b", border:"none", borderRadius:6, color:"#94a3b8", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit" },
    qtdNum: { width:28, textAlign:"center", fontWeight:700, fontSize:15, fontFamily:"'JetBrains Mono',monospace" },
    previewCol: { width:360, flexShrink:0, position:"sticky", top:20, alignSelf:"flex-start" },
    previewCard: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:14, padding:20 },
    previewTitle: { color:"#94a3b8", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:14 },
    previewSection: { borderBottom:"1px solid #0f172a", paddingBottom:12, marginBottom:12 },
    previewLabel: { color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 },
    previewRow: { display:"flex", justifyContent:"space-between", fontSize:12, color:"#64748b", marginBottom:5 },
    formula: { background:"#0f172a", borderRadius:8, padding:"8px 12px", color:"#94a3b8", fontSize:11, fontFamily:"'JetBrains Mono',monospace", lineHeight:1.6 },
    previewTotal: { background:"linear-gradient(135deg,#1c1500,#0d1526)", border:"1px solid #f59e0b40", borderRadius:10, padding:16, textAlign:"center" },
    resultHeader: { background:"linear-gradient(135deg,#0d1f3c,#0d1526)", border:"1px solid #1e3a5f", borderRadius:14, padding:24 },
    btnXs: { background:"#1e293b", color:"#94a3b8", border:"none", borderRadius:6, padding:"4px 10px", fontSize:12, cursor:"pointer", fontFamily:"inherit" },
    btnWA: { background:"#052e16", color:"#25d366", border:"1px solid #14532d", borderRadius:8, padding:"9px 16px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" },
  btnSubacao: { display:"flex", alignItems:"center", gap:14, background:"#0f172a", border:"1px solid #1e293b", borderRadius:12, padding:"14px 16px", cursor:"pointer", fontFamily:"inherit", width:"100%", transition:"all 0.15s" },
  servicoMenuItem: { display:"flex", alignItems:"center", gap:12, background:"#0f172a", border:"2px solid #1e293b", borderRadius:10, padding:"14px 16px", cursor:"pointer", fontFamily:"inherit", width:"100%", transition:"all 0.15s" },
  btnSubacao2: { background:"#1e3a5f", color:"#60a5fa", border:"1px solid #1d4ed8", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" },
  btnSubacaoGreen: { background:"#052e16", color:"#4ade80", border:"1px solid #14532d", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" },
  btnServico: { background:"#1e3a5f", color:"#60a5fa", border:"none", borderRadius:8, padding:"7px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" },
  btnSubacao: { display:"flex", alignItems:"center", gap:14, background:"#0f172a", border:"2px solid #1e293b", borderRadius:12, padding:"14px 16px", cursor:"pointer", fontFamily:"inherit", width:"100%", transition:"border-color 0.15s" },
  btnXsSm: { background:"#1e293b", color:"#94a3b8", border:"none", borderRadius:6, padding:"4px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit" },
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 },
  modalBox: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:16, padding:28, width:"100%", maxHeight:"90vh", overflowY:"auto" },
  modalHead: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 },
  closeBtn: { background:"#1e293b", border:"none", color:"#94a3b8", cursor:"pointer", borderRadius:6, width:28, height:28, fontSize:14, fontFamily:"inherit" },
  btnServSm: { background:"#1e293b", color:"#94a3b8", border:"none", borderRadius:6, padding:"5px 12px", fontSize:12, cursor:"pointer", fontFamily:"inherit" },
  section: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:12, padding:20 },
  label: { display:"block", color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 },
  servicoCard: { background:"#0f172a", border:"2px solid #1e293b", borderRadius:10, padding:"14px 16px", cursor:"pointer", userSelect:"none", transition:"all 0.15s" },
  servicoCardActive: { background:"#0d1f3c", border:"2px solid #3b82f6" },
  clientFooter: { display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:10, borderTop:"1px solid #0f172a", marginBottom:10 },
  obrasCount: { color:"#64748b", fontSize:12 },
  statusDot: { fontSize:12, fontWeight:600 },
  clientActions: { display:"flex", gap:8 },
  actionBtn: { background:"#1e293b", border:"none", color:"#94a3b8", borderRadius:6, padding:"5px 10px", fontSize:12, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" },
  catTag: { background:"#1e293b", color:"#94a3b8", fontSize:11, padding:"3px 8px", borderRadius:4 },
  empty: { gridColumn:"1/-1", display:"flex", flexDirection:"column", alignItems:"center", gap:12, padding:"60px 0", color:"#475569" },
  emptyIcon: { fontSize:48 },
  emptyText: { fontSize:15, fontWeight:600, color:"#475569" },
  // Detalhe
  detailHeader: { display:"flex", justifyContent:"space-between", alignItems:"center" },
  backBtn: { background:"#1e293b", border:"none", color:"#94a3b8", borderRadius:8, padding:"8px 16px", fontSize:13, cursor:"pointer", fontFamily:"inherit" },
  detailWrap: { display:"flex", flexDirection:"column", gap:16 },
  detailCard: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:12, padding:20, animation:"fadeIn 0.3s ease" },
  detailCardTitle: { color:"#64748b", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:4 },
  detailProfile: { display:"flex", alignItems:"center", gap:16 },
  detailFields: { marginTop:8 },
  contatoRow: { padding:"10px 0", borderBottom:"1px solid #0f172a" },
  obraRow: { display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #0f172a" },
  // Formulário
  formHeader: { display:"flex", alignItems:"center", gap:16 },
  formTitle: { color:"#f1f5f9", fontWeight:800, fontSize:20, margin:0 },
  formWrap: { display:"flex", flexDirection:"column", gap:4 },
  formSection: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:12, padding:20, display:"flex", flexDirection:"column", gap:12 },
  sectionTitle: { color:"#94a3b8", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:1 },
  formGrid2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 },
  formGrid3: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 },
  fieldLabel: { display:"block", color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5, marginBottom:5 },
  input: { width:"100%", background:"#0f172a", border:"1px solid #1e293b", borderRadius:8, color:"#f1f5f9", padding:"9px 12px", fontSize:13, outline:"none", fontFamily:"inherit" },
  inputSm: { width:"100%", background:"#0f172a", border:"1px solid #1e293b", borderRadius:6, color:"#f1f5f9", padding:"7px 10px", fontSize:12, outline:"none", fontFamily:"inherit" },
  select: { width:"100%", background:"#0f172a", border:"1px solid #1e293b", borderRadius:8, color:"#f1f5f9", padding:"9px 12px", fontSize:13, outline:"none", fontFamily:"inherit" },
  textarea: { width:"100%", background:"#0f172a", border:"1px solid #1e293b", borderRadius:8, color:"#f1f5f9", padding:"9px 12px", fontSize:13, outline:"none", fontFamily:"inherit", resize:"vertical" },
  radioGroup: { display:"flex", gap:10 },
  radioLabel: { background:"#0f172a", border:"1px solid #1e293b", borderRadius:8, padding:"8px 20px", cursor:"pointer", color:"#64748b", fontSize:13, fontWeight:600, userSelect:"none" },
  radioActive: { background:"#1e3a5f", borderColor:"#3b82f6", color:"#60a5fa" },
  contatoFormRow: { background:"#0f172a", borderRadius:8, padding:12, border:"1px solid #1e293b" },
  catToggle: { background:"#0f172a", border:"1px solid #1e293b", borderRadius:6, color:"#64748b", padding:"6px 12px", fontSize:12, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" },
  catToggleActive: { background:"#1e3a5f", borderColor:"#3b82f6", color:"#60a5fa" },
  formActions: { display:"flex", gap:10, justifyContent:"flex-end", paddingTop:8 },
  // Botões
  btnPrimary: { background:"linear-gradient(135deg,#3b82f6,#2563eb)", color:"#fff", border:"none", borderRadius:8, padding:"10px 20px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" },
  btnSecondary: { background:"#1e293b", color:"#94a3b8", border:"none", borderRadius:8, padding:"8px 14px", fontSize:13, cursor:"pointer", fontFamily:"inherit" },
  btnCancel: { background:"#1e293b", color:"#94a3b8", border:"none", borderRadius:8, padding:"10px 20px", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit" },
  // NF
  nfHeader: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:12, padding:20 },
  dropZone: { border:"2px dashed #1e293b", borderRadius:16, padding:"60px 40px", cursor:"pointer", textAlign:"center", transition:"all 0.2s", background:"#0d1526" },
  dropZoneDone: { border:"2px dashed #3b82f6", background:"#0d1b33" },
  errorBox: { background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:8, padding:"12px 16px", color:"#f87171", fontSize:13 },
  processingBox: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:16, padding:40, textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center" },
  processingAnim: { marginBottom:8 },
  processingSteps: { display:"flex", flexDirection:"column", gap:8, marginTop:20, textAlign:"left" },
  processingStep: { display:"flex", alignItems:"center", gap:10 },
  reviewHeader: { background:"#0d2618", border:"1px solid #14532d", borderRadius:10, padding:"14px 18px" },
  reviewBadge: { color:"#4ade80", fontWeight:700, fontSize:14 },
  matchFound: { marginTop:10, color:"#4ade80", fontSize:12, background:"#052e16", padding:"6px 12px", borderRadius:6, display:"inline-block" },
  matchNew: { marginTop:10, color:"#f59e0b", fontSize:12, background:"#1c1500", padding:"6px 12px", borderRadius:6, display:"inline-block" },
  successBox: { display:"flex", flexDirection:"column", alignItems:"center", gap:16, padding:"80px 40px", textAlign:"center" },
  successIcon: { fontSize:56 },
  th: { color:"#475569", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5, padding:"10px 12px", textAlign:"left", borderBottom:"1px solid #1e293b" },
  td: { color:"#94a3b8", fontSize:13, padding:"10px 12px", verticalAlign:"middle" },
};


// ════════════════════════════════════════════════════════════
// clientes.jsx
// ════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// CLIENTES — Kanban + visual minimalista
// ═══════════════════════════════════════════════════════════════

const C = {
  input:    { border:"1px solid #e5e7eb", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#111", outline:"none", background:"#fff", fontFamily:"inherit", width:"100%", boxSizing:"border-box" },
  label:    { fontSize:12, color:"#6b7280", fontWeight:500, display:"block", marginBottom:5 },
  btn:      { background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"9px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
  btnSec:   { background:"#fff", color:"#374151", border:"1px solid #e5e7eb", borderRadius:8, padding:"9px 16px", fontSize:13, cursor:"pointer", fontFamily:"inherit" },
  btnGhost: { background:"none", border:"none", color:"#9ca3af", cursor:"pointer", fontFamily:"inherit", fontSize:13 },
  tag:      (cor) => ({ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:6, background:cor+"18", color:cor }),
  grid2:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 },
  grid3:    { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 },
  secTit:   { fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:14 },
  divider:  { border:"none", borderTop:"1px solid #f3f4f6", margin:"20px 0" },
  row:      { display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #f9fafb" },
};

const COLUNAS = [
  { key:"",             label:"Leads",         cor:"#9ca3af" },
  { key:"orcamento",    label:"Em orçamento",  cor:"#f59e0b" },
  { key:"estudo",       label:"Em estudo",     cor:"#3b82f6" },
  { key:"andamento",    label:"Em andamento",  cor:"#10b981" },
];

function ClienteExpandivel({ cliente, data, waLink }) {
  const [abertos, setAbertos] = useState({ cadastro:false, financeiro:false });
  const toggle = k => setAbertos(p => ({...p, [k]:!p[k]}));
  const cpfCliente = cliente.cpfCnpj || cliente.id;
  const lancsCli = (data.receitasFinanceiro||[]).filter(r => r.clienteId === cpfCliente || r.clienteId === cliente.id);
  const totalContabil = lancsCli.filter(r=>r.contabil1==="Receita Total"&&r.tipoConta!=="Conta Redutora").reduce((s,r)=>s+(r.valor||0),0);
  const totalRecebido = lancsCli.filter(r=>r.recebimento==="Recebido").reduce((s,r)=>s+(r.valor||0),0);
  const totalReceber  = lancsCli.filter(r=>r.recebimento==="A Receber").reduce((s,r)=>s+(r.valor||0),0);
  const fmtV = v => "R$ " + v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
  const secBtn = () => ({ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", background:"none", border:"none", borderBottom:"1px solid #f3f4f6", padding:"12px 0", cursor:"pointer", fontFamily:"inherit", color:"#374151", fontSize:13, fontWeight:600 });

  return (
    <>
      <div style={{ marginBottom:4 }}>
        <button style={secBtn()} onClick={()=>toggle("cadastro")}>
          <span>Endereço e contatos</span>
          <span style={{ fontSize:11, color:"#9ca3af" }}>{abertos.cadastro?"▲":"▼"}</span>
        </button>
        {abertos.cadastro && (
          <div style={{ padding:"16px 0", display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, borderBottom:"1px solid #f3f4f6" }}>
            <div>
              <div style={C.secTit}>Endereço</div>
              {[["CEP",cliente.cep],["Logradouro",`${cliente.logradouro||""}${cliente.numero?", "+cliente.numero:""}${cliente.complemento?" - "+cliente.complemento:""}`],["Bairro",cliente.bairro],["Cidade",`${cliente.cidade||""} — ${cliente.estado||""}`]].map(([l,v])=>(
                <div key={l} style={C.row}><span style={{fontSize:12,color:"#9ca3af"}}>{l}</span><span style={{fontSize:13,color:"#374151"}}>{v||"—"}</span></div>
              ))}
            </div>
            <div>
              <div style={C.secTit}>Contatos</div>
              {cliente.contatos?.map(ct=>(
                <div key={ct.id} style={{...C.row,alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:"#111"}}>{ct.nome} <span style={{fontWeight:400,color:"#9ca3af"}}>({ct.cargo})</span></div>
                    <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{ct.telefone}</div>
                  </div>
                  {ct.whatsapp&&ct.telefone&&<a href={waLink(ct.telefone)} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:"#16a34a",textDecoration:"none",border:"1px solid #e5e7eb",borderRadius:6,padding:"4px 10px"}}>WhatsApp</a>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div>
        <button style={secBtn()} onClick={()=>toggle("financeiro")}>
          <span>Financeiro</span>
          <span style={{fontSize:11,color:"#9ca3af"}}>{abertos.financeiro?"▲":"▼"}</span>
        </button>
        {abertos.financeiro&&(
          <div style={{padding:"16px 0",borderBottom:"1px solid #f3f4f6"}}>
            {lancsCli.length===0?<p style={{color:"#9ca3af",fontSize:13,margin:0}}>Nenhum lançamento.</p>:(
              <div style={C.grid3}>
                {[["Receita total",totalContabil,"#2563eb"],["Recebido",totalRecebido,"#16a34a"],["A receber",totalReceber,"#d97706"]].map(([l,v,cor])=>(
                  <div key={l} style={{border:"1px solid #e5e7eb",borderRadius:10,padding:"14px"}}>
                    <div style={{fontSize:11,color:"#9ca3af",fontWeight:600,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>{l}</div>
                    <div style={{fontSize:16,fontWeight:700,color:cor}}>{fmtV(v)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Clientes({ data, save }) {
  const [view, setView]               = useState("kanban");
  const [sel, setSel]                 = useState(null);
  const [busca, setBusca]             = useState("");
  const [dragId, setDragId]           = useState(null);
  const [orcView, setOrcView]         = useState(null);
  const [dragOver, setDragOver]       = useState(null);

  const emptyCliente = {
    tipo:"PF", nome:"", cpfCnpj:"", email:"", cep:"", logradouro:"", numero:"",
    complemento:"", bairro:"", cidade:"", estado:"SP",
    contatos:[{ id:uid(), nome:"", telefone:"", cargo:"", whatsapp:false }],
    observacoes:"", ativo:true, desde: new Date().toISOString().slice(0,10),
    status:"",
    servicos:{ projeto:false, acompanhamentoObra:false, gestaoObra:false, empreendimento:false }
  };
  const [form, setForm] = useState(emptyCliente);

  function openNew()     { setForm(emptyCliente); setView("form"); }
  function openEdit(c)   { setForm(c); setView("form"); }
  function openDetail(c) { setSel(c); setView("detail"); }

  function saveCliente() {
    if (!form.nome?.trim()) { alert("Informe o nome do cliente."); return; }
    const novos = form.id
      ? data.clientes.map(c => c.id === form.id ? form : c)
      : [...data.clientes, { ...form, id: uid() }];
    save({ ...data, clientes: novos });
    setView("kanban");
  }

  function removeCliente(id) {
    if (!confirm("Remover cliente?")) return;
    save({ ...data, clientes: data.clientes.filter(c => c.id !== id) });
    setView("kanban");
  }

  function moverCliente(id, novoStatus) {
    const novos = data.clientes.map(c => c.id === id ? {...c, status: novoStatus} : c);
    save({ ...data, clientes: novos });
  }

  function waLink(telefone, msg = "") {
    const num = telefone.replace(/\D/g, "");
    const numero = num.startsWith("55") ? num : `55${num}`;
    return `https://wa.me/${numero}${msg ? "?text="+encodeURIComponent(msg) : ""}`;
  }

  async function buscarCEP(cep) {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const d = await r.json();
      if (!d.erro) setForm(f => ({ ...f, logradouro: d.logradouro, bairro: d.bairro, cidade: d.localidade, estado: d.uf }));
    } catch {}
  }

  // ── KANBAN ───────────────────────────────────────────────────
  if (view === "kanban") {
    const filtrados = data.clientes.filter(c => {
      if (!busca) return true;
      const b = busca.toLowerCase();
      return c.nome.toLowerCase().includes(b) || (c.cpfCnpj||"").includes(b) || (c.cidade||"").toLowerCase().includes(b);
    });

    return (
      <div style={{ padding:"24px 28px", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", height:"calc(100vh - 53px)", display:"flex", flexDirection:"column" }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:"#111" }}>Clientes</div>
            <div style={{ fontSize:13, color:"#9ca3af", marginTop:2 }}>{data.clientes.length} cadastrado{data.clientes.length!==1?"s":""}</div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input style={{ ...C.input, width:220 }} placeholder="Buscar..." value={busca} onChange={e=>setBusca(e.target.value)} />
            <button style={C.btnSec} onClick={() => setView("list")}>Lista</button>
            <button style={C.btn} onClick={openNew}>+ Novo cliente</button>
          </div>
        </div>

        {/* Kanban */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12, flex:1, overflowY:"hidden" }}>
          {COLUNAS.map(col => {
            const cards = filtrados.filter(c => (c.status||"") === col.key);
            const isOver = dragOver === col.key;
            return (
              <div key={col.key}
                style={{ background: isOver ? col.cor+"08" : "#fafafa", border:`1px solid ${isOver ? col.cor : "#f3f4f6"}`, borderRadius:12, display:"flex", flexDirection:"column", transition:"border-color 0.15s, background 0.15s" }}
                onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => { e.preventDefault(); if (dragId) moverCliente(dragId, col.key); setDragId(null); setDragOver(null); }}>
                {/* Header coluna */}
                <div style={{ padding:"14px 16px", borderBottom:"1px solid #f3f4f6", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:col.cor }} />
                    <span style={{ fontSize:13, fontWeight:600, color:"#374151" }}>{col.label}</span>
                  </div>
                  <span style={{ fontSize:12, color:"#9ca3af", background:"#f3f4f6", borderRadius:10, padding:"1px 8px" }}>{cards.length}</span>
                </div>
                {/* Cards */}
                <div style={{ flex:1, overflowY:"auto", padding:"10px 10px" }}>
                  {cards.map(c => {
                    const iniciais = c.nome.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase();
                    const corAv = c.tipo==="PJ" ? "#7c3aed" : "#2563eb";
                    const tel = c.contatos?.find(ct=>ct.whatsapp)?.telefone || c.contatos?.[0]?.telefone || "";
                    return (
                      <div key={c.id}
                        draggable
                        onDragStart={() => setDragId(c.id)}
                        onDragEnd={() => { setDragId(null); setDragOver(null); }}
                        onClick={() => openDetail(c)}
                        style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, padding:"12px", marginBottom:8, cursor:"grab", transition:"box-shadow 0.15s, opacity 0.15s", opacity: dragId===c.id ? 0.4 : 1, boxShadow: dragId===c.id ? "0 4px 12px rgba(0,0,0,0.1)" : "none" }}
                        onMouseEnter={e=>e.currentTarget.style.borderColor="#111"}
                        onMouseLeave={e=>e.currentTarget.style.borderColor="#e5e7eb"}>
                        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                          <div style={{ width:32, height:32, borderRadius:8, background:corAv+"15", color:corAv, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, flexShrink:0 }}>
                            {iniciais}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:600, color:"#111", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.nome}</div>
                            <div style={{ fontSize:11, color:"#9ca3af", marginTop:1 }}>{c.cidade||c.cpfCnpj||""}</div>
                          </div>
                        </div>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={C.tag(corAv)}>{c.tipo}</span>
                          <div style={{ display:"flex", gap:4 }} onClick={e=>e.stopPropagation()}>
                            {tel && <a href={waLink(tel)} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:"#16a34a", textDecoration:"none", border:"1px solid #e5e7eb", borderRadius:5, padding:"2px 7px" }}>WA</a>}
                            <button onClick={()=>openEdit(c)} style={{ fontSize:11, color:"#6b7280", background:"none", border:"1px solid #e5e7eb", borderRadius:5, padding:"2px 7px", cursor:"pointer", fontFamily:"inherit" }}>Editar</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {cards.length === 0 && (
                    <div style={{ textAlign:"center", padding:"24px 0", color:"#d1d5db", fontSize:12 }}>
                      Arraste um cliente aqui
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── LISTA ───────────────────────────────────────────────────
  if (view === "list") {
    const filtrados = data.clientes.filter(c => {
      const b = busca.toLowerCase();
      return !b || c.nome.toLowerCase().includes(b) || (c.cpfCnpj||"").includes(b) || (c.cidade||"").toLowerCase().includes(b);
    });
    return (
      <div style={{ padding:"28px 32px", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:"#111" }}>Clientes</div>
          <div style={{ display:"flex", gap:8 }}>
            <input style={{ ...C.input, width:220 }} placeholder="Buscar..." value={busca} onChange={e=>setBusca(e.target.value)} />
            <button style={C.btnSec} onClick={()=>setView("kanban")}>Kanban</button>
            <button style={C.btn} onClick={openNew}>+ Novo cliente</button>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtrados.map(c => {
            const iniciais = c.nome.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase();
            const corAv = c.tipo==="PJ"?"#7c3aed":"#2563eb";
            const col = COLUNAS.find(x=>x.key===(c.status||"")) || COLUNAS[0];
            const tel = c.contatos?.find(ct=>ct.whatsapp)?.telefone||c.contatos?.[0]?.telefone||"";
            return (
              <div key={c.id} style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"14px 16px", display:"flex", alignItems:"center", gap:14, cursor:"pointer" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#111"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="#e5e7eb"}
                onClick={()=>openDetail(c)}>
                <div style={{ width:40, height:40, borderRadius:10, background:corAv+"15", color:corAv, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, flexShrink:0 }}>{iniciais}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"#111" }}>{c.nome}</div>
                  <div style={{ fontSize:12, color:"#9ca3af" }}>{c.cpfCnpj}{c.cidade?` · ${c.cidade}`:""}</div>
                </div>
                <div style={{ display:"flex", gap:6, alignItems:"center" }} onClick={e=>e.stopPropagation()}>
                  <span style={C.tag(col.cor)}>{col.label||"Sem status"}</span>
                  {tel && <a href={waLink(tel)} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:"#16a34a", textDecoration:"none", border:"1px solid #e5e7eb", borderRadius:6, padding:"4px 10px" }}>WA</a>}
                  <button onClick={()=>openEdit(c)} style={{ fontSize:12, color:"#6b7280", background:"none", border:"1px solid #e5e7eb", borderRadius:6, padding:"4px 10px", cursor:"pointer", fontFamily:"inherit" }}>Editar</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── DETALHE ─────────────────────────────────────────────────
  if (orcView) {
    async function salvarOrc(orc) {
      const todos = data.orcamentosProjeto || [];
      const maxSeq = todos.reduce((mx,o)=>{const m=(o.id||"").match(/^ORC-(\d+)$/);return m?Math.max(mx,parseInt(m[1])):mx;},0);
      const novo = {...orc, clienteId:orcView.cliente.id, cliente:orcView.cliente.nome, whatsapp:orcView.cliente.contatos?.find(c=>c.whatsapp)?.telefone||"", id:orc.id||"ORC-"+String(maxSeq+1).padStart(4,"0"), criadoEm:orc.criadoEm||new Date().toISOString()};
      const novos = orc.id ? todos.map(o=>o.id===orc.id?novo:o) : [...todos, novo];
      // salva mas NÃO fecha — o fechamento vem do onVoltar do PDF
      setOrcView(v => v ? {...v, orcBase:novo} : v);
      save({...data, orcamentosProjeto:novos}).catch(console.error);
    }
    return (
      <FormOrcamentoProjetoTeste
        clienteNome={orcView.cliente.nome}
        clienteWA={orcView.cliente.contatos?.find(c=>c.whatsapp)?.telefone||""}
        onSalvar={salvarOrc}
        orcBase={orcView.orcBase||null}
        onVoltar={()=>setOrcView(null)}
      />
    );
  }

  if (view === "detail" && sel) {
    const cliente = data.clientes.find(c => c.id === sel.id) || sel;
    const iniciais = cliente.nome.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase();
    const corAv = cliente.tipo==="PJ"?"#7c3aed":"#2563eb";
    const col = COLUNAS.find(x=>x.key===(cliente.status||""))||COLUNAS[0];

    return (
      <div style={{ padding:"28px 32px", maxWidth:780, fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28 }}>
          <button style={C.btnGhost} onClick={()=>setView("kanban")}>← Voltar</button>
          <div style={{ flex:1 }} />
          <select value={cliente.status||""} onChange={e=>moverCliente(cliente.id, e.target.value)}
            style={{ ...C.input, width:"auto", fontSize:12, padding:"6px 10px", cursor:"pointer" }}>
            {COLUNAS.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
          <button style={C.btnSec} onClick={()=>openEdit(cliente)}>Editar</button>
          <button style={{...C.btnGhost,color:"#dc2626"}} onClick={()=>removeCliente(cliente.id)}>Remover</button>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:28 }}>
          <div style={{ width:56, height:56, borderRadius:14, background:corAv+"15", color:corAv, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:700, flexShrink:0 }}>{iniciais}</div>
          <div>
            <div style={{ fontSize:20, fontWeight:700, color:"#111" }}>{cliente.nome}</div>
            <div style={{ fontSize:13, color:"#9ca3af", marginTop:3, display:"flex", alignItems:"center", gap:6 }}>
              {cliente.cpfCnpj}
              <span style={C.tag(corAv)}>{cliente.tipo}</span>
              <span style={C.tag(col.cor)}>{col.label||"Sem status"}</span>
            </div>
          </div>
        </div>
        <ClienteExpandivel cliente={cliente} data={data} waLink={waLink} />
        <hr style={C.divider} />
        <ServicosPanel
          cliente={cliente}
          data={data}
          save={save}
          onAbrirOrcamento={(orc)=>setOrcView({cliente, orcBase:orc||null})}
        />
      </div>
    );
  }

  // ── FORMULÁRIO ───────────────────────────────────────────────
  return (
    <div style={{ padding:"28px 32px", maxWidth:680, fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28 }}>
        <button style={C.btnGhost} onClick={()=>setView("kanban")}>← Voltar</button>
        <div style={{ fontSize:18, fontWeight:700, color:"#111" }}>{form.id?"Editar cliente":"Novo cliente"}</div>
      </div>
      <div style={{ marginBottom:20 }}>
        <div style={C.secTit}>Tipo de pessoa</div>
        <div style={{ display:"flex", gap:8 }}>
          {[["PF","Pessoa física"],["PJ","Pessoa jurídica"]].map(([v,l])=>(
            <button key={v} onClick={()=>setForm({...form,tipo:v})}
              style={{ border:"1px solid #e5e7eb", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:form.tipo===v?600:400, background:form.tipo===v?"#111":"#fff", color:form.tipo===v?"#fff":"#6b7280", cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom:20 }}>
        <div style={C.secTit}>Status</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {COLUNAS.map(col=>(
            <button key={col.key} onClick={()=>setForm({...form,status:col.key})}
              style={{ border:`1px solid ${form.status===col.key?col.cor:"#e5e7eb"}`, borderRadius:8, padding:"7px 16px", fontSize:12, fontWeight:form.status===col.key?600:400, background:form.status===col.key?col.cor+"15":"#fff", color:form.status===col.key?col.cor:"#6b7280", cursor:"pointer", fontFamily:"inherit" }}>
              {col.label||"Sem status"}
            </button>
          ))}
        </div>
      </div>
      <hr style={C.divider} />
      <div style={{ marginBottom:20 }}>
        <div style={C.secTit}>Dados principais</div>
        <div style={{...C.grid2,marginBottom:14}}>
          <div><label style={C.label}>{form.tipo==="PJ"?"Razão social":"Nome completo"} *</label><input style={C.input} value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} /></div>
          <div><label style={C.label}>{form.tipo==="PJ"?"CNPJ":"CPF"}</label><input style={C.input} value={form.cpfCnpj} onChange={e=>setForm({...form,cpfCnpj:e.target.value})} /></div>
        </div>
        <div style={{...C.grid2,marginBottom:14}}>
          <div><label style={C.label}>E-mail</label><input style={C.input} type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
          <div><label style={C.label}>Cliente desde</label><input style={C.input} type="date" value={form.desde} onChange={e=>setForm({...form,desde:e.target.value})} /></div>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:"#374151"}}>
          <input type="checkbox" checked={form.ativo} onChange={e=>setForm({...form,ativo:e.target.checked})} /> Cliente ativo
        </label>
      </div>
      <hr style={C.divider} />
      <div style={{ marginBottom:20 }}>
        <div style={C.secTit}>Endereço</div>
        <div style={{...C.grid3,marginBottom:14}}>
          <div><label style={C.label}>CEP</label><input style={C.input} value={form.cep} onChange={e=>{setForm({...form,cep:e.target.value});buscarCEP(e.target.value);}} placeholder="00000-000" /></div>
          <div><label style={C.label}>Logradouro</label><input style={C.input} value={form.logradouro} onChange={e=>setForm({...form,logradouro:e.target.value})} /></div>
          <div><label style={C.label}>Número</label><input style={C.input} value={form.numero} onChange={e=>setForm({...form,numero:e.target.value})} /></div>
        </div>
        <div style={{...C.grid3,marginBottom:14}}>
          <div><label style={C.label}>Complemento</label><input style={C.input} value={form.complemento} onChange={e=>setForm({...form,complemento:e.target.value})} /></div>
          <div><label style={C.label}>Bairro</label><input style={C.input} value={form.bairro} onChange={e=>setForm({...form,bairro:e.target.value})} /></div>
          <div><label style={C.label}>Cidade</label><input style={C.input} value={form.cidade} onChange={e=>setForm({...form,cidade:e.target.value})} /></div>
        </div>
        <div style={{maxWidth:120}}><label style={C.label}>Estado</label><select style={{...C.input,cursor:"pointer"}} value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>{ESTADOS_BR.map(e=><option key={e}>{e}</option>)}</select></div>
      </div>
      <hr style={C.divider} />
      <div style={{ marginBottom:20 }}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={C.secTit}>Contatos</div>
          <button style={C.btnSec} onClick={()=>setForm({...form,contatos:[...form.contatos,{id:uid(),nome:"",telefone:"",cargo:"",whatsapp:false}]})}>+ Adicionar</button>
        </div>
        {form.contatos?.map((ct,i)=>(
          <div key={ct.id} style={{border:"1px solid #f3f4f6",borderRadius:10,padding:"14px",marginBottom:10}}>
            <div style={{...C.grid3,marginBottom:10}}>
              <div><label style={C.label}>Nome</label><input style={C.input} value={ct.nome} onChange={e=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,nome:e.target.value}:x)})} /></div>
              <div><label style={C.label}>Telefone</label><input style={C.input} value={ct.telefone} onChange={e=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,telefone:e.target.value}:x)})} /></div>
              <div><label style={C.label}>Cargo</label><input style={C.input} value={ct.cargo} onChange={e=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,cargo:e.target.value}:x)})} /></div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:"#374151"}}>
                <input type="checkbox" checked={ct.whatsapp} onChange={e=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,whatsapp:e.target.checked}:x)})} />
                <span style={{color:"#16a34a"}}>WhatsApp</span>
              </label>
              {form.contatos.length>1&&<button style={{...C.btnGhost,color:"#dc2626",fontSize:12}} onClick={()=>setForm({...form,contatos:form.contatos.filter((_,j)=>j!==i)})}>Remover</button>}
            </div>
          </div>
        ))}
      </div>
      <hr style={C.divider} />
      <div style={{marginBottom:28}}>
        <div style={C.secTit}>Observações internas</div>
        <textarea style={{...C.input,resize:"vertical"}} value={form.observacoes} onChange={e=>setForm({...form,observacoes:e.target.value})} rows={3} />
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button style={C.btnSec} onClick={()=>setView("kanban")}>Cancelar</button>
        <button style={C.btn} onClick={saveCliente}>{form.id?"Salvar alterações":"Cadastrar cliente"}</button>
      </div>
    </div>
  );
}
function ModalConfirmarGanho({ orc, arqTotal, engTotal, grandTotal, data, save, onClose }) {
  function addDias(dateStr, dias) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  }

  const [inclArq, setInclArq]     = useState(true);
  const [inclEng, setInclEng]     = useState(engTotal > 0);
  const [vArq, setVArq]           = useState(Math.round(arqTotal * 100) / 100);
  const [vEng, setVEng]           = useState(Math.round(engTotal * 100) / 100);
  const [forma, setForma]         = useState("PIX");
  const nParcInicial = engTotal > 0 ? 4 : 3;
  const [nParc, setNParc]         = useState(nParcInicial);
  const [vEntrada, setVEntrada]   = useState(Math.round(grandTotal / nParcInicial * 100) / 100);
  const [dtEntrada, setDtEntrada] = useState("");
  const [parcelas, setParcelas]   = useState([]);
  const [aviso, setAviso]               = useState("");
  const [confirmarFuturo, setConfirmarFuturo] = useState(false);
  const dtEntradaRef = useRef(null);

  // Desconto antecipado: só arq = 5% / 3x, pacote completo = 10% / 4x
  const descAntec  = inclArq && inclEng ? 10 : 5;
  const nParcPadrao = inclArq && inclEng ? 4 : 3;

  const totalBase  = (inclArq ? vArq : 0) + (inclEng ? vEng : 0);
  const total      = totalBase;
  const nRest      = Math.max(nParc - 1, 1);
  const vParc      = Math.round((total - vEntrada) / nRest * 100) / 100;

  function gerarParcelas(dtEnt, n, vEnt, tot) {
    const qtd = Math.max(n - 1, 1);
    const vp  = Math.round((tot - vEnt) / qtd * 100) / 100;
    return Array.from({ length: qtd }, (_, i) => ({
      label: (i + 1) + "ª Parcela",
      valor: vp,
      data:  dtEnt ? addDias(dtEnt, (i + 1) * 30) : "",
    }));
  }

  useEffect(() => {
    // Quando muda inclArq/inclEng, ajusta nParc automaticamente
    const novoNParc = inclArq && inclEng ? 4 : 3;
    setNParc(novoNParc);
  }, [inclArq, inclEng]);

  useEffect(() => {
    const descAtual = inclArq && inclEng ? 10 : 5;
    if (forma === "Antecipado") {
      const novaEntrada = Math.round(total * (1 - descAtual/100) * 100) / 100;
      setVEntrada(novaEntrada);
      setParcelas([]);
    } else {
      const novaEntrada = Math.round(total / Math.max(nParc, 1) * 100) / 100;
      setVEntrada(novaEntrada);
      setParcelas(gerarParcelas(dtEntrada, nParc, novaEntrada, total));
    }
  }, [nParc, dtEntrada, vArq, vEng, inclArq, inclEng, forma]);

  function atualizarParcela(idx, campo, valor) {
    setParcelas(p => p.map((x, i) => i === idx ? { ...x, [campo]: valor } : x));
  }

  function confirmar(forcarFuturo) {
    const hoje = new Date().toISOString().slice(0, 10);
    setAviso("");

    // Validacao: datas obrigatorias
    if (!dtEntrada) {
      setAviso(forma === "Antecipado"
        ? "Defina a data do pagamento antes de confirmar."
        : "Defina a data da entrada antes de confirmar.");
      setTimeout(() => { if (dtEntradaRef.current) dtEntradaRef.current.focus(); }, 50);
      return;
    }
    if (forma !== "Antecipado") {
      const semData = parcelas.filter(p => p.valor > 0 && !p.data);
      if (semData.length > 0) {
        setAviso("Defina as datas de vencimento de todas as parcelas.");
        return;
      }
    }

    // Aviso: data futura — pede confirmacao inline
    const entradaFutura = dtEntrada > hoje;
    if (entradaFutura && !forcarFuturo) {
      setConfirmarFuturo(true);
      return;
    }
    setConfirmarFuturo(false);

    // ── Helper: define competencia e recebimento pela data ───────
    function tipoRecebimento(data) {
      if (!data) return { competencia:"Caixa a prazo", recebimento:"A Receber" };
      return data <= hoje
        ? { competencia:"Caixa a vista", recebimento:"Recebido" }
        : { competencia:"Caixa a prazo", recebimento:"A Receber" };
    }

    const vArqFinal  = inclArq ? vArq : 0;
    const vEngFinal  = inclEng ? vEng : 0;
    const totalFinal = Math.round((vArqFinal + vEngFinal) * 100) / 100;
    const descAtual  = inclArq && inclEng ? 10 : 5;
    const pgto       = { forma, nParcelas:nParc, entrada:vEntrada, dtEntrada, parcelas, valorArq:vArqFinal, valorEng:vEngFinal, total:totalFinal };
    const clienteCad  = (data.clientes||[]).find(c => c.id === orc.clienteId);
    const clienteCpf  = clienteCad?.cpfCnpj || orc.clienteId;
    const nomeEsc     = data.escritorio?.nome || "Padovan Arquitetos";
    const existentes = data.receitasFinanceiro || [];
    let seq = existentes.length + 1;
    const nextCod  = () => "LNC-" + String(seq++).padStart(4, "0");
    const compBase = "CMP-" + Math.floor(1000 + Math.random() * 9000);
    const lancs    = [];

    // ── Helpers ──────────────────────────────────────────────────
    // subConta1 = "Receita de Projetos" | "Caixa"
    // subConta2 = "Arquitetura" | "Engenharia"
    // competencia = "Contábil" | "Caixa a vista" | "Caixa a prazo"
    // recebimento = "Conta contábil" | "Recebido" | "A Receber"
    // periodoCaixa = data efetiva do recebimento (ou null)
    function mkLanc(sub2, valor, descricao, contabil1, subConta1, competencia, recebimento, periodoContabil, periodoCaixa) {
      return {
        id:              Math.random().toString(36).slice(2, 9),
        codigo:          nextCod(),
        nComprovante:    compBase,
        nNota:           compBase,
        orcId:           orc.id,
        clienteId:       clienteCpf,
        cliente:         orc.cliente,
        categoria:       "Projeto",
        produto:         orc.tipo || "",
        fornecedor:      nomeEsc,
        descricao,
        tipoConta:       subConta1 === "Desconto" ? "Conta Redutora" : "Conta Acrescimo",
        contabil1,
        subContabil1:    subConta1,      // "Receita de Projetos" | "Desconto"
        subContabil2:    sub2,           // "Arquitetura" | "Engenharia" | ""
        subContabil3:    "",
        subContabil4:    "",
        subContabil5:    "",
        competencia,
        recebimento,
        valor:           Math.round(valor * 100) / 100,
        dataLancamento:  hoje,
        periodoContabil: contabil1 === "Caixa" ? "" : (periodoContabil || hoje),
        periodoCaixa:    periodoCaixa || "",
        forma,
      };
    }

    // ── Lançamentos contábeis (Receita Total) — 1 por serviço ───
    // Registra o valor TOTAL do serviço na competência contábil
    if (inclArq) lancs.push(mkLanc("Arquitetura", vArqFinal,
      "Receita de Projetos", "Receita Total", "Receita de Projetos",
      "Contábil", "Conta contábil", hoje, null));

    if (inclEng) lancs.push(mkLanc("Engenharia", vEngFinal,
      "Receita de Projetos", "Receita Total", "Receita de Projetos",
      "Contábil", "Conta contábil", hoje, null));

    // ── Lançamentos de Caixa — 1 por parcela por serviço ────────
    const todasParcelas = [];

    if (forma === "Antecipado") {
      // Pagamento antecipado — 4 linhas conforme Excel:
      // 1. Receita Total > Receita de Projetos > Arquitetura (valor bruto)
      // 2. Receita Total > Receita de Projetos > Engenharia (valor bruto)
      // 3. Receita Total > Desconto (conta redutora, valor do desconto)
      // 4. Caixa > Receita de Projetos (valor liquido = bruto - desconto)
      const dataReceb    = dtEntrada || hoje;
      const descAtualPct = inclArq && inclEng ? 10 : 5;
      const valorBruto   = Math.round((vArqFinal + vEngFinal) * 100) / 100;
      const valorDesc    = Math.round(valorBruto * descAtualPct / 100 * 100) / 100;
      const valorLiquido = Math.round((valorBruto - valorDesc) * 100) / 100;

      // Linha 3: conta redutora de desconto
      lancs.push(mkLanc("", valorDesc,
        "Receita de Projetos", "Receita Total", "Desconto",
        "Contabil", "Conta contabil", hoje, null));

      // Linha 4: caixa a vista com valor liquido (sem sub conta 2)
      const trAntec = tipoRecebimento(dataReceb);
      lancs.push(mkLanc("", valorLiquido,
        "Fluxo de caixa projetos", "Caixa", "Receita de Projetos",
        trAntec.competencia, trAntec.recebimento, hoje, dataReceb));

    } else {
      // Parcelado — entrada + parcelas (valor total sem desmembrar)
      if (vEntrada > 0 && dtEntrada) {
        const trEnt = tipoRecebimento(dtEntrada);
        lancs.push(mkLanc("Arquitetura", vEntrada,
          "Fluxo de caixa projetos", "Caixa", "Receita de Projetos",
          trEnt.competencia, trEnt.recebimento, hoje, dtEntrada));
      }
      parcelas.forEach(p => {
        if (p.valor > 0 && p.data) {
          const trParc = tipoRecebimento(p.data);
          lancs.push(mkLanc("", p.valor,
            "Fluxo de caixa projetos", "Caixa", "Receita de Projetos",
            trParc.competencia, trParc.recebimento, hoje, p.data));
        }
      });
    }

    const novosOrc  = (data.orcamentosProjeto || []).map(o => o.id===orc.id ? {...o, status:"ganho", pagamento:pgto} : o);
    const novosLanc = [...existentes, ...lancs];
    onClose();
    save({ ...data, orcamentosProjeto:novosOrc, receitasFinanceiro:novosLanc }).catch(console.error);
  }

  const inp = { background:"#0a1122", border:"1px solid #1e293b", borderRadius:6, color:"#f1f5f9", padding:"7px 10px", fontSize:13, outline:"none", fontFamily:"inherit", width:"100%", boxSizing:"border-box" };
  const lbl = { color:"#64748b", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 };
  const sec = { color:"#94a3b8", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:10 };
  const fmtV = v => "R$ " + (v||0).toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:14, padding:"28px 32px", width:"100%", maxWidth:580, boxShadow:"0 24px 48px rgba(0,0,0,0.7)", maxHeight:"90vh", overflowY:"auto" }}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <div style={{ color:"#10b981", fontWeight:700, fontSize:16 }}>Confirmar Ganho</div>
            <div style={{ color:"#64748b", fontSize:12, marginTop:3 }}>{orc.cliente} — {orc.tipo}</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#64748b", fontSize:20, cursor:"pointer" }}>X</button>
        </div>

        <div style={sec}>Valores do Contrato</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
          {/* Arquitetura */}
          <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:12, alignItems:"center",
            background: inclArq ? "#0a1526" : "#080e1a", border:"1px solid " + (inclArq ? "#1e293b" : "#0f172a"),
            borderRadius:8, padding:"10px 14px", opacity: inclArq ? 1 : 0.5 }}>
            <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", userSelect:"none" }}>
              <input type="checkbox" checked={inclArq} onChange={e => setInclArq(e.target.checked)}
                style={{ width:16, height:16, accentColor:"#3b82f6", cursor:"pointer" }} />
              <span style={{ ...lbl, margin:0 }}>Arquitetura (R$)</span>
            </label>
            <input
              defaultValue={vArq.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 })}
              disabled={!inclArq}
              onBlur={e => {
                const v = parseFloat(e.target.value.replace(/\./g,"").replace(",",".")) || arqTotal;
                setVArq(v);
                e.target.value = v.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
              }}
              style={{ ...inp, opacity: inclArq ? 1 : 0.4 }} />
          </div>
          {/* Engenharia */}
          {engTotal > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:12, alignItems:"center",
              background: inclEng ? "#0a1526" : "#080e1a", border:"1px solid " + (inclEng ? "#1e293b" : "#0f172a"),
              borderRadius:8, padding:"10px 14px", opacity: inclEng ? 1 : 0.5 }}>
              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", userSelect:"none" }}>
                <input type="checkbox" checked={inclEng} onChange={e => setInclEng(e.target.checked)}
                  style={{ width:16, height:16, accentColor:"#a78bfa", cursor:"pointer" }} />
                <span style={{ ...lbl, margin:0 }}>Engenharia (R$)</span>
              </label>
              <input
                defaultValue={vEng.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 })}
                disabled={!inclEng}
                onBlur={e => {
                  const v = parseFloat(e.target.value.replace(/\./g,"").replace(",",".")) || engTotal;
                  setVEng(v);
                  e.target.value = v.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
                }}
                style={{ ...inp, opacity: inclEng ? 1 : 0.4 }} />
            </div>
          )}
          {/* Total */}
          <div style={{ background:"#0d1526", border:"1px solid #10b981", borderRadius:8, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ color:"#64748b", fontSize:13 }}>Total contratado</span>
            <span style={{ color:"#10b981", fontWeight:800, fontSize:16 }}>{fmtV(total)}</span>
          </div>
        </div>

        <div style={sec}>Forma de Pagamento</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            <label style={lbl}>Forma de Pagamento</label>
            <select value={forma} onChange={e => {
              const f = e.target.value;
              setForma(f);
              if (f === "Antecipado") {
                const descAtual = inclArq && inclEng ? 10 : 5;
                setVEntrada(Math.round(total * (1 - descAtual/100) * 100) / 100);
                setNParc(1);
                setParcelas([]);
              } else {
                const novoNParc = inclArq && inclEng ? 4 : 3;
                setVEntrada(Math.round(total / novoNParc * 100) / 100);
                setNParc(novoNParc);
              }
            }} style={{ ...inp, cursor:"pointer" }}>
              <option>Antecipado</option>
              <option>PIX</option><option>Transferencia</option><option>Boleto</option><option>Cheque</option><option>Dinheiro</option>
            </select>
            {forma === "Antecipado" && (
              <div style={{ color:"#10b981", fontSize:11, marginTop:3 }}>
                {inclArq && inclEng ? 10 : 5}% de desconto — {inclArq && inclEng ? "Pacote Completo" : inclArq ? "Apenas Arquitetura" : "Apenas Engenharia"} · {fmtV(Math.round(total*(1-(inclArq && inclEng ? 0.10 : 0.05))*100)/100)} à vista
              </div>
            )}
          </div>
          {forma !== "Antecipado" && (
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              <label style={lbl}>Parcelas (inclui entrada)</label>
              <input type="number" min="1" max="60" value={nParc}
                onChange={e => setNParc(parseInt(e.target.value) || 1)}
                style={inp} />
              <div style={{ color:"#64748b", fontSize:11, marginTop:3 }}>
                Sugerido: {nParcPadrao}x ({inclArq && inclEng ? "Pacote" : "Apenas Arq."})
              </div>
            </div>
          )}
        </div>

        <div style={{ background:"#0a1526", border:"1px solid #1e293b", borderRadius:8, padding:14, marginBottom:12 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:8 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              <label style={lbl}>{forma === "Antecipado" ? "Valor Total com Desconto (R$)" : "Valor da Entrada (R$)"}</label>
              <input
                key={vEntrada}
                defaultValue={vEntrada.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 })}
                onBlur={e => {
                  const v = parseFloat(e.target.value.replace(/\./g,"").replace(",",".")) || 0;
                  setVEntrada(v);
                  e.target.value = v.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
                }}
                style={inp} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              <label style={lbl}>Data da Entrada</label>
              <input ref={dtEntradaRef} type="date" value={dtEntrada}
                onChange={e=>{ setDtEntrada(e.target.value); setAviso(""); setConfirmarFuturo(false); }}
                style={{ ...inp, colorScheme:"dark", cursor:"pointer", borderColor: aviso&&!dtEntrada?"#f87171":"" }} />
            </div>
          </div>
          {forma !== "Antecipado" && nRest > 0 && (
            <div style={{ color:"#64748b", fontSize:11 }}>
              Restante: <span style={{ color:"#f1f5f9", fontWeight:600 }}>{fmtV(total - vEntrada)}</span> em {nRest} {nRest === 1 ? "parcela" : "parcelas"} de <span style={{ color:"#f1f5f9", fontWeight:600 }}>{fmtV(vParc)}</span>
            </div>
          )}
        </div>

        {forma !== "Antecipado" && parcelas.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
            {parcelas.map((p, i) => (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"80px 1fr 1fr", gap:12, alignItems:"center", background:"#0a1122", borderRadius:7, padding:"10px 12px", border:"1px solid #1e293b" }}>
                <div style={{ color:"#94a3b8", fontSize:12, fontWeight:600 }}>{p.label}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={{ ...lbl, fontSize:10 }}>Valor (R$)</label>
                  <input
                    key={p.valor + "-" + i}
                    defaultValue={p.valor.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 })}
                    onBlur={e => {
                      const v = parseFloat(e.target.value.replace(/\./g,"").replace(",",".")) || 0;
                      atualizarParcela(i, "valor", v);
                      e.target.value = v.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
                    }}
                    style={inp} />
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={{ ...lbl, fontSize:10 }}>Vencimento</label>
                  <input type="date" value={p.data}
                    onChange={e => {
                      if (!dtEntrada) {
                        setAviso("Defina primeiro a data da entrada antes de definir as parcelas.");
                        setTimeout(() => { if (dtEntradaRef.current) dtEntradaRef.current.focus(); }, 50);
                        return;
                      }
                      atualizarParcela(i, "data", e.target.value);
                    }}
                    style={{ ...inp, colorScheme:"dark", cursor:"pointer" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ background:"#0d1526", border:"1px solid #1e293b", borderRadius:8, padding:"12px 14px", marginBottom:20 }}>
          <div style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Receitas que serão lançadas</div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
            <span style={{ color: inclArq ? "#94a3b8" : "#334155" }}>Arquitetura</span>
            <span style={{ color: inclArq ? "#3b82f6" : "#334155", fontWeight:600 }}>{inclArq ? fmtV(vArq) : "—"}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
            <span style={{ color: inclEng ? "#94a3b8" : "#334155" }}>Engenharia</span>
            <span style={{ color: inclEng ? "#a78bfa" : "#334155", fontWeight:600 }}>{inclEng ? fmtV(vEng) : "—"}</span>
          </div>
          {forma === "Antecipado" && (() => {
            const descPct  = inclArq && inclEng ? 10 : 5;
            const vArqR    = Math.round((inclArq ? vArq : 0) * 100) / 100;
            const vEngR    = Math.round((inclEng ? vEng : 0) * 100) / 100;
            const totalR   = Math.round((vArqR + vEngR) * 100) / 100;
            const liquidoR = Math.round(totalR * (1 - descPct/100) * 100) / 100;
            const descR    = Math.round((totalR - liquidoR) * 100) / 100;
            return (
              <>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginTop:6, color:"#f87171" }}>
                  <span>(-) Desconto Concedido ({descPct}%)</span>
                  <span style={{ fontWeight:600 }}>− {fmtV(descR)}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginTop:8, paddingTop:8, borderTop:"1px solid #1e293b" }}>
                  <span style={{ color:"#64748b", fontWeight:700 }}>Líquido recebido</span>
                  <span style={{ color:"#10b981", fontWeight:800 }}>{fmtV(liquidoR)}</span>
                </div>
              </>
            );
          })()}
          {forma !== "Antecipado" && (
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginTop:8, paddingTop:8, borderTop:"1px solid #1e293b" }}>
              <span style={{ color:"#64748b", fontWeight:700 }}>Total contratado</span>
              <span style={{ color:"#10b981", fontWeight:800 }}>{fmtV(Math.round(total * 100) / 100)}</span>
            </div>
          )}
        </div>

        {aviso && (
          <div style={{ background:"rgba(248,113,113,0.12)", border:"1px solid #f87171", borderRadius:7,
            padding:"10px 14px", marginBottom:12, color:"#f87171", fontSize:12, fontWeight:600 }}>
            {aviso}
          </div>
        )}

        {confirmarFuturo && (
          <div style={{ background:"rgba(245,158,11,0.12)", border:"1px solid #f59e0b", borderRadius:7,
            padding:"12px 14px", marginBottom:12 }}>
            <div style={{ color:"#fbbf24", fontSize:12, fontWeight:600, marginBottom:10 }}>
              A data {forma === "Antecipado" ? "do pagamento" : "da entrada"} ({new Date(dtEntrada+"T00:00:00").toLocaleDateString("pt-BR")}) e futura. O lancamento sera contabilizado como A Receber. Confirmar assim mesmo?
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setConfirmarFuturo(false)}
                style={{ background:"#1e293b", color:"#94a3b8", border:"1px solid #334155", borderRadius:6, padding:"6px 16px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                Nao, corrigir data
              </button>
              <button onClick={()=>confirmar(true)}
                style={{ background:"#f59e0b", color:"#000", border:"none", borderRadius:6, padding:"6px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                Sim, confirmar assim
              </button>
            </div>
          </div>
        )}

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ background:"#1e293b", color:"#94a3b8", border:"1px solid #334155", borderRadius:7, padding:"9px 20px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
          {!confirmarFuturo && (
            <button onClick={()=>confirmar(false)} style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:7, padding:"9px 20px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Confirmar Ganho</button>
          )}
        </div>

      </div>
    </div>
  );
}

function ServicosPanel({ cliente: clienteProp, data, save, onAbrirOrcamento }) {
  const [modalServico, setModalServico] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [openMenu, setOpenMenu]         = useState(null);
  const [modalGanho, setModalGanho]     = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!openMenu) return;
    const handler = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu]);

  const cliente = data.clientes.find(c => c.id === clienteProp.id) || clienteProp;

  const SERVICOS_DEF = [
    { key:"projeto",            label:"Projeto",               cor:"#2563eb", subacoes:[{ key:"orcamento", label:"Orçar projeto" }] },
    { key:"acompanhamentoObra", label:"Acompanhamento de obra", cor:"#d97706", subacoes:[] },
    { key:"gestaoObra",         label:"Gestão de obra",         cor:"#16a34a", subacoes:[] },
    { key:"empreendimento",     label:"Empreendimento",          cor:"#7c3aed", subacoes:[] },
  ];

  const orcamentos = (data.orcamentosProjeto || []).filter(o => o.clienteId === cliente.id);

  const btnSm = { fontSize:12, color:"#6b7280", background:"#fff", border:"1px solid #e5e7eb", borderRadius:6, padding:"4px 10px", cursor:"pointer", fontFamily:"inherit" };

  return (
    <div>
      {/* Header serviços */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1 }}>Serviços</div>
        <button style={{ background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"7px 16px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}
          onClick={()=>setModalServico("menu")}>+ Cadastrar serviço</button>
      </div>

      {/* Serviços ativos */}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {SERVICOS_DEF.filter(s => cliente.servicos?.[s.key]).map(s => {
          const STATUS_ORC = {
            ganho:   { label:"Ganho",   cor:"#16a34a" },
            perdido: { label:"Perdido", cor:"#dc2626" },
          };
          const setStatusOrc = async (orcId, novoStatus) => {
            const todos = data.orcamentosProjeto || [];
            const orc = todos.find(o => o.id === orcId);
            let novosLanc = data.receitasFinanceiro || [];
            if (orc && orc.status === "ganho" && novoStatus === "perdido") novosLanc = novosLanc.filter(r => r.orcId !== orcId);
            const novosOrc = todos.map(o => o.id===orcId ? {...o, status:novoStatus} : o);
            await save({ ...data, orcamentosProjeto: novosOrc, receitasFinanceiro: novosLanc });
          };
          return (
            <div key={s.key} style={{ border:"1px solid #e5e7eb", borderRadius:10, padding:"14px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: s.key==="projeto"&&orcamentos.length>0 ? 12 : 0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:s.cor }} />
                  <span style={{ fontSize:14, fontWeight:600, color:"#111" }}>{s.label}</span>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  {s.subacoes.map(sa => (
                    <button key={sa.key}
                      style={{ ...btnSm, color:s.cor, borderColor:s.cor+"40", fontWeight:600 }}
                      onClick={()=>{ if(s.key==="projeto"&&sa.key==="orcamento") onAbrirOrcamento(null); }}>
                      {sa.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orçamentos */}
              {s.key === "projeto" && orcamentos.length > 0 && (
                <div style={{ borderTop:"1px solid #f3f4f6", paddingTop:10 }}>
                  <div style={{ fontSize:11, color:"#9ca3af", fontWeight:600, textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>Orçamentos</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {orcamentos.map(o => {
                      const r = o.resultado || {};
                      const nUnid = r.nUnidades || 1;
                      const arqTotal = Math.round((r.precoTotal || r.precoFinal || 0) * 100) / 100;
                      const engUnit = Math.round((r.engTotal ?? calcularEngenharia(r.areaTotal||0).totalEng) * 100) / 100;
                      const engTotalRepet = Math.round((engUnit * (nUnid > 1 ? (1 + (r.repeticaoFaixas||[]).reduce((s,f)=>s+f.pct,0)) : 1)) * 100) / 100;
                      const grandTotal = Math.round((arqTotal + engTotalRepet) * 100) / 100;
                      const st = o.status ? STATUS_ORC[o.status] : null;
                      return (
                        <div key={o.id} style={{ background:"#fafafa", border:"1px solid #f3f4f6", borderRadius:8, padding:"12px 14px", borderLeft: st ? `3px solid ${st.cor}` : "3px solid #e5e7eb" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              {/* Linha 1: tipo + status + ID */}
                              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:6 }}>
                                <span style={{ fontSize:13, fontWeight:700, color:"#111" }}>{o.tipo} — {o.subtipo}</span>
                                {st && <span style={{ fontSize:11, fontWeight:600, padding:"1px 8px", borderRadius:6, background:st.cor+"15", color:st.cor }}>{st.label}</span>}
                                <span style={{ fontSize:10, color:"#d1d5db", fontFamily:"monospace" }}>{o.id}</span>
                              </div>
                              {/* Linha 2: referência */}
                              {o.referencia && <div style={{ fontSize:12, color:"#374151", fontWeight:500, marginBottom:4 }}>📍 {o.referencia}</div>}
                              {/* Linha 3: padrão + tamanho + área */}
                              <div style={{ fontSize:12, color:"#9ca3af", marginBottom:6 }}>
                                Padrão: <strong style={{ color:"#6b7280" }}>{o.padrao}</strong>
                                {" · "}Tamanho: <strong style={{ color:"#6b7280" }}>{o.tamanho}</strong>
                                {" · "}{fmtA(r.areaTotal,0)}m²
                                {nUnid>1 && <> · <strong style={{ color:"#2563eb" }}>{nUnid} unidades</strong></>}
                              </div>
                              {/* Linha 4: valores */}
                              <div style={{ display:"flex", gap:12, marginBottom:6, flexWrap:"wrap" }}>
                                <span style={{ fontSize:12, color:"#6b7280" }}>Arq.: <strong style={{ color:"#2563eb" }}>{fmt(arqTotal)}</strong>{r.areaTotal>0 && <span style={{ color:"#9ca3af", fontSize:11 }}> ({fmt(Math.round(arqTotal/(r.areaTotal||1)*100)/100)}/m²)</span>}</span>
                                <span style={{ fontSize:12, color:"#6b7280" }}>Eng.: <strong style={{ color:"#7c3aed" }}>{fmt(engTotalRepet)}</strong>{r.areaTotal>0 && <span style={{ color:"#9ca3af", fontSize:11 }}> ({fmt(Math.round(engTotalRepet/(r.areaTotal||1)*100)/100)}/m²)</span>}</span>
                                <span style={{ fontSize:12, color:"#6b7280", marginLeft:"auto" }}>Total: <strong style={{ color:"#111", fontSize:14 }}>{fmt(grandTotal)}</strong></span>
                              </div>
                              {/* Linha 5: data + contador + contato */}
                              {(() => {
                                const criado = o.criadoEm ? new Date(o.criadoEm) : null;
                                const diasPassados = criado ? Math.floor((Date.now() - criado.getTime()) / 86400000) : null;
                                return (
                                  <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
                                    {criado && <span style={{ fontSize:11, color:"#9ca3af" }}>Enviado: <strong style={{ color:"#6b7280" }}>{criado.toLocaleDateString("pt-BR")}</strong></span>}
                                    {diasPassados !== null && <span style={{ fontSize:11, color: diasPassados > 7 ? "#dc2626" : "#9ca3af" }}>⏱ {diasPassados === 0 ? "hoje" : `${diasPassados} dia${diasPassados!==1?"s":""}`}</span>}
                                    <span style={{ fontSize:11, color:"#9ca3af" }}>2º contato: <strong style={{ color: o.segundoContato ? "#16a34a" : "#dc2626" }}>{o.segundoContato ? "Sim" : "Não"}</strong></span>
                                    {!o.segundoContato && <button onClick={e=>{e.stopPropagation();const novosOrc=(data.orcamentosProjeto||[]).map(x=>x.id===o.id?{...x,segundoContato:true}:x);save({...data,orcamentosProjeto:novosOrc});}} style={{ fontSize:11, color:"#16a34a", background:"none", border:"1px solid #e5e7eb", borderRadius:5, padding:"1px 8px", cursor:"pointer", fontFamily:"inherit" }}>Marcar</button>}
                                  </div>
                                );
                              })()}
                            </div>
                            <div style={{ display:"flex", gap:4, marginLeft:12, flexShrink:0 }}>
                              <button style={btnSm} onClick={()=>onAbrirOrcamento(o)}>Ver</button>
                              <button style={btnSm} onClick={()=>onAbrirOrcamento(o)}>Editar</button>
                              <div style={{ position:"relative" }}>
                                <button onClick={()=>setOpenMenu(openMenu===o.id?null:o.id)}
                                  style={{ ...btnSm, padding:"4px 8px", fontSize:16, lineHeight:1 }}>⋯</button>
                                {openMenu === o.id && (
                                  <div ref={menuRef} style={{ position:"absolute", right:0, top:"calc(100% + 4px)", zIndex:999, background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, boxShadow:"0 4px 16px rgba(0,0,0,0.1)", minWidth:160, overflow:"hidden" }}>
                                    <button disabled={o.status==="ganho"}
                                      onClick={()=>{ if(o.status!=="ganho"){setModalGanho({orc:o,arqTotal,engTotal:engTotalRepet,grandTotal});setOpenMenu(null);} }}
                                      style={{ display:"block", width:"100%", textAlign:"left", background: o.status==="ganho"?"#f0fdf4":"transparent", border:"none", borderBottom:"1px solid #f3f4f6", color: o.status==="ganho"?"#16a34a":"#374151", padding:"9px 14px", fontSize:13, cursor: o.status==="ganho"?"not-allowed":"pointer", fontFamily:"inherit", fontWeight: o.status==="ganho"?600:400 }}>
                                      {o.status==="ganho"?"Ganho ✓":"Ganho"}
                                    </button>
                                    <button onClick={()=>{setStatusOrc(o.id,o.status==="perdido"?null:"perdido");setOpenMenu(null);}}
                                      style={{ display:"block", width:"100%", textAlign:"left", background: o.status==="perdido"?"#fef2f2":"transparent", border:"none", borderBottom:"1px solid #f3f4f6", color: o.status==="perdido"?"#dc2626":"#374151", padding:"9px 14px", fontSize:13, cursor:"pointer", fontFamily:"inherit", fontWeight: o.status==="perdido"?600:400 }}>
                                      {o.status==="perdido"?"Perdido ✓":o.status==="ganho"?"Perdido (estorna)":"Perdido"}
                                    </button>
                                    <button onClick={()=>{setConfirmDelete(o.id);setOpenMenu(null);}}
                                      style={{ display:"block", width:"100%", textAlign:"left", background:"transparent", border:"none", color:"#dc2626", padding:"9px 14px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                                      Descartar
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {!SERVICOS_DEF.some(s => cliente.servicos?.[s.key]) && (
          <div style={{ textAlign:"center", padding:"24px 0", color:"#d1d5db", fontSize:13 }}>
            Nenhum serviço cadastrado.
          </div>
        )}
      </div>

      {modalGanho && <ModalConfirmarGanho orc={modalGanho.orc} arqTotal={modalGanho.arqTotal} engTotal={modalGanho.engTotal} grandTotal={modalGanho.grandTotal} data={data} save={save} onClose={()=>setModalGanho(null)} />}

      {confirmDelete && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"28px 32px", maxWidth:380, width:"90%", boxShadow:"0 20px 40px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize:16, fontWeight:700, color:"#111", marginBottom:8 }}>Excluir orçamento?</div>
            <div style={{ fontSize:13, color:"#6b7280", marginBottom:24, lineHeight:1.6 }}>Esta ação não pode ser desfeita.</div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={()=>setConfirmDelete(null)} style={{ background:"#fff", color:"#374151", border:"1px solid #e5e7eb", borderRadius:7, padding:"8px 18px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
              <button onClick={async()=>{ const id=confirmDelete; setConfirmDelete(null); const novos=(data.orcamentosProjeto||[]).filter(x=>x.id!==id); save({...data,orcamentosProjeto:novos}).catch(console.error); }}
                style={{ background:"#dc2626", color:"#fff", border:"none", borderRadius:7, padding:"8px 18px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cadastrar serviço */}
      {modalServico === "menu" && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#fff", borderRadius:14, padding:"28px", width:"100%", maxWidth:480, boxShadow:"0 20px 40px rgba(0,0,0,0.15)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={{ fontSize:16, fontWeight:700, color:"#111" }}>Cadastrar serviço</div>
              <button onClick={()=>setModalServico(null)} style={{ background:"none", border:"none", color:"#9ca3af", fontSize:20, cursor:"pointer" }}>×</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {SERVICOS_DEF.map(s => {
                const ativo = cliente.servicos?.[s.key];
                return (
                  <button key={s.key}
                    style={{ display:"flex", alignItems:"center", gap:14, background:"#fff", border:`1px solid ${ativo?s.cor:"#e5e7eb"}`, borderRadius:10, padding:"14px 16px", cursor:"pointer", fontFamily:"inherit", width:"100%", textAlign:"left" }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=s.cor}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=ativo?s.cor:"#e5e7eb"}
                    onClick={()=>{
                      const novosServicos = { ...cliente.servicos, [s.key]: true };
                      const novosClientes = data.clientes.map(c => c.id===cliente.id ? {...c,servicos:novosServicos} : c);
                      save({ ...data, clientes: novosClientes });
                      if (s.key === "projeto") setModalServico("projeto");
                      else setModalServico(null);
                    }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:s.cor, flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:600, color: ativo?s.cor:"#111" }}>
                        {s.label} {ativo && <span style={{ fontSize:11, color:"#16a34a" }}>● Ativo</span>}
                      </div>
                      <div style={{ fontSize:12, color:"#9ca3af", marginTop:2 }}>
                        {s.key==="projeto"&&"Elaboração de projetos com orçamento"}
                        {s.key==="acompanhamentoObra"&&"Visitas técnicas e relatórios periódicos"}
                        {s.key==="gestaoObra"&&"Gestão completa de custos e cronograma"}
                        {s.key==="empreendimento"&&"Incorporação ou desenvolvimento imobiliário"}
                      </div>
                    </div>
                    <span style={{ color:"#9ca3af", fontSize:18 }}>›</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal projeto */}
      {modalServico === "projeto" && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#fff", borderRadius:14, padding:"28px", width:"100%", maxWidth:420, boxShadow:"0 20px 40px rgba(0,0,0,0.15)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={{ fontSize:16, fontWeight:700, color:"#111" }}>Projeto</div>
              <button onClick={()=>setModalServico(null)} style={{ background:"none", border:"none", color:"#9ca3af", fontSize:20, cursor:"pointer" }}>×</button>
            </div>
            <p style={{ fontSize:13, color:"#6b7280", margin:"0 0 16px" }}>O que deseja fazer para {cliente.nome.split(" ")[0]}?</p>
            <button style={{ display:"flex", alignItems:"center", gap:14, background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, padding:"14px 16px", cursor:"pointer", fontFamily:"inherit", width:"100%", textAlign:"left" }}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#2563eb"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="#e5e7eb"}
              onClick={()=>{setModalServico(null);onAbrirOrcamento(null);}}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:"#111" }}>Orçar projeto</div>
                <div style={{ fontSize:12, color:"#9ca3af" }}>Calcular valor com base nos cômodos e padrão</div>
              </div>
              <span style={{ color:"#9ca3af", fontSize:18 }}>›</span>
            </button>
            <button style={{ marginTop:10, background:"none", border:"none", color:"#9ca3af", fontSize:13, cursor:"pointer", fontFamily:"inherit", padding:"8px 0" }} onClick={()=>setModalServico("menu")}>← Voltar</button>
          </div>
        </div>
      )}
    </div>
  );
}


// ════════════════════════════════════════════════════════════
// orcamento-form.jsx
// ════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// FORMULÁRIO DE ORÇAMENTO
// ═══════════════════════════════════════════════════════════════
var TIPOS_INLINE = { "Residencial":["Construção nova","Reforma"], "Clínica":["Construção nova","Reforma"], "Comercial":["Construção nova","Reforma"], "Galpao":["Construção nova","Reforma"] };
var TIPOLOGIAS   = ["Térrea","Sobrado","Duplex","Cobertura"];
var PADROES      = ["Alto","Médio","Baixo"];
var TAMANHOS     = ["Grande","Médio","Pequeno","Compacta"];

function MiniParam({ blocoKey, padraoKey, tamanhoKey, cfg, setCfg }) {
  const [aberto, setAberto] = React.useState(null);
  const pv = cfg[padraoKey] || "Médio";
  const tv = cfg[tamanhoKey] || "Médio";
  const chipSt = (ativo) => ({ display:"flex", alignItems:"center", gap:4, background: ativo?"#1e3a5f":"#0f172a", border:`1px solid ${ativo?"#3b82f6":"#1e293b"}`, borderRadius:6, padding:"2px 8px", cursor:"pointer", fontSize:11, color:"#e2e8f0", whiteSpace:"nowrap" });
  return (
    <div style={{ marginLeft:"auto", display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
        <div style={chipSt(aberto==="padrao")} onClick={()=>setAberto(a=>a==="padrao"?null:"padrao")}>
          <span style={{ color:"#64748b", fontSize:10 }}>Padrão</span>
          <span style={{ color: pv==="Alto"?"#f59e0b":(pv==="Médio"?"#60a5fa":"#94a3b8"), fontWeight:700 }}>★ {pv}</span>
        </div>
        <div style={chipSt(aberto==="tamanho")} onClick={()=>setAberto(a=>a==="tamanho"?null:"tamanho")}>
          <span style={{ color:"#64748b", fontSize:10 }}>Cômodos</span>
          <span style={{ fontWeight:700 }}>📐 {tv}</span>
        </div>
      </div>
      {aberto && (
        <div style={{ display:"flex", gap:6, background:"#0f172a", border:"1px solid #1e293b", borderRadius:8, padding:"6px 10px" }}>
          {aberto==="padrao" && PADROES.map(p => (
            <div key={p} onClick={()=>{ setCfg(c=>({...c,[padraoKey]:p})); setAberto(null); }}
              style={{ padding:"3px 10px", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight: pv===p?700:400,
                background: pv===p?"#1e3a5f":"transparent", color: pv===p?"#60a5fa":"#94a3b8", border:`1px solid ${pv===p?"#3b82f6":"transparent"}` }}>
              {p}
            </div>
          ))}
          {aberto==="tamanho" && TAMANHOS.map(t => (
            <div key={t} onClick={()=>{ setCfg(c=>({...c,[tamanhoKey]:t})); setAberto(null); }}
              style={{ padding:"3px 10px", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight: tv===t?700:400,
                background: tv===t?"#1e3a5f":"transparent", color: tv===t?"#60a5fa":"#94a3b8", border:`1px solid ${tv===t?"#3b82f6":"transparent"}` }}>
              {t}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FormOrcamentoProjeto({ onSalvar, orcBase, clienteNome, clienteWA, onVoltar }) {
  const [step, setStep] = useState(1); // 1=config, 2=comodos
  const [cfg, setCfg] = useState({
    cliente: orcBase?.cliente || clienteNome || "",
    whatsapp: orcBase?.whatsapp || clienteWA || "",
    tipo: (orcBase?.tipo === "Galeria" ? "Comercial" : orcBase?.tipo === "Galpão" ? "Galpao" : orcBase?.tipo) || "Residencial",
    subtipo: orcBase?.subtipo || "Construção nova",
    padrao: orcBase?.padrao || "Médio",
    tipologia: orcBase?.tipologia || "Sobrado",
    tamanho: orcBase?.tamanho || "Médio",
    precoBase: orcBase?.precoBase || getTipoConfig(orcBase?.tipo || "Residencial").precoBase,
    nLojas: orcBase?.nLojas || 0,
    nAncoras: orcBase?.nAncoras || 0,
    nApartamentos: orcBase?.nApartamentos || 0,
    // Parametros independentes por bloco (Comercial)
    padraoLoja:   orcBase?.padraoLoja   || "Médio",
    tamanhoLoja:  orcBase?.tamanhoLoja  || "Médio",
    padraoAncora: orcBase?.padraoAncora || "Médio",
    tamanhoAncora:orcBase?.tamanhoAncora|| "Médio",
    padraoApto:   orcBase?.padraoApto   || "Médio",
    tamanhoApto:  orcBase?.tamanhoApto  || "Médio",
    nGalpoes:     orcBase?.nGalpoes     || 0,
    padraoGalpao: orcBase?.padraoGalpao || "Médio",
    tamanhoGalpao:orcBase?.tamanhoGalpao|| "Médio",
    repeticao: orcBase?.repeticao || false,
    nUnidades: orcBase?.nUnidades || 1,
    tipoPagamento: orcBase?.tipoPagamento || "padrao", // "padrao" | "etapas"
    etapasPct: orcBase?.etapasPct || [
      { id:1, nome:"Estudo de Viabilidade", pct:10 },
      { id:2, nome:"Estudo Preliminar",     pct:40 },
      { id:3, nome:"Aprovação Prefeitura",  pct:12 },
      { id:4, nome:"Projeto Executivo",     pct:38 },
    ],
    incluiImposto:   orcBase?.incluiImposto   || false,
    aliquotaImposto: orcBase?.aliquotaImposto ?? 16,
  });

  // Config tipo-aware
  const comodosConfig  = getComodosConfig(cfg.tipo);
  const COMODOS_ATUAL  = comodosConfig.comodos;
  const GRUPOS_ATUAL   = comodosConfig.grupos;
  const STORAGE_KEY_ATUAL = comodosConfig.storageKey;

  // inicializa cômodos do orcBase ou zerados — usa conjunto correto para o tipo
  const initComodos = () => {
    return Object.keys(COMODOS_ATUAL).map(nome => {
      const base = orcBase?.comodos?.find(c => c.nome === nome);
      return { nome, qtd: base?.qtd || 0 };
    });
  };
  const [comodos, setComodos] = useState(initComodos);
  const [editandoTabela, setEditandoTabela] = useState(false);
  const [customConfig, setCustomConfig] = useState({ comodos: {}, indicePadrao: {} });
  const [tabelaEdit, setTabelaEdit] = useState(null);
  const [tabelaKey, setTabelaKey] = useState(0);
  const [savedMsg, setSavedMsg] = useState('');
  const [paramAberto, setParamAberto] = useState(null); // qual param está expandido no step 2
  const [gruposAbertos, setGruposAbertos] = useState({}); // {} = todos abertos por padrão
  const [estacCoberto, setEstacCoberto] = useState(orcBase?.estacCoberto !== false); // restaura ao editar
  const [showPagamentoModal, setShowPagamentoModal] = useState(false);
  const [descontoEtapa, setDescontoEtapa]         = useState(orcBase?.descontoEtapa   ?? 5);
  const [descontoPacote, setDescontoPacote]       = useState(orcBase?.descontoPacote  ?? 10);
  const [parcelasEtapa, setParcelasEtapa]         = useState(orcBase?.parcelasEtapa   ?? 3);
  const [parcelasPacote, setParcelasPacote]       = useState(orcBase?.parcelasPacote  ?? 4);
  // Estados específicos para Pagamento por Etapas — contratação
  const [descontoEtapaCtrt, setDescontoEtapaCtrt]   = useState(orcBase?.descontoEtapaCtrt   ?? 5);
  const [parcelasEtapaCtrt, setParcelasEtapaCtrt]   = useState(orcBase?.parcelasEtapaCtrt   ?? 2);
  const [descontoPacoteCtrt, setDescontoPacoteCtrt] = useState(orcBase?.descontoPacoteCtrt  ?? 15);
  const [parcelasPacoteCtrt, setParcelasPacoteCtrt] = useState(orcBase?.parcelasPacoteCtrt  ?? 8);

  // Quando tipo muda (não na montagem), reinicia cômodos e atualiza precoBase
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    const cfg2 = getComodosConfig(cfg.tipo);
    const novosComodos = Object.keys(cfg2.comodos).map(nome => ({ nome, qtd: 0 }));
    // batch: evita múltiplos re-renders que causam scroll
    setComodos(novosComodos);
    setCustomConfig({ comodos: {}, indicePadrao: {} });
    setCfg(prev => ({
      ...prev,
      precoBase: getTipoConfig(prev.tipo).precoBase,
      nLojas: prev.nLojas || 0,
      nAncoras: prev.nAncoras || 0,
      nApartamentos: prev.nApartamentos || 0,
      padraoLoja: prev.padraoLoja || "Médio", tamanhoLoja: prev.tamanhoLoja || "Médio",
      padraoAncora: prev.padraoAncora || "Médio", tamanhoAncora: prev.tamanhoAncora || "Médio",
      padraoApto: prev.padraoApto || "Médio", tamanhoApto: prev.tamanhoApto || "Médio",
      nGalpoes: prev.nGalpoes || 0,
      padraoGalpao: prev.padraoGalpao || "Médio", tamanhoGalpao: prev.tamanhoGalpao || "Médio",
      nGalpoes: prev.nGalpoes || 0,
      padraoGalpao: prev.padraoGalpao || "Médio", tamanhoGalpao: prev.tamanhoGalpao || "Médio",
    }));
  }, [cfg.tipo]);

  // Carrega customConfig do storage — recarrega quando tipo muda
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY_ATUAL);
        if (res?.value) setCustomConfig(JSON.parse(res.value));
      } catch {}
    })();
  }, [STORAGE_KEY_ATUAL]);

  // Resolve COMODOS mesclando com customConfig — tipo-aware
  const comodosDef = useMemo(() => {
    const merged = {};
    Object.entries(COMODOS_ATUAL).forEach(([nome, dados]) => {
      merged[nome] = customConfig.comodos?.[nome]
        ? { ...dados, ...customConfig.comodos[nome] }
        : dados;
    });
    return merged;
  }, [customConfig, cfg.tipo]);

  async function salvarCustomConfig(newCfg) {
    setCustomConfig(newCfg);
    try { await window.storage.set(STORAGE_KEY_ATUAL, JSON.stringify(newCfg)); } catch {}
  }

  // Escada automática para Residencial e Clínica quando Sobrado
  useEffect(() => {
    if (cfg.tipologia === "Sobrado") {
      setComodos(prev => prev.map(c => c.nome === "Escada" && c.qtd === 0 ? { ...c, qtd: 1 } : c));
    } else {
      setComodos(prev => prev.map(c => c.nome === "Escada" ? { ...c, qtd: 0 } : c));
    }
  }, [cfg.tipologia, cfg.tipo]);

  function calcularResultado() {
    const tamanho = cfg.tamanho;
    let areaBruta = 0;
    let areaPiscina = 0;
    let indiceComodos = 0;
    // Usa customConfig para sobrescrever medidas/índices se existirem — tipo-aware
    const comodosDef2 = Object.fromEntries(Object.entries(COMODOS_ATUAL).map(([nome, dados]) => {
      const custom = customConfig?.comodos?.[nome];
      return [nome, custom ? { ...dados, ...custom } : dados];
    }));
    const indicePadraoEff = { ...INDICE_PADRAO, ...customConfig?.indicePadrao };

    // Cômodos que levam antecâmara 1×1m em clínicas
    const ANTECAMARA_CLINICA = ["Wcs", "PNE Masculino", "PNE Feminino"];

    comodos.forEach(c => {
      if (c.qtd <= 0) return;
      const dadosComodo = comodosDef2[c.nome];
      if (!dadosComodo) return;
      const [comp, larg] = dadosComodo.medidas[tamanho] || [0,0];
      const area = comp * larg * c.qtd;
      // Piscina não entra na área total — só no índice
      // Estacionamento descoberto (clínica): igual — só índice, sem área
      const isEstacDescoberto = cfg.tipo === "Clínica" && c.nome === "Estacionamento" && !estacCoberto;
      if (c.nome === "Piscina" || isEstacDescoberto) {
        areaPiscina += area; // reusa areaPiscina como "área excluída"
      } else {
        areaBruta += area;
      }
      // Antecâmara 1×1m por unidade para WCs e PNEs em clínicas
      if (cfg.tipo === "Clínica" && ANTECAMARA_CLINICA.includes(c.nome)) {
        areaBruta += 1 * 1 * c.qtd; // 1m² por unidade
      }
      indiceComodos += dadosComodo.indice * c.qtd;
    });

    // Comercial: calculo por blocos
    if (cfg.tipo === "Comercial" || cfg.tipo === "Galeria") {
      const pb = parseFloat(cfg.precoBase);
      // Índice padrão e tamanho independente por bloco
      const ipFor = (padrao) => (indicePadraoEff[padrao] ?? INDICE_PADRAO[padrao] ?? 0) + (cfg.tipologia === "Sobrado" ? 0 : 0.2);
      const ipLoja   = ipFor(cfg.padraoLoja   || cfg.padrao);
      const ipAncora = ipFor(cfg.padraoAncora || cfg.padrao);
      const ipApto   = ipFor(cfg.padraoApto   || cfg.padrao);
      const tamLoja   = cfg.tamanhoLoja   || cfg.tamanho;
      const tamAncora = cfg.tamanhoAncora || cfg.tamanho;
      const tamApto   = cfg.tamanhoApto   || cfg.tamanho;
      const nLojas        = parseInt(cfg.nLojas)        || 0;
      const nAncoras      = parseInt(cfg.nAncoras)      || 0;
      const nApartamentos = parseInt(cfg.nApartamentos) || 0;
      const nGalpoes      = parseInt(cfg.nGalpoes)      || 0;
      const ipGalpao  = ipFor(cfg.padraoGalpao || cfg.padrao);
      const tamGalpao = cfg.tamanhoGalpao || cfg.tamanho;
      const tam = cfg.tamanho; // mantido para áreas comuns

      // Separa cômodos por bloco
      const nomesLoja   = Object.keys(COMODOS_GALERIA_LOJA);
      const nomesAncora = Object.keys(COMODOS_GALERIA_ANCORA);
      const nomesComum  = Object.keys(COMODOS_GALERIA_COMUM);
      const nomesApto   = Object.keys(COMODOS_GALERIA_APTO);
      const nomesGalpao = Object.keys(COMODOS_GALPAO);

      // Índice e área de 1 loja (sem repetição)
      let icLoja = 0, abLoja = 0;
      comodos.forEach(c => {
        if (!nomesLoja.includes(c.nome) || c.qtd <= 0) return;
        const def = comodosDef2[c.nome]; if (!def) return;
        const [co, la] = def.medidas[tamLoja] || [0,0];
        abLoja += co * la * c.qtd;
        icLoja += def.indice * c.qtd;
      });
      const atLoja1 = abLoja * (1 + ACRESCIMO_AREA);
      const fatorLoja = icLoja + ipLoja + 1;

      // Índice e área de 1 âncora
      let icAnc = 0, abAnc = 0;
      comodos.forEach(c => {
        if (!nomesAncora.includes(c.nome) || c.qtd <= 0) return;
        const def = comodosDef2[c.nome]; if (!def) return;
        const [co, la] = def.medidas[tamAncora] || [0,0];
        abAnc += co * la * c.qtd;
        icAnc += def.indice * c.qtd;
      });
      const atAnc1 = abAnc * (1 + ACRESCIMO_AREA);
      const fatorAnc = icAnc + ipAncora + 1;

      // Áreas comuns (sem repetição)
      let icComum = 0, abComum = 0;
      comodos.forEach(c => {
        if (!nomesComum.includes(c.nome) || c.qtd <= 0) return;
        const def = comodosDef2[c.nome]; if (!def) return;
        const [co, la] = def.medidas[tam] || [0,0];
        abComum += co * la * c.qtd;
        icComum += def.indice * c.qtd;
      });
      const atComum = abComum * (1 + ACRESCIMO_AREA);
      const fatorComum = icComum + (ipLoja) + 1;

      // Índice e área de 1 apartamento (usa mesmas faixas residencial)
      let icApto = 0, abApto = 0;
      comodos.forEach(c => {
        if (!nomesApto.includes(c.nome) || c.qtd <= 0) return;
        const def = comodosDef2[c.nome]; if (!def) return;
        const [co, la] = def.medidas[tamApto] || [0,0];
        abApto += co * la * c.qtd;
        icApto += def.indice * c.qtd;
      });
      const atApto1   = abApto * (1 + ACRESCIMO_AREA);
      const fatorApto = icApto + ipApto + 1;

      // Indice e area de 1 galpao (usa COMODOS_GALPAO com acrescimo 10%)
      let icGalpao = 0, abGalpao = 0;
      comodos.forEach(c => {
        if (!nomesGalpao.includes(c.nome) || c.qtd <= 0) return;
        const def = comodosDef2[c.nome]; if (!def) return;
        const [co, la] = def.medidas[tamGalpao] || [0,0];
        abGalpao += co * la * c.qtd;
        icGalpao += def.indice * c.qtd;
      });
      const atGalpao1 = abGalpao * (1 + 0.10); // +10% circulacao galpao
      const fatorGalpao = icGalpao + ipGalpao + 1;


      // Função faixas de desconto
      const calcFaixas = (area, fator, pb, isAncora=false) => {
        const faixasDef = isAncora
          ? [{ate:300,d:0},{ate:500,d:.30},{ate:700,d:.35},{ate:1000,d:.40},{ate:Infinity,d:.45}]
          : [{ate:200,d:0},{ate:300,d:.30},{ate:400,d:.35},{ate:500,d:.40},{ate:600,d:.45},{ate:Infinity,d:.50}];
        let total=0, rest=area, acum=0, det=[];
        for (const f of faixasDef) {
          if (rest<=0) break;
          const tam2 = Math.min(rest, f.ate - acum);
          const p = pb * tam2 * fator * (1 - f.d);
          total += p; det.push({de:acum,ate:acum+tam2,area:tam2,desconto:f.d,preco:p});
          rest -= tam2; acum = f.ate;
        }
        return { total, det };
      };

      // 1ª unidade: faixas sobre área de 1 loja/âncora/apto (preço cheio)
      // 2ª em diante: desconto de repetição igual ao residencial
      // até 1000m² acum → 25%, até 2000m² → 20%, acima → 15%
      const calcRepeticao = (precoUni, area1, n) => {
        let total = precoUni; // 1ª unidade preço cheio
        let acum  = area1;
        const det = [{ unidade:1, areaAcum:area1, pct:1, precoUni }];
        const tcfgCom = getTipoConfig(cfg.tipo);
        for (let i = 2; i <= n; i++) {
          acum += area1;
          const pct = tcfgCom.repeticaoPcts(acum);
          const p   = precoUni * pct;
          det.push({ unidade:i, areaAcum:acum, pct, precoUni:p });
          total += p;
        }
        return { total, det };
      };

      // Preço cheio de 1 unidade via faixas (sobre área unitária)
      const rLoja1   = (atLoja1  > 0) ? calcFaixas(atLoja1,  fatorLoja,   pb)       : { total:0, det:[] };
      const rAnc1    = (atAnc1   > 0) ? calcFaixas(atAnc1,   fatorAnc,   pb, true) : { total:0, det:[] };
      const rComum   = calcFaixas(atComum, fatorComum, pb);
      const rApto1   = (atApto1  > 0) ? calcFaixas(atApto1,  fatorApto,  pb)       : { total:0, det:[] };
      const rGalpao1 = (atGalpao1 > 0) ? calcFaixas(atGalpao1, fatorGalpao, pb)    : { total:0, det:[] };

      // Repetição por bloco
      const repLojas   = (nLojas        > 0 && atLoja1   > 0) ? calcRepeticao(rLoja1.total,   atLoja1,   nLojas)        : { total:0, det:[] };
      const repAncoras = (nAncoras      > 0 && atAnc1    > 0) ? calcRepeticao(rAnc1.total,    atAnc1,    nAncoras)      : { total:0, det:[] };
      const repAptos   = (nApartamentos > 0 && atApto1   > 0) ? calcRepeticao(rApto1.total,   atApto1,   nApartamentos) : { total:0, det:[] };
      const repGalpoes = (nGalpoes      > 0 && atGalpao1 > 0) ? calcRepeticao(rGalpao1.total, atGalpao1, nGalpoes)      : { total:0, det:[] };

      const precoLoja1  = rLoja1.total;
      const precoAnc1   = rAnc1.total;
      const precoApto1  = rApto1.total;

      const precoLojas      = repLojas.total;
      const precoAncoras    = repAncoras.total;
      const precoComum      = rComum.total;
      const precoAptos      = repAptos.total;
      const precoGalpoes    = repGalpoes.total;
      const precoSemFachada = precoLojas + precoAncoras + precoComum + precoAptos + precoGalpoes;
      const precoFachada    = precoSemFachada * INDICE_FACHADA_GALERIA;
      const precoFinal      = precoSemFachada + precoFachada;

      const areaTotalComercial = (atLoja1 * nLojas) + (atAnc1 * (nAncoras||0)) + atComum + (atApto1 * nApartamentos) + (atGalpao1 * nGalpoes);
      const eng = calcularEngenharia(areaTotalComercial);

      // m² e R$/m² por unidade
      const m2Loja1       = atLoja1;
      const precoM2Loja   = atLoja1 > 0 ? precoLoja1 / atLoja1 : 0;
      const m2Anc1        = atAnc1;
      const precoM2Ancora = atAnc1  > 0 ? precoAnc1  / atAnc1  : 0;

      const m2Apto1      = atApto1;
      const precoM2Apto  = atApto1 > 0 ? precoApto1 / atApto1 : 0;
      const precoGalpao1 = rGalpao1.total;
      const m2Galpao1    = atGalpao1;
      const precoM2Galpao = atGalpao1 > 0 ? precoGalpao1 / atGalpao1 : 0;

      return {
        tipo: "Comercial",
        areaBruta: abLoja*nLojas + abAnc*(nAncoras||0) + abComum + abApto*nApartamentos + abGalpao*nGalpoes,
        areaTotal: areaTotalComercial,
        nLojas, nAncoras, nApartamentos, nGalpoes,
        fatorLoja, fatorAnc, fatorComum, fatorApto, fatorGalpao,
        tamanhoLoja: tamLoja, tamanhoAncora: tamAncora, tamanhoApto: tamApto, tamanhoGalpao: tamGalpao,
        padraoLoja: cfg.padraoLoja||cfg.padrao, padraoAncora: cfg.padraoAncora||cfg.padrao, padraoApto: cfg.padraoApto||cfg.padrao, padraoGalpao: cfg.padraoGalpao||cfg.padrao,
        // por unidade (preço cheio)
        precoLoja1, m2Loja1, precoM2Loja,
        precoAnc1,  m2Anc1,  precoM2Ancora,
        precoApto1, m2Apto1, precoM2Apto,
        precoGalpao1, m2Galpao1, precoM2Galpao,
        // totais com repetição
        precoLojas, precoAncoras, precoComum, precoAptos, precoGalpoes,
        atComum,
        precoFachada, precoSemFachada,
        precoFinal, precoTotal: precoFinal,
        precoM2: areaTotalComercial > 0 ? precoFinal / areaTotalComercial : 0,
        // faixas 1ª unidade
        detalheFaixasLoja1:   rLoja1.det,
        detalheFaixasAnc1:    rAnc1.det,
        detalheFaixasApto1:   rApto1.det,
        detalheFaixasGalpao1: rGalpao1.det,
        // repeticao
        repeticaoLojas:   repLojas.det,
        repeticaoAncoras: repAncoras.det,
        repeticaoAptos:   repAptos.det,
        repeticaoGalpoes: repGalpoes.det,
        engTotal: eng.totalEng, engFaixas: eng.faixas,
        engPrecoM2Efetivo: eng.precoM2Efetivo,
        indiceFachada: INDICE_FACHADA_GALERIA,
      };
    }

    // Area total: usa acrescimo de circulacao do tipo
    const tcfg = getTipoConfig(cfg.tipo);
    const acrescimoCirk = tcfg.acrescimoCirk;
    const areaTotal = areaBruta * (1 + acrescimoCirk);
    const indicePadrao = (indicePadraoEff[cfg.padrao] ?? INDICE_PADRAO[cfg.padrao] ?? 0) + (cfg.tipologia === "Sobrado" ? 0 : 0.2);
    const fator = indiceComodos + indicePadrao + 1;
    // Padrao Baixo reduz o preco base em 20%
    const precoBaseRaw = parseFloat(cfg.precoBase);
    const precoBase = cfg.padrao === "Baixo" ? Math.round(precoBaseRaw * 0.80 * 100) / 100 : precoBaseRaw;

    // Tabela de descontos progressivos — vem do TIPO_CONFIG
    const faixas = tcfg.faixasDesconto;

    let precoFinal = 0;
    let areaRestante = areaTotal;
    let areaAcumulada = 0;
    const detalheFaixas = [];

    for (const faixa of faixas) {
      if (areaRestante <= 0) break;
      const limiteAnterior = areaAcumulada;
      const limiteFaixa = faixa.ate;
      const tamanhoFaixa = limiteFaixa - limiteAnterior;
      const areaNestaFaixa = Math.min(areaRestante, tamanhoFaixa);
      const precoFaixa = precoBase * areaNestaFaixa * fator * (1 - faixa.desconto);
      precoFinal += precoFaixa;
      detalheFaixas.push({
        de: limiteAnterior,
        ate: limiteAnterior + areaNestaFaixa,
        area: areaNestaFaixa,
        desconto: faixa.desconto,
        preco: precoFaixa,
      });
      areaAcumulada = limiteFaixa;
      areaRestante -= areaNestaFaixa;
    }

    const eng = calcularEngenharia(areaTotal);

    // ── Repetição ──────────────────────────────────────────
    // 1ª unidade = preço cheio; demais = % da 1ª conforme metragem acumulada
    // até 1000m² acum = 25%, até 2000m² = 20%, acima = 15%
    let precoRepeticao = 0;
    const repeticaoFaixas = [];
    if (cfg.repeticao && cfg.nUnidades > 1) {
      const n = parseInt(cfg.nUnidades) || 1;
      const areaUni = areaTotal;
      let areaAcum = areaUni; // 1ª unidade já conta
      for (let i = 2; i <= n; i++) {
        const pct = tcfg.repeticaoPcts(areaAcum);
        const precoUni = precoFinal * pct;
        repeticaoFaixas.push({ unidade: i, areaAcum, pct, precoUni });
        precoRepeticao += precoUni;
        areaAcum += areaUni;
      }
    }
    const precoTotal = precoFinal + precoRepeticao;

    return {
      areaBruta,
      areaPiscina,
      areaTotal,
      indiceComodos,
      indicePadrao,
      fator,
      precoFinal,       // preço de 1 unidade
      precoTotal,       // preço com repetição
      precoM2: areaTotal > 0 ? precoFinal / areaTotal : 0,
      detalheFaixas,
      repeticaoFaixas,
      nUnidades: cfg.repeticao ? (parseInt(cfg.nUnidades)||1) : 1,
      engTotal: eng.totalEng,
      engFaixas: eng.faixas,
      engPrecoM2Efetivo: eng.precoM2Efetivo,
    };
  }

  async function handleSalvar(cfgOverride = {}) {
    try {
      const cfgFinal = { ...cfg, ...cfgOverride };
      const resultado = { ...calcularResultado() };
      if (cfgFinal.incluiImposto) {
        const aliq = parseFloat(cfgFinal.aliquotaImposto)||0;
        const fi = aliq > 0 ? 1 / (1 - aliq/100) : 1;
        const ci = v => Math.round(v * fi * 100) / 100;
        resultado.precoFinal = ci(resultado.precoFinal);
        resultado.precoTotal = ci(resultado.precoTotal||resultado.precoFinal);
        resultado.engTotal   = ci(resultado.engTotal||0);
        resultado.impostoAplicado = true;
        resultado.aliquotaImposto = aliq;
        resultado.impostoValorArq = Math.round((resultado.precoFinal - resultado.precoFinal/fi) * 100) / 100;
        resultado.impostoValorEng = Math.round((resultado.engTotal   - resultado.engTotal/fi)   * 100) / 100;
      }
      cfgFinal.estacCoberto      = estacCoberto;
      cfgFinal.descontoEtapa     = descontoEtapa;
      cfgFinal.descontoPacote    = descontoPacote;
      cfgFinal.parcelasEtapa     = parcelasEtapa;
      cfgFinal.parcelasPacote    = parcelasPacote;
      cfgFinal.descontoEtapaCtrt  = descontoEtapaCtrt;
      cfgFinal.parcelasEtapaCtrt  = parcelasEtapaCtrt;
      cfgFinal.descontoPacoteCtrt = descontoPacoteCtrt;
      cfgFinal.parcelasPacoteCtrt = parcelasPacoteCtrt;
      await onSalvar({ ...cfgFinal, comodos, resultado, id: orcBase?.id });
    } catch(e) { console.error("Erro:", e); alert("Erro: "+e.message); }
  }

  const totalComodos = comodos.filter(c => c.qtd > 0).length;
  const preview = calcularResultado();
  // Imposto por dentro: valor bruto = liquido / (1 - aliq/100)
  const aliqImp = cfg.incluiImposto ? (parseFloat(cfg.aliquotaImposto)||0) : 0;
  const fatorImposto = aliqImp > 0 ? 1 / (1 - aliqImp/100) : 1;
  const calcComImposto = (v) => aliqImp > 0 ? Math.round(v * fatorImposto * 100) / 100 : v;
  const previewComImposto = cfg.incluiImposto ? {
    ...preview,
    precoFinal: calcComImposto(preview.precoFinal),
    precoTotal: calcComImposto(preview.precoTotal||preview.precoFinal),
    engTotal:   calcComImposto(preview.engTotal||0),
    impostoAplicado: true,
    aliquotaImposto: aliqImp,
  } : preview;

  const TIPOS = {
    "Residencial": ["Construção nova", "Reforma"],
    "Clínica":     ["Construção nova", "Reforma"],
    "Comercial":   ["Construção nova", "Reforma"],
    "Galpao":      ["Construção nova", "Reforma"],
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* STEPS */}
      <div style={S.steps}>
        {[["1","Configurações"],["2","Cômodos e Áreas"]].map(([n,l],i) => (
          <div key={n} style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ ...S.stepDot, ...(step>=parseInt(n)?S.stepDotActive:{}) }}>{n}</div>
            <span style={{ color:step>=parseInt(n)?"#e2e8f0":"#475569", fontSize:13, fontWeight:600 }}>{l}</span>
            {i===0 && <div style={S.stepLine}/>}
          </div>
        ))}
      </div>

      {/* STEP 1 — CONFIGURAÇÕES */}
      {step === 1 && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={S.section}>
            <div style={S.sectionTitle}>Dados do Cliente</div>
            <div>
              <label style={S.label}>Nome do Cliente / Referência</label>
              <input style={S.input} value={cfg.cliente} onChange={e=>setCfg({...cfg,cliente:e.target.value})} placeholder="Ex: Ricardo Almeida — Residência SP" />
            </div>
            <div>
              <label style={S.label}>WhatsApp do Cliente (com DDD)</label>
              <input style={S.input} value={cfg.whatsapp} onChange={e=>setCfg({...cfg,whatsapp:e.target.value})} placeholder="(11) 99999-9999" />
              <div style={{ color:"#475569", fontSize:11, marginTop:4 }}>Usado para enviar o orçamento diretamente pelo WhatsApp</div>
            </div>
          </div>

          <div style={S.section}>
            <div style={S.sectionTitle}>Tipo de Obra</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <label style={S.label}>Tipo</label>
                <div style={S.radioGrid}>
                  {Object.keys(TIPOS).map(t => (
                    <div key={t} style={{ ...S.radioCard, ...(cfg.tipo===t?S.radioCardActive:{}) }} onClick={e=>{e.preventDefault();setCfg({...cfg,tipo:t,subtipo:TIPOS[t][0]})}}>
                      <span style={{ fontSize:18 }}>{t==="Residencial"?"🏠":t==="Clínica"?"🏥":t==="Comercial"?"🏛":t==="Galpao"?"🏭":"🏢"}</span>
                      <span style={{ fontWeight:600, fontSize:13 }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label style={S.label}>Subtipo</label>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {TIPOS[cfg.tipo].map(s => (
                    <div key={s} style={{ ...S.radioCard, ...(cfg.subtipo===s?S.radioCardActive:{}) }} onClick={()=>setCfg({...cfg,subtipo:s})}>
                      <span>{s === "Construção nova" ? "🏗" : "🔨"}</span>
                      <span style={{ fontWeight:600, fontSize:13 }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {(cfg.tipo === "Residencial" || cfg.tipo === "Clínica" || cfg.tipo === "Comercial" || cfg.tipo === "Galpao") && cfg.subtipo === "Construção nova" && (
            <>
              <div style={S.section}>
                <div style={S.sectionTitle}>Características</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
                  <div>
                    <label style={S.label}>Padrão</label>
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {[["Alto","🥇","#f59e0b"],["Médio","🥈","#94a3b8"],["Baixo","🥉","#b45309"]].map(([p,icon,cor]) => (
                        <div key={p} style={{ ...S.radioCard, ...(cfg.padrao===p?{...S.radioCardActive,borderColor:cor}:{}) }} onClick={()=>setCfg(prev=>({...prev,padrao:p}))}>
                          <span>{icon}</span>
                          <div>
                            <div style={{ fontWeight:700, fontSize:13, color: cfg.padrao===p?cor:"#94a3b8" }}>{p}</div>
                            <div style={{ fontSize:10, color:"#64748b" }}>{p==="Baixo" ? "Preco base -20%" : `Índice +${(INDICE_PADRAO[p]*100).toFixed(0)}%`}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={S.label}>Tipologia</label>
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {[["Térreo","🏠"],["Sobrado","🏡"]].map(([t,icon]) => (
                        <div key={t} style={{ ...S.radioCard, ...(cfg.tipologia===t?S.radioCardActive:{}) }} onClick={()=>setCfg(prev=>({...prev,tipologia:t}))}>
                          <span>{icon}</span>
                          <div>
                            <div style={{ fontWeight:600, fontSize:13 }}>{t}</div>
                            {t==="Sobrado" && <div style={{ fontSize:10, color:"#60a5fa" }}>Escada incluída automaticamente</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={S.label}>Tamanho</label>
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {["Grande","Médio","Pequeno","Compacta"].map(t => (
                        <div key={t} style={{ ...S.radioCard, ...(cfg.tamanho===t?S.radioCardActive:{}) }} onClick={()=>setCfg(prev=>({...prev,tamanho:t}))}>
                          <span style={{ fontWeight:600, fontSize:13 }}>{t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div style={S.section}>
                <div style={S.sectionTitle}>Parâmetro Financeiro</div>
                <div style={{ maxWidth:240 }}>
                  <label style={S.label}>Preço Base (R$/m²)</label>
                  <input style={S.input} type="number" step="0.01" value={cfg.precoBase} onChange={e=>setCfg({...cfg,precoBase:e.target.value})} />
                  <div style={{ color:"#64748b", fontSize:11, marginTop:4 }}>Padrão: R$ {getTipoConfig(cfg.tipo).precoBase}/m²</div>
                </div>
              </div>
            </>
          )}

          {cfg.tipo === "Comercial" ? (
            <div style={S.section}>
              <div style={S.sectionTitle}>Blocos do Comercial</div>
              <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <label style={S.label}>🏪 Nº de lojas:</label>
                  <input style={{ ...S.input, width:80, textAlign:"center" }} type="number" min="0" max="50"
                    value={cfg.nLojas} onChange={e=>setCfg({...cfg,nLojas:e.target.value})} />
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <label style={S.label}>🏬 Espaços âncoras:</label>
                  <input style={{ ...S.input, width:80, textAlign:"center" }} type="number" min="0"
                    value={cfg.nAncoras} onChange={e=>setCfg({...cfg,nAncoras:e.target.value})} />
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <label style={S.label}>🏠 Apartamentos:</label>
                  <input style={{ ...S.input, width:80, textAlign:"center" }} type="number" min="0" max="200"
                    value={cfg.nApartamentos} onChange={e=>setCfg({...cfg,nApartamentos:e.target.value})} />
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <label style={S.label}>🏭 Galpões:</label>
                  <input style={{ ...S.input, width:80, textAlign:"center" }} type="number" min="0"
                    value={cfg.nGalpoes} onChange={e=>setCfg({...cfg,nGalpoes:e.target.value})} />
                </div>
              </div>
              <div style={{ color:"#64748b", fontSize:11, marginTop:8 }}>
                Desconto por repetição aplicado separadamente por bloco · Fachada: +{(INDICE_FACHADA_GALERIA*100).toFixed(0)}% sobre o total
              </div>
            </div>
          ) : (
            <div style={S.section}>
              <div style={S.sectionTitle}>Repetição de Unidades</div>
              <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
                <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                  <input type="checkbox" checked={cfg.repeticao} onChange={e=>setCfg({...cfg,repeticao:e.target.checked})} />
                  <span style={{ color:"#e2e8f0", fontSize:13 }}>Este projeto tem unidades repetidas</span>
                </label>
                {cfg.repeticao && (
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <label style={S.label}>Nº de unidades:</label>
                    <input style={{ ...S.input, width:80, textAlign:"center" }} type="number" min="1" max="999"
                      value={cfg.nUnidades} onChange={e=>setCfg({...cfg,nUnidades:e.target.value})} />
                    <div style={{ color:"#64748b", fontSize:11 }}>
                      <div>Unidades 2+ até 1000m² acum. → 25% da 1ª</div>
                      <div>1000–2000m² → 20% · acima de 2000m² → 15%</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <button style={S.btnPrimary} onClick={() => setStep(2)}>
              Próximo: Cômodos →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 — CÔMODOS */}
      {step === 2 && (
        <>
        {/* Modal de edição de tabela */}
        {editandoTabela && (() => {
          // draft local — edições ficam aqui até salvar, sem afetar o cálculo ao vivo
          // Usamos tabelaEdit como rascunho; ao salvar commitamos para customConfig
          const draftComodos = tabelaEdit?.comodos ?? customConfig.comodos ?? {};
          const draftIndices = tabelaEdit?.indicePadrao ?? customConfig.indicePadrao ?? {};

          const setDraftComodo = (nome, dados_base, tam, idx, val) => {
            setTabelaEdit(prev => {
              const p = prev || { comodos: { ...customConfig.comodos }, indicePadrao: { ...customConfig.indicePadrao } };
              const cur2 = p.comodos?.[nome] || {};
              const meds = cur2.medidas ? { ...cur2.medidas } : { ...dados_base.medidas };
              const pair = [...(meds[tam] || [0,0])];
              pair[idx] = val;
              meds[tam] = pair;
              return { ...p, comodos: { ...p.comodos, [nome]: { ...cur2, medidas: meds } } };
            });
          };

          const setDraftIndiceComodo = (nome, val) => {
            setTabelaEdit(prev => {
              const p = prev || { comodos: { ...customConfig.comodos }, indicePadrao: { ...customConfig.indicePadrao } };
              const cur2 = p.comodos?.[nome] || {};
              return { ...p, comodos: { ...p.comodos, [nome]: { ...cur2, indice: val } } };
            });
          };

          const setDraftIndicePadrao = (padrao, val) => {
            setTabelaEdit(prev => {
              const p = prev || { comodos: { ...customConfig.comodos }, indicePadrao: { ...customConfig.indicePadrao } };
              return { ...p, indicePadrao: { ...p.indicePadrao, [padrao]: val } };
            });
          };

          const commitSave = async (cfg) => {
            await salvarCustomConfig(cfg);
            setTabelaEdit(null);
            setSavedMsg('✓ Salvo e aplicado!');
            setTimeout(() => setSavedMsg(''), 3000);
          };

          const handleRestaurar = async () => {
            await salvarCustomConfig({ comodos:{}, indicePadrao:{} });
            setTabelaEdit(null);
            setTabelaKey(k => k + 1); // re-mount sem fechar o painel
            setSavedMsg('✓ Valores originais restaurados!');
            setTimeout(() => setSavedMsg(''), 3000);
          };

          return (
          <div key={tabelaKey} style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:12, padding:24, marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ color:"#f1f5f9", fontWeight:700, fontSize:15 }}>⚙ Editar Tabela de Cômodos</div>
              <div style={{ display:"flex", gap:8 }}>
                <button style={{ ...S.btnSecondary, fontSize:12, background:"#450a0a", color:"#f87171", borderColor:"#7f1d1d" }}
                  onClick={handleRestaurar}>↺ Restaurar Originais</button>
                <button style={{ ...S.btnSecondary, fontSize:12 }} onClick={() => { setEditandoTabela(false); setTabelaEdit(null); }}>✕ Fechar</button>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:12 }}>
              <div style={{ color:"#64748b", fontSize:12 }}>Edite e clique em 💾 Salvar Tudo para aplicar ao cálculo.</div>
              {savedMsg && <div style={{ color:"#4ade80", fontSize:12, fontWeight:700 }}>{savedMsg}</div>}
            </div>
            <div style={{ display:"flex", gap:12, marginBottom:12, flexWrap:"wrap" }}>
              <div style={{ minWidth:140 }}>
                <div style={{ color:"#94a3b8", fontSize:11, marginBottom:6, fontWeight:700 }}>ÍNDICE PADRÃO</div>
                {["Alto","Médio","Baixo"].map(p => (
                  <div key={p} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <span style={{ color:"#64748b", fontSize:12, width:50 }}>{p}</span>
                    <input type="number" step="0.01" style={{ ...S.input, width:70, padding:"4px 8px", fontSize:12 }}
                      value={draftIndices[p] ?? INDICE_PADRAO[p]}
                      onChange={e => setDraftIndicePadrao(p, parseFloat(e.target.value)||0)} />
                  </div>
                ))}
              </div>
              <div style={{ flex:1, overflowX:"auto" }}>
                <div style={{ color:"#94a3b8", fontSize:11, marginBottom:6, fontWeight:700 }}>CÔMODOS — MEDIDAS E ÍNDICES</div>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead>
                    <tr>{["Cômodo","Índice","Grande (C×L)","Médio (C×L)","Pequeno (C×L)","Compacta (C×L)"].map(h=>(
                      <th key={h} style={{ ...S.th, fontSize:11, padding:"6px 8px" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const isGal = cfg.tipo === "Comercial";
                      const nomesLoja   = isGal ? new Set(Object.keys(COMODOS_GALERIA_LOJA))   : new Set();
                      const nomesAncora = isGal ? new Set(Object.keys(COMODOS_GALERIA_ANCORA)) : new Set();
                      const nomesComum  = isGal ? new Set(Object.keys(COMODOS_GALERIA_COMUM))  : new Set();
                      const nomesApto   = isGal ? new Set(Object.keys(COMODOS_GALERIA_APTO))   : new Set();
                      const grupos = [
                        { key:"loja",   nomes:nomesLoja,   cor:"#3b82f6", label:"🏪 Ambientes Lojas" },
                        { key:"ancora", nomes:nomesAncora, cor:"#6366f1", label:"🏬 Ambientes Espaços Âncoras" },
                        { key:"comum",  nomes:nomesComum,  cor:"#10b981", label:"Áreas Comuns" },
                        { key:"apto",   nomes:nomesApto,   cor:"#f59e0b", label:"🏠 Ambientes Apartamentos" },
                      ];
                      const rows = [];
                      let lastGrupo = null;
                      Object.entries(COMODOS_ATUAL).forEach(([nome, dados]) => {
                        if (isGal) {
                          const g = grupos.find(g => g.nomes.has(nome));
                          const gKey = g?.key || "outro";
                          if (gKey !== lastGrupo) {
                            lastGrupo = gKey;
                            rows.push(
                              <tr key={`sep-${gKey}`}>
                                <td colSpan={6} style={{ padding:"10px 8px 4px", background:"#0a1222" }}>
                                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                    <div style={{ width:8, height:8, borderRadius:"50%", background:g?.cor||"#475569" }} />
                                    <span style={{ color:g?.cor||"#475569", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8 }}>
                                      {g?.label||"Outros"}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                        }
                        const cur = draftComodos[nome] || {};
                        const medCur = cur.medidas || dados.medidas;
                        const idxCur = cur.indice ?? dados.indice;
                        rows.push(
                          <tr key={nome} style={{ borderBottom:"1px solid #1e293b" }}>
                            <td style={{ ...S.td, color:"#e2e8f0", fontWeight:600, whiteSpace:"nowrap" }}>{nome}</td>
                            <td style={S.td}>
                              <input type="number" step="0.001" style={{ ...S.input, width:70, padding:"3px 6px", fontSize:11 }}
                                value={idxCur}
                                onChange={e => setDraftIndiceComodo(nome, parseFloat(e.target.value)||0)} />
                            </td>
                            {["Grande","Médio","Pequeno","Compacta"].map(tam => (
                              <td key={tam} style={S.td}>
                                <div style={{ display:"flex", gap:4 }}>
                                  <input type="number" step="0.1" style={{ ...S.input, width:52, padding:"3px 6px", fontSize:11 }}
                                    value={medCur[tam]?.[0] ?? 0}
                                    onChange={e => setDraftComodo(nome, dados, tam, 0, parseFloat(e.target.value)||0)} />
                                  <span style={{ color:"#64748b", alignSelf:"center" }}>×</span>
                                  <input type="number" step="0.1" style={{ ...S.input, width:52, padding:"3px 6px", fontSize:11 }}
                                    value={medCur[tam]?.[1] ?? 0}
                                    onChange={e => setDraftComodo(nome, dados, tam, 1, parseFloat(e.target.value)||0)} />
                                </div>
                              </td>
                            ))}
                          </tr>
                        );
                      });
                      return rows;
                    })()}
                  </tbody>
                </table>
                <button style={{ ...S.btnPrimary, fontSize:12, marginTop:12 }} onClick={async () => {
                  const toSave = tabelaEdit || customConfig;
                  await commitSave(toSave);
                }}>💾 Salvar Tudo e Aplicar</button>
              </div>
            </div>
          </div>
          );
        })()}
        {/* ── BARRA DE PARÂMETROS RÁPIDOS ── */}
        {(() => {

          const paramStyle = (ativo) => ({
            display:"flex", alignItems:"center", gap:6, padding:"6px 12px",
            background: ativo ? "#1e3a5f" : "#0f172a",
            border: ativo ? "1px solid #3b82f6" : "1px solid #1e293b",
            borderRadius:8, cursor:"pointer", userSelect:"none",
          });
          const labelStyle = { color:"#64748b", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5 };
          const valueStyle = { color:"#e2e8f0", fontSize:13, fontWeight:700 };
          const chevron = (ativo) => <span style={{ color:"#3b82f6", fontSize:10 }}>{ativo?"▲":"▼"}</span>;

          const Option = ({ val, cur, onSelect, icon }) => (
            <button onClick={() => onSelect(val)} style={{
              padding:"5px 12px", borderRadius:6, border:"none", cursor:"pointer", fontFamily:"inherit",
              fontSize:12, fontWeight:700,
              background: cur===val ? "#2563eb" : "#1e293b",
              color: cur===val ? "#fff" : "#94a3b8",
            }}>{icon&&<span style={{marginRight:4}}>{icon}</span>}{val}</button>
          );

          const tipoEmoji = t => t==="Residencial"?"🏠":t==="Clínica"?"🏥":t==="Comercial"?"🏛":t==="Galpao"?"🏭":"🏢";

          return (
            <div style={{ marginBottom:16 }}>
              {/* chips */}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                <span style={{ color:"#475569", fontSize:11, marginRight:4 }}>⚡ Parâmetros:</span>

                {/* Subtipo */}
                <div style={paramStyle(paramAberto==="subtipo")} onClick={() => setParamAberto(p => p==="subtipo"?null:"subtipo")}>
                  <span style={labelStyle}>Subtipo</span>
                  <span style={valueStyle}>{cfg.subtipo}</span>
                  {chevron(paramAberto==="subtipo")}
                </div>

                {/* Tipologia — só residencial/clínica */}
                {(cfg.tipo==="Residencial"||cfg.tipo==="Clínica") && (
                  <div style={paramStyle(paramAberto==="tipologia")} onClick={() => setParamAberto(p => p==="tipologia"?null:"tipologia")}>
                    <span style={labelStyle}>Tipologia</span>
                    <span style={valueStyle}>{cfg.tipologia}</span>
                    {chevron(paramAberto==="tipologia")}
                  </div>
                )}

                {/* Padrão */}
                <div style={paramStyle(paramAberto==="padrao")} onClick={() => setParamAberto(p => p==="padrao"?null:"padrao")}>
                  <span style={labelStyle}>Padrão</span>
                  <span style={{ ...valueStyle, color: cfg.padrao==="Alto"?"#f59e0b":cfg.padrao==="Médio"?"#60a5fa":"#94a3b8" }}>
                    ★ {cfg.padrao}
                  </span>
                  {chevron(paramAberto==="padrao")}
                </div>

                {/* Tamanho */}
                <div style={paramStyle(paramAberto==="tamanho")} onClick={() => setParamAberto(p => p==="tamanho"?null:"tamanho")}>
                  <span style={labelStyle}>Cômodos</span>
                  <span style={valueStyle}>📐 {cfg.tamanho}</span>
                  {chevron(paramAberto==="tamanho")}
                </div>

                {/* Preço base */}
                <div style={paramStyle(paramAberto==="preco")} onClick={() => setParamAberto(p => p==="preco"?null:"preco")}>
                  <span style={labelStyle}>R$/m²</span>
                  <span style={{ ...valueStyle, color:"#10b981" }}>R$ {fmtA(parseFloat(cfg.precoBase),0)}</span>
                  {chevron(paramAberto==="preco")}
                </div>

                {/* Repetição */}
                {cfg.repeticao && (
                  <div style={paramStyle(paramAberto==="repeticao")} onClick={() => setParamAberto(p => p==="repeticao"?null:"repeticao")}>
                    <span style={labelStyle}>Unidades</span>
                    <span style={{ ...valueStyle, color:"#a78bfa" }}>🔁 {cfg.nUnidades}x</span>
                    {chevron(paramAberto==="repeticao")}
                  </div>
                )}

                {/* Pagamento */}
                <div style={paramStyle(paramAberto==="pagamento")} onClick={() => setParamAberto(p => p==="pagamento"?null:"pagamento")}>
                  <span style={labelStyle}>Pagamento</span>
                  <span style={{ ...valueStyle, color: cfg.tipoPagamento==="etapas"?"#f59e0b":"#60a5fa" }}>
                    {cfg.tipoPagamento==="etapas" ? "📋 Por Etapas" : "💳 Padrão"}
                  </span>
                  {chevron(paramAberto==="pagamento")}
                </div>

                {/* Imposto */}
                <div style={paramStyle(paramAberto==="imposto")} onClick={() => setParamAberto(p => p==="imposto"?null:"imposto")}>
                  <span style={labelStyle}>Imposto</span>
                  <span style={{ ...valueStyle, color: cfg.incluiImposto?"#f87171":"#475569" }}>
                    {cfg.incluiImposto ? `📊 ${cfg.aliquotaImposto}%` : "Não incluso"}
                  </span>
                  {chevron(paramAberto==="imposto")}
                </div>
              </div>

              {/* painel expansível */}
              {paramAberto && (
                <div style={{ marginTop:8, padding:"12px 16px", background:"#0f172a", border:"1px solid #1e293b", borderRadius:10, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                  {paramAberto==="subtipo" && (TIPOS_INLINE[cfg.tipo]||[]).map(s => (
                    <Option key={s} val={s} cur={cfg.subtipo} onSelect={v => { setCfg({...cfg,subtipo:v}); setParamAberto(null); }} />
                  ))}
                  {paramAberto==="tipologia" && TIPOLOGIAS.map(t => (
                    <Option key={t} val={t} cur={cfg.tipologia} onSelect={v => { setCfg({...cfg,tipologia:v}); setParamAberto(null); }} />
                  ))}
                  {paramAberto==="padrao" && PADROES.map(p => (
                    <Option key={p} val={p} cur={cfg.padrao} onSelect={v => { setCfg({...cfg,padrao:v}); setParamAberto(null); }} />
                  ))}
                  {paramAberto==="tamanho" && TAMANHOS.map(t => (
                    <Option key={t} val={t} cur={cfg.tamanho} onSelect={v => { setCfg({...cfg,tamanho:v}); setParamAberto(null); }} />
                  ))}
                  {paramAberto==="preco" && (
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ color:"#94a3b8", fontSize:12 }}>R$/m²</span>
                      <input type="number" step="0.5" style={{ ...S.input, width:100, padding:"5px 8px" }}
                        value={cfg.precoBase}
                        onChange={e => setCfg({...cfg, precoBase:e.target.value})}
                        onKeyDown={e => e.key==="Enter" && setParamAberto(null)} />
                      <button style={{ ...S.btnPrimary, padding:"5px 12px", fontSize:12 }} onClick={() => setParamAberto(null)}>OK</button>
                    </div>
                  )}
                  {paramAberto==="repeticao" && (
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ color:"#94a3b8", fontSize:12 }}>Nº de unidades:</span>
                      <input type="number" min="1" step="1" style={{ ...S.input, width:80, padding:"5px 8px" }}
                        value={cfg.nUnidades}
                        onChange={e => setCfg(prev => ({...prev, nUnidades:Math.max(1,parseInt(e.target.value)||1)}))}
                        onKeyDown={e => e.key==="Enter" && setParamAberto(null)} />
                      <button style={{ ...S.btnPrimary, padding:"5px 12px", fontSize:12 }} onClick={() => setParamAberto(null)}>OK</button>
                    </div>
                  )}
                  {paramAberto==="imposto" && (
                    <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                      <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                        <input type="checkbox" checked={cfg.incluiImposto}
                          onChange={e => setCfg(prev=>({...prev, incluiImposto:e.target.checked}))} />
                        <span style={{ color:"#e2e8f0", fontSize:13 }}>Incluir imposto no valor</span>
                      </label>
                      {cfg.incluiImposto && (
                        <>
                          <span style={{ color:"#94a3b8", fontSize:12 }}>Alíquota:</span>
                          <input type="number" min="0" max="100" step="0.1"
                            style={{ ...S.input, width:72, padding:"5px 8px" }}
                            value={cfg.aliquotaImposto}
                            onChange={e => setCfg(prev=>({...prev, aliquotaImposto:parseFloat(e.target.value)||0}))}
                            onKeyDown={e => e.key==="Enter" && setParamAberto(null)} />
                          <span style={{ color:"#94a3b8", fontSize:12 }}>%</span>
                        </>
                      )}
                      <button style={{ ...S.btnPrimary, padding:"5px 12px", fontSize:12 }} onClick={() => setParamAberto(null)}>OK</button>
                    </div>
                  )}
                  {paramAberto==="pagamento" && (
                    <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%" }}>
                      {/* Toggle Padrão / Etapas */}
                      <div style={{ display:"flex", gap:8 }}>
                        {[["padrao","💳 Padrão"],["etapas","📋 Por Etapas"]].map(([v,l]) => (
                          <div key={v} onClick={() => setCfg(prev=>({...prev,tipoPagamento:v}))}
                            style={{ padding:"5px 14px", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:700,
                              background: cfg.tipoPagamento===v?"#1e3a5f":"transparent",
                              color: cfg.tipoPagamento===v?"#60a5fa":"#475569",
                              border:`1px solid ${cfg.tipoPagamento===v?"#3b82f6":"#334155"}` }}>
                            {l}
                          </div>
                        ))}
                      </div>
                      {/* Tabela de etapas */}
                      {cfg.tipoPagamento==="etapas" && (() => {
                        const arqVal = preview.precoTotal || preview.precoFinal || 0;
                        const totalPct = (cfg.etapasPct||[]).reduce((s,e)=>s+Number(e.pct),0);
                        return (
                          <div style={{ width:"100%" }}>
                            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                              <thead>
                                <tr style={{ borderBottom:"1px solid #334155" }}>
                                  <th style={{ textAlign:"left", color:"#64748b", fontWeight:600, padding:"4px 8px" }}>Etapa</th>
                                  <th style={{ textAlign:"center", color:"#64748b", fontWeight:600, padding:"4px 8px", width:80 }}>%</th>
                                  <th style={{ textAlign:"right", color:"#64748b", fontWeight:600, padding:"4px 8px" }}>Valor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(cfg.etapasPct||[]).map((etapa,i) => (
                                  <tr key={etapa.id} style={{ borderBottom:"1px solid #1e293b" }}>
                                    <td style={{ padding:"5px 8px" }}>
                                      <input style={{ ...S.input, padding:"2px 6px", fontSize:12, width:"100%" }}
                                        value={etapa.nome}
                                        onChange={e => setCfg(prev => ({ ...prev, etapasPct: prev.etapasPct.map((ep,j)=>j===i?{...ep,nome:e.target.value}:ep) }))} />
                                    </td>
                                    <td style={{ padding:"5px 8px", textAlign:"center" }}>
                                      <input type="number" min="0" max="100" step="1"
                                        style={{ ...S.input, width:60, padding:"2px 6px", fontSize:12, textAlign:"center" }}
                                        value={etapa.pct}
                                        onChange={e => setCfg(prev => ({ ...prev, etapasPct: prev.etapasPct.map((ep,j)=>j===i?{...ep,pct:Number(e.target.value)||0}:ep) }))} />
                                    </td>
                                    <td style={{ padding:"5px 8px", textAlign:"right", color:"#10b981", fontWeight:600 }}>
                                      {new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(arqVal * etapa.pct / 100)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr style={{ borderTop:"2px solid #334155" }}>
                                  <td style={{ padding:"6px 8px", color:"#e2e8f0", fontWeight:700 }}>Total</td>
                                  <td style={{ padding:"6px 8px", textAlign:"center",
                                    color: Math.abs(totalPct-100)<0.01?"#4ade80":"#f87171", fontWeight:700 }}>
                                    {totalPct.toFixed(0)}%
                                  </td>
                                  <td style={{ padding:"6px 8px", textAlign:"right", color:"#f59e0b", fontWeight:800 }}>
                                    {new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(arqVal * totalPct / 100)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                            {Math.abs(totalPct-100)>0.01 && (
                              <div style={{ color:"#f87171", fontSize:11, marginTop:4 }}>
                                ⚠ Total deve ser 100% (atual: {totalPct.toFixed(0)}%)
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        <div style={{ display:"flex", gap:20 }}>
          {/* COLUNA CÔMODOS */}
          <div style={{ flex:"0 0 55%", maxWidth:"55%", display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", gap:8, marginBottom:4 }}>
              {Object.keys(customConfig.comodos||{}).length > 0 && (
                <span style={{ fontSize:11, color:"#f59e0b", fontWeight:700, background:"#451a03", border:"1px solid #92400e", borderRadius:6, padding:"3px 8px" }}>
                  ⚠ Tabela personalizada em uso
                </span>
              )}
              <button style={{ ...S.btnSecondary, fontSize:12 }} onClick={() => setEditandoTabela(v => !v)}>
                ⚙ {editandoTabela ? "Fechar Editor" : "Editar Tabela de Cômodos"}
              </button>
            </div>


            {/* Repetição de unidades — compacto, oculto só para Conj. Comercial */}
            {cfg.tipo !== "Comercial" && (
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:"#1e293b", border:"1px solid #475569", borderRadius:8, marginBottom:8 }}>
                <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", flex:1 }}>
                  <input type="checkbox" checked={!!cfg.repeticao} onChange={e => setCfg(c => ({...c, repeticao:e.target.checked, nUnidades: e.target.checked ? (c.nUnidades > 1 ? c.nUnidades : 2) : 1}))} />
                  <span style={{ fontSize:13, color:"#f1f5f9", fontWeight:600 }}>Repetição de unidades</span>
                  {cfg.repeticao && <span style={{ fontSize:12, color:"#a78bfa", marginLeft:4 }}>{cfg.nUnidades||2}×</span>}
                </label>
                {cfg.repeticao && (
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <button style={{ width:28, height:28, borderRadius:6, border:"1px solid #64748b", background:"#334155", color:"#f1f5f9", fontSize:18, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}
                      onClick={() => setCfg(c => ({...c, nUnidades: Math.max(2, (parseInt(c.nUnidades)||2) - 1)}))}>−</button>
                    <span style={{ minWidth:28, textAlign:"center", fontSize:14, fontWeight:700, color:"#f1f5f9" }}>{cfg.nUnidades||2}</span>
                    <button style={{ width:28, height:28, borderRadius:6, border:"1px solid #64748b", background:"#334155", color:"#f1f5f9", fontSize:18, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}
                      onClick={() => setCfg(c => ({...c, nUnidades: (parseInt(c.nUnidades)||2) + 1}))}>+</button>
                  </div>
                )}
              </div>
            )}

            {Object.entries(GRUPOS_ATUAL).map(([grupo, nomes]) => {
              const grupoAberto = gruposAbertos[grupo] !== false; // default aberto
              return (
              <div key={grupo} style={S.section}>
                <div style={{ ...S.sectionTitle, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                  {grupo}
                  {cfg.tipo === "Comercial" && grupo === "Por Loja" && (<>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ color:"#64748b", fontSize:11, fontWeight:400 }}>🏪 Qtd de lojas:</span>
                      <input style={{ ...S.input, width:64, textAlign:"center", padding:"4px 8px", fontSize:12 }} type="number" min="0" max="50"
                        value={cfg.nLojas} onChange={e=>{
                          const v = parseInt(e.target.value)||0;
                          setCfg({...cfg,nLojas:v});
                          if(v<=0) setComodos(prev=>prev.map(c=>Object.keys(COMODOS_GALERIA_LOJA).includes(c.nome)?{...c,qtd:0}:c));
                        }} />
                    </div>
                    <MiniParam blocoKey="loja" padraoKey="padraoLoja" tamanhoKey="tamanhoLoja" cfg={cfg} setCfg={setCfg} />
                  </>)}
                  {cfg.tipo === "Comercial" && grupo === "Espaço Âncora" && (<>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ color:"#64748b", fontSize:11, fontWeight:400 }}>🏬 Qtd de âncoras:</span>
                      <input style={{ ...S.input, width:64, textAlign:"center", padding:"4px 8px", fontSize:12 }} type="number" min="0"
                        value={cfg.nAncoras} onChange={e=>{
                          const v = parseInt(e.target.value)||0;
                          setCfg({...cfg,nAncoras:v});
                          if(v<=0) setComodos(prev=>prev.map(c=>Object.keys(COMODOS_GALERIA_ANCORA).includes(c.nome)?{...c,qtd:0}:c));
                        }} />
                    </div>
                    <MiniParam blocoKey="ancora" padraoKey="padraoAncora" tamanhoKey="tamanhoAncora" cfg={cfg} setCfg={setCfg} />
                  </>)}
                  {cfg.tipo === "Comercial" && grupo === "Por Apartamento" && (<>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ color:"#64748b", fontSize:11, fontWeight:400 }}>🏠 Qtd de aptos:</span>
                      <input style={{ ...S.input, width:64, textAlign:"center", padding:"4px 8px", fontSize:12 }} type="number" min="0" max="200"
                        value={cfg.nApartamentos} onChange={e=>{
                          const v = parseInt(e.target.value)||0;
                          setCfg({...cfg,nApartamentos:v});
                          if(v<=0) setComodos(prev=>prev.map(c=>Object.keys(COMODOS_GALERIA_APTO).includes(c.nome)?{...c,qtd:0}:c));
                        }} />
                    </div>
                    <MiniParam blocoKey="apto" padraoKey="padraoApto" tamanhoKey="tamanhoApto" cfg={cfg} setCfg={setCfg} />
                  </>)}
                  {cfg.tipo === "Comercial" && grupo === "Galpao" && (<>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ color:"#64748b", fontSize:11, fontWeight:400 }}>🏭 Qtd de galpões:</span>
                      <input style={{ ...S.input, width:64, textAlign:"center", padding:"4px 8px", fontSize:12 }} type="number" min="0"
                        value={cfg.nGalpoes} onChange={e=>{
                          const v = parseInt(e.target.value)||0;
                          setCfg(prev=>({...prev,nGalpoes:v}));
                          if(v<=0) setComodos(prev=>prev.map(c=>Object.keys(COMODOS_GALPAO).includes(c.nome)?{...c,qtd:0}:c));
                        }} />
                    </div>
                    <MiniParam blocoKey="galpao" padraoKey="padraoGalpao" tamanhoKey="tamanhoGalpao" cfg={cfg} setCfg={setCfg} />
                  </>)}
                  </div>
                  {/* Botão recolher */}
                  <button onClick={() => setGruposAbertos(prev => ({...prev, [grupo]: !grupoAberto}))}
                    style={{ background:"none", border:"none", cursor:"pointer", color:"#475569", fontSize:16, padding:"2px 6px", lineHeight:1, fontFamily:"inherit", flexShrink:0 }}>
                    {grupoAberto ? "▲" : "▼"}
                  </button>
                </div>
                {grupoAberto && <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                  {nomes.map(nome => {
                    const comodo = comodos.find(c => c.nome === nome);
                    if (!comodo) return null;
                    const dadosComodoBase = COMODOS_ATUAL[nome];
                    const customC = customConfig?.comodos?.[nome];
                    const dadosComodo = customC ? { ...dadosComodoBase, ...customC } : dadosComodoBase;

                    // Comercial: bloqueia comodos se qtd do bloco = 0
                    const nomesLojaSet   = new Set(Object.keys(COMODOS_GALERIA_LOJA));
                    const nomesAncoraSet = new Set(Object.keys(COMODOS_GALERIA_ANCORA));
                    const nomesAptoSet   = new Set(Object.keys(COMODOS_GALERIA_APTO));
                    const nomesGalpaoSet = new Set(Object.keys(COMODOS_GALPAO));
                    const bloqueado = cfg.tipo === "Comercial" && (
                      (nomesLojaSet.has(nome)   && parseInt(cfg.nLojas)        <= 0) ||
                      (nomesAncoraSet.has(nome) && parseInt(cfg.nAncoras)      <= 0) ||
                      (nomesAptoSet.has(nome)   && parseInt(cfg.nApartamentos) <= 0) ||
                      (nomesGalpaoSet.has(nome) && parseInt(cfg.nGalpoes)      <= 0)
                    );
                    // Tamanho correto por bloco
                    const tamBloco = nomesLojaSet.has(nome) ? (cfg.tamanhoLoja||cfg.tamanho)
                      : nomesAncoraSet.has(nome) ? (cfg.tamanhoAncora||cfg.tamanho)
                      : nomesAptoSet.has(nome)   ? (cfg.tamanhoApto||cfg.tamanho)
                      : nomesGalpaoSet.has(nome) ? (cfg.tamanhoGalpao||cfg.tamanho)
                      : cfg.tamanho;
                    const [comp, larg] = dadosComodo?.medidas[tamBloco] || [0,0];
                    const area = comp * larg;
                    const areaTotal = area * comodo.qtd;
                    const disponivel = area > 0;
                    const isEstac = cfg.tipo === "Clínica" && nome === "Estacionamento";
                    const areaExibida = isEstac && !estacCoberto ? 0 : areaTotal;
                    return (
                      <div key={nome} style={{ ...S.comodoRow, opacity: bloqueado?0.25:disponivel?1:0.4, pointerEvents: bloqueado?"none":"auto" }}>
                        <div style={{ flex:1 }}>
                          <div style={{ color: comodo.qtd>0?"#f1f5f9":"#64748b", fontWeight: comodo.qtd>0?600:400, fontSize:13, display:"flex", alignItems:"center", gap:8 }}>
                            {nome}
                            {{"Dormitório":"não incluso closet e wc","Suíte":"não incluso closet","Suíte Master":"incluso closet + wc"}[nome] && (
                              <span style={{ fontSize:10, color:"#475569", fontWeight:400, fontStyle:"italic" }}>
                                ({{"Dormitório":"não incluso closet e wc","Suíte":"não incluso closet","Suíte Master":"incluso closet + wc"}[nome]})
                              </span>
                            )}
                            {isEstac && comodo.qtd > 0 && (
                              <div style={{ display:"flex", gap:0, background:"#0f172a", borderRadius:6, overflow:"hidden", border:"1px solid #334155" }}>
                                <button
                                  onClick={() => setEstacCoberto(true)}
                                  style={{ padding:"2px 8px", fontSize:10, fontWeight:700, border:"none", cursor:"pointer", fontFamily:"inherit",
                                    background: estacCoberto ? "#1d4ed8" : "transparent",
                                    color: estacCoberto ? "#fff" : "#64748b" }}>
                                  🏠 Coberto
                                </button>
                                <button
                                  onClick={() => setEstacCoberto(false)}
                                  style={{ padding:"2px 8px", fontSize:10, fontWeight:700, border:"none", cursor:"pointer", fontFamily:"inherit",
                                    background: !estacCoberto ? "#7c3aed" : "transparent",
                                    color: !estacCoberto ? "#fff" : "#64748b" }}>
                                  ☀ Descoberto
                                </button>
                              </div>
                            )}
                          </div>
                          {disponivel && (
                            <div style={{ color:"#475569", fontSize:11 }}>
                              {comp}m × {larg}m = {fmtA(area)}m²
                              {comodo.qtd > 0 && !isEstac && (
                                <span style={{ color:"#60a5fa" }}>
                                  {" → "}
                                  {cfg.tipo === "Clínica" && ["Wcs","PNE Masculino","PNE Feminino"].includes(nome)
                                    ? `${fmtA(areaTotal + comodo.qtd)}m² (incl. antecâmara 1×1m)`
                                    : `${fmtA(areaTotal)}m²`}
                                </span>
                              )}
                              {comodo.qtd > 0 && isEstac && !estacCoberto && <span style={{ color:"#f87171" }}> → área excluída (descoberto)</span>}
                              {comodo.qtd > 0 && isEstac && estacCoberto && <span style={{ color:"#60a5fa" }}> → {fmtA(areaTotal)}m²</span>}
                            </div>
                          )}
                          {!disponivel && <div style={{ color:"#475569", fontSize:11 }}>Não disponível neste tamanho</div>}
                        </div>
                        <div style={S.qtdControl}>
                          <button style={S.qtdBtn} onClick={() => setComodos(prev => prev.map(c => c.nome===nome ? {...c,qtd:Math.max(0,c.qtd-1)} : c))} disabled={bloqueado||!disponivel||comodo.qtd===0}>−</button>
                          <span style={{ ...S.qtdNum, color: comodo.qtd>0&&!bloqueado?"#f59e0b":"#64748b" }}>{comodo.qtd}</span>
                          <button style={S.qtdBtn} onClick={() => setComodos(prev => prev.map(c => c.nome===nome ? {...c,qtd:c.qtd+1} : c))} disabled={bloqueado||!disponivel}>+</button>
                        </div>
                        {comodo.qtd > 0 && (
                          <div style={{ width:70, textAlign:"right", color: isEstac&&!estacCoberto?"#f87171":"#10b981", fontSize:12, fontWeight:600 }}>
                            {isEstac && !estacCoberto ? "excluído" : fmtA(areaTotal,1)+" m²"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>}
              </div>
              );
            })}
          </div>

          {/* COLUNA PREVIEW — STICKY */}
          <div style={S.previewCol}>
            <div style={S.previewCard}>
              <div style={S.previewTitle}>📊 Prévia do Cálculo</div>

              <div style={S.previewSection}>
                {/* Área Total — sempre visível, clicável para expandir */}
                <div style={{ ...S.previewRow, borderBottom: paramAberto==="areaDetalhe" ? "1px solid #1e293b" : "none",
                  paddingBottom: paramAberto==="areaDetalhe" ? 8 : 0, marginBottom: paramAberto==="areaDetalhe" ? 8 : 0,
                  cursor:"pointer" }}
                  onClick={() => setParamAberto(p => p==="areaDetalhe" ? null : "areaDetalhe")}>
                  <span style={{ fontWeight:700, color:"#e2e8f0", display:"flex", alignItems:"center", gap:6 }}>
                    Área Total
                    {cfg.repeticao && (parseInt(cfg.nUnidades)||1) > 1 && (
                      <span style={{ fontSize:11, color:"#64748b", fontWeight:400 }}>({parseInt(cfg.nUnidades)}×)</span>
                    )}
                    <span style={{ fontSize:10, color:"#334155", marginLeft:2 }}>{paramAberto==="areaDetalhe" ? "▲" : "▼"}</span>
                  </span>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:"#3b82f6", fontWeight:800, fontSize:16 }}>{fmtA(preview.areaTotal)} m²</div>
                    {cfg.repeticao && (parseInt(cfg.nUnidades)||1) > 1 && (
                      <div style={{ color:"#94a3b8", fontSize:11 }}>
                        Total: {fmtA(preview.areaTotal * (parseInt(cfg.nUnidades)||1))} m²
                      </div>
                    )}
                  </div>
                </div>
                {/* Detalhes expansíveis */}
                {paramAberto === "areaDetalhe" && (
                  <>
                    <div style={S.previewRow}>
                      <span>Cômodos selecionados</span>
                      <span style={{ color:"#a78bfa" }}>{totalComodos}</span>
                    </div>
                    <div style={S.previewRow}>
                      <span>Área útil</span>
                      <span style={{ color:"#60a5fa" }}>{fmtA(preview.areaBruta)} m²</span>
                    </div>
                    {(preview.areaPiscina||0) > 0 && (
                      <div style={S.previewRow}>
                        <span>{cfg.tipo === "Clínica" && !estacCoberto ? "Estac. descoberto (excluído)" : "Piscina (excluída)"}</span>
                        <span style={{ color:"#f87171", textDecoration:"line-through" }}>{fmtA(preview.areaPiscina)} m²</span>
                      </div>
                    )}
                    <div style={S.previewRow}>
                      <span>+ {getTipoConfig(cfg.tipo).labelCirk}% circulação</span>
                      <span style={{ color:"#60a5fa" }}>+{fmtA((preview.areaBruta||0)*getTipoConfig(cfg.tipo).acrescimoCirk)} m²</span>
                    </div>
                  </>
                )}
              </div>

              {preview.tipo === "Comercial" ? (
                <div style={S.previewSection}>
                  <div style={S.previewLabel}>Comercial — Blocos</div>
                  <div style={S.previewRow}>
                    <span>🏪 {preview.nLojas}x Lojas</span>
                    <span style={{ color:"#10b981" }}>{fmt(preview.precoLojas)}</span>
                  </div>
                  <div style={{ ...S.previewRow, fontSize:11, paddingLeft:8 }}>
                    <span style={{ color:"#475569" }}>{fmtA(preview.m2Loja1,1)}m² cada · R$ {fmtA(preview.precoM2Loja)}/m²</span>
                    <span style={{ color:"#64748b" }}>{fmt(preview.precoLoja1)} por loja</span>
                  </div>
                  {(preview.nAncoras||0) > 0 && (preview.precoAncoras||0) > 0 && (<>
                    <div style={S.previewRow}>
                      <span>🏬 {preview.nAncoras}x Âncoras</span>
                      <span style={{ color:"#10b981" }}>{fmt(preview.precoAncoras)}</span>
                    </div>
                    <div style={{ ...S.previewRow, fontSize:11, paddingLeft:8 }}>
                      <span style={{ color:"#475569" }}>{fmtA(preview.m2Anc1,1)}m² cada · R$ {fmtA(preview.precoM2Ancora)}/m²</span>
                      <span style={{ color:"#64748b" }}>{fmt(preview.precoAnc1)} por âncora</span>
                    </div>
                  </>)}
                  {(preview.nApartamentos||0) > 0 && (preview.precoAptos||0) > 0 && (<>
                    <div style={S.previewRow}>
                      <span>🏠 {preview.nApartamentos}x Aptos</span>
                      <span style={{ color:"#10b981" }}>{fmt(preview.precoAptos)}</span>
                    </div>
                    <div style={{ ...S.previewRow, fontSize:11, paddingLeft:8 }}>
                      <span style={{ color:"#475569" }}>{fmtA(preview.m2Apto1,1)}m² cada · R$ {fmtA(preview.precoM2Apto)}/m²</span>
                      <span style={{ color:"#64748b" }}>{fmt(preview.precoApto1)} por apto</span>
                    </div>
                  </>)}
                  {(preview.nGalpoes||0) > 0 && (preview.precoGalpoes||0) > 0 && (<>
                    <div style={S.previewRow}>
                      <span>🏭 {preview.nGalpoes}x Galpões</span>
                      <span style={{ color:"#10b981" }}>{fmt(preview.precoGalpoes)}</span>
                    </div>
                    <div style={{ ...S.previewRow, fontSize:11, paddingLeft:8 }}>
                      <span style={{ color:"#475569" }}>{fmtA(preview.m2Galpao1,1)}m² cada · R$ {fmtA(preview.precoM2Galpao)}/m²</span>
                      <span style={{ color:"#64748b" }}>{fmt(preview.precoGalpao1)} por galpão</span>
                    </div>
                  </>)}
                  <div style={S.previewRow}>
                    <span>Áreas comuns</span>
                    <span style={{ color:"#10b981" }}>{fmt(preview.precoComum)}</span>
                  </div>
                  <div style={S.previewRow}>
                    <span>🏗 Fachada (+{((preview.indiceFachada||0)*100).toFixed(0)}%)</span>
                    <span style={{ color:"#f59e0b" }}>{fmt(preview.precoFachada)}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div style={S.previewSection}>
                    <div style={{ ...S.previewLabel, display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}
                      onClick={() => setParamAberto(p => p==="indices" ? null : "indices")}>
                      <span>Índices</span>
                      <span style={{ fontSize:10, color:"#475569" }}>{paramAberto==="indices" ? "▲" : "▼"}</span>
                    </div>
                    {paramAberto === "indices" && (
                      <>
                        <div style={S.previewRow}>
                          <span>Índice Cômodos</span>
                          <span style={{ color:"#f59e0b" }}>{fmtA(preview.indiceComodos||0, 3)}</span>
                        </div>
                        <div style={S.previewRow}>
                          <span>Índice Padrão ({cfg.padrao})</span>
                          <span style={{ color:"#f59e0b" }}>{fmtA(preview.indicePadrao||0, 2)}</span>
                        </div>
                        <div style={S.previewRow}>
                          <span>Fator total</span>
                          <span style={{ color:"#fbbf24", fontWeight:700 }}>× {fmtA(preview.fator||0, 3)}</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div style={S.previewSection}>
                    <div style={{ ...S.previewLabel, display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}
                      onClick={() => setParamAberto(p => p==="faixasArq" ? null : "faixasArq")}>
                      <span>Faixas — Arquitetura</span>
                      <span style={{ fontSize:10, color:"#475569" }}>{paramAberto==="faixasArq" ? "▲" : "▼"}</span>
                    </div>
                    {paramAberto === "faixasArq" && (preview.detalheFaixas||[]).map((f,i) => (
                      <div key={i} style={{ ...S.previewRow, fontSize:11 }}>
                        <span style={{ color:"#475569" }}>
                          {fmtA(f.de||0,0)}–{fmtA(f.ate||0,0)} m²
                          {f.desconto>0
                            ? <span style={{ color:"#f87171" }}> (–{(f.desconto*100).toFixed(0)}%)</span>
                            : <span style={{ color:"#4ade80" }}> (cheio)</span>}
                        </span>
                        <span style={{ color:"#10b981" }}>{fmt(f.preco)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div style={S.previewTotal}>
                {(() => {
                  const nUnid    = preview.nUnidades || 1;
                  const area     = preview.areaTotal || 0;
                  const hasRep   = cfg.repeticao && nUnid > 1;
                  const hasEng   = (previewComImposto.engTotal || 0) > 0;
                  const aliq     = cfg.incluiImposto ? (parseFloat(cfg.aliquotaImposto)||0) : 0;
                  const fator    = aliq > 0 ? 1/(1-aliq/100) : 1;
                  const ci       = v => Math.round(v * fator * 100)/100;

                  // ARQ sem imposto por unidade
                  const arq1sem  = preview.precoFinal || 0;
                  // ARQ repetições sem imposto
                  const arqFaixas = preview.repeticaoFaixas || [];
                  // ARQ total sem imposto
                  const arqTotSem = preview.precoTotal || arq1sem;
                  // ENG sem imposto por unidade
                  const eng1sem   = preview.engTotal || 0;
                  // ENG repetições sem imposto
                  const engFaixasSem = [];
                  let engRepSem = eng1sem;
                  let areaAcum  = area;
                  if (hasRep && hasEng) {
                    for (let i = 2; i <= nUnid; i++) {
                      const pct = getTipoConfig(cfg.tipo).repeticaoPcts(areaAcum);
                      const val = Math.round(eng1sem * pct * 100)/100;
                      engFaixasSem.push({ unidade: i, pct, val });
                      engRepSem += val;
                      areaAcum  += area;
                    }
                  }
                  const engTotSem  = hasEng ? Math.round(engRepSem * 100)/100 : 0;
                  const totalSem   = Math.round((arqTotSem + engTotSem) * 100)/100;
                  const impostoVal = aliq > 0 ? Math.round((totalSem * fator - totalSem) * 100)/100 : 0;
                  const totalCom   = Math.round(totalSem * fator * 100)/100;
                  const fmtM2v     = (v, a) => a > 0 ? `R$ ${fmtA(Math.round(v/a*100)/100)}/m²` : "";

                  const subLabel = { fontSize:10, color:"#475569", marginTop:2 };
                  const secLabel = { fontSize:10, color:"#94a3b8", textTransform:"uppercase", letterSpacing:0.5, fontWeight:700, marginBottom:3 };
                  const bigVal   = (color, size=22) => ({ color, fontWeight:900, fontSize:size, letterSpacing:-0.5 });
                  const rowUnd   = { display:"flex", justifyContent:"space-between", fontSize:11, color:"#64748b", marginTop:2 };
                  const sep      = { borderTop:"1px solid #1e293b", marginTop:10, paddingTop:10 };

                  return (
                    <>
                      {/* ARQUITETURA */}
                      <div style={secLabel}>Arquitetura</div>
                      <div style={{ display:"flex", alignItems:"baseline", justifyContent:"flex-end", gap:8,
                        cursor: nUnid > 1 ? "pointer" : "default" }}
                        onClick={() => nUnid > 1 && setParamAberto(p => p==="arqUnids" ? null : "arqUnids")}>
                        <div style={bigVal("#f59e0b", 24)}>{fmt(arqTotSem)}</div>
                        {area > 0 && <span style={{ fontSize:11, color:"#78716c" }}>{fmtM2v(arqTotSem, area * nUnid)}</span>}
                        {nUnid > 1 && <span style={{ fontSize:10, color:"#44403c" }}>{paramAberto==="arqUnids" ? "▲" : "▼"}</span>}
                      </div>
                      {(nUnid > 1 && paramAberto === "arqUnids") && (
                        <>
                          <div style={rowUnd}>
                            <span>Und 1</span>
                            <span>{fmt(arq1sem)} ({fmtM2v(arq1sem, area)})</span>
                          </div>
                          {arqFaixas.map((f,i) => (
                            <div key={i} style={rowUnd}>
                              <span>Und {f.unidade} ({(f.pct*100).toFixed(0)}%)</span>
                              <span>{fmt(f.precoUni)} ({fmtM2v(f.precoUni, area)})</span>
                            </div>
                          ))}
                        </>
                      )}

                      {/* ENGENHARIA */}
                      {hasEng && (
                        <div style={sep}>
                          <div style={secLabel}>Engenharia <span style={{ fontSize:8, fontWeight:400, letterSpacing:0 }}>(Faixas de desconto)</span></div>
                          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"flex-end", gap:8,
                            cursor: nUnid > 1 ? "pointer" : "default" }}
                            onClick={() => nUnid > 1 && setParamAberto(p => p==="engUnids" ? null : "engUnids")}>
                            <div style={bigVal("#a78bfa", 22)}>{fmt(engTotSem)}</div>
                            {area > 0 && <span style={{ fontSize:11, color:"#78716c" }}>{fmtM2v(engTotSem, area * nUnid)}</span>}
                            {nUnid > 1 && <span style={{ fontSize:10, color:"#44403c" }}>{paramAberto==="engUnids" ? "▲" : "▼"}</span>}
                          </div>
                          {(nUnid > 1 && paramAberto === "engUnids") && (
                            <>
                              <div style={rowUnd}>
                                <span>Und 1</span>
                                <span>{fmt(eng1sem)} ({fmtM2v(eng1sem, area)})</span>
                              </div>
                              {engFaixasSem.map((f,i) => (
                                <div key={i} style={rowUnd}>
                                  <span>Und {f.unidade} ({(f.pct*100).toFixed(0)}%)</span>
                                  <span>{fmt(f.val)} ({fmtM2v(f.val, area)})</span>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      )}

                      {/* IMPOSTO */}
                      {aliq > 0 && (
                        <div style={{ ...sep, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={{ fontSize:12, color:"#fca5a5" }}>+ Imposto {aliq}%</span>
                          <span style={{ fontSize:12, color:"#fca5a5", fontWeight:700 }}>{fmt(impostoVal)}</span>
                        </div>
                      )}

                      {/* TOTAL */}
                      <div style={{ ...sep, background:"rgba(0,0,0,0.25)", borderRadius:10, padding:"10px 12px", marginTop:10 }}>
                        <div style={secLabel}>Total</div>
                        <div style={bigVal("#ffffff", 24)}>{fmt(totalCom)}</div>
                        <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>
                          {fmtM2v(totalCom, area * (hasRep ? nUnid : 1))}
                          {hasRep ? ` · ${fmtA(area * nUnid)} m² total` : ` · ${fmtA(area)} m²`}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:16 }}>
                <button style={S.btnPrimary} onClick={() => setShowPagamentoModal(true)}>
                  ✓ Gerar Orçamento
                </button>
                <button style={S.btnSecondary} onClick={() => setStep(1)}>
                  ← Voltar
                </button>
              </div>

              {/* Modal iOS — Escolha de Pagamento */}
              {showPagamentoModal && (() => {
                const arqVal = previewComImposto.precoTotal || previewComImposto.precoFinal || 0;
                const engVal = previewComImposto.engTotal || 0;
                const totalVal = arqVal + engVal;
                const etapas = cfg.etapasPct || [];
                const fmtV = v => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
                const totalPct = etapas.reduce((s,e)=>s+Number(e.pct),0);

                const handleEscolha = (tipo) => {
                  setCfg(prev => ({...prev, tipoPagamento: tipo}));
                  setShowPagamentoModal(false);
                  // Usa override para garantir valor correto mesmo com setCfg assíncrono
                  handleSalvar({ tipoPagamento: tipo });
                };

                const overlayStyle = {
                  position:"fixed", inset:0, zIndex:9999,
                  background:"rgba(0,0,0,0.55)",
                  backdropFilter:"blur(12px)",
                  WebkitBackdropFilter:"blur(12px)",
                  display:"flex", alignItems:"flex-end", justifyContent:"center",
                  animation:"fadeInOverlay 0.25s ease",
                  paddingBottom:0,
                };
                const sheetStyle = {
                  width:"100%", maxWidth:520,
                  background:"rgba(255,255,255,0.92)",
                  backdropFilter:"blur(40px)",
                  WebkitBackdropFilter:"blur(40px)",
                  borderRadius:"28px 28px 0 0",
                  padding:"12px 20px 32px",
                  boxShadow:"0 -8px 60px rgba(0,0,0,0.25)",
                  animation:"slideUpSheet 0.35s cubic-bezier(0.32,0.72,0,1)",
                  fontFamily:"-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
                  maxHeight:"88vh",
                  overflowY:"auto",
                  WebkitOverflowScrolling:"touch",
                };
                const pillStyle = {
                  width:36, height:4, borderRadius:2,
                  background:"rgba(0,0,0,0.18)", margin:"0 auto 18px",
                };
                const titleStyle = {
                  fontSize:20, fontWeight:700, color:"#1c1c1e",
                  textAlign:"center", marginBottom:4, letterSpacing:-0.5,
                };
                const subtitleStyle = {
                  fontSize:13, color:"#8e8e93", textAlign:"center",
                  marginBottom:20, letterSpacing:-0.1,
                };
                const cardStyle = (active) => ({
                  background: active ? "rgba(0,122,255,0.07)" : "rgba(255,255,255,0.8)",
                  border: `1.5px solid ${active ? "#007aff" : "rgba(0,0,0,0.1)"}`,
                  borderRadius:18, padding:"16px 18px", marginBottom:10,
                  cursor:"pointer", transition:"all 0.18s ease",
                  boxShadow: active ? "0 0 0 3px rgba(0,122,255,0.12)" : "0 1px 4px rgba(0,0,0,0.06)",
                });
                const cardTitleStyle = (active) => ({
                  fontSize:15, fontWeight:700,
                  color: active ? "#007aff" : "#1c1c1e",
                  marginBottom:3, letterSpacing:-0.3,
                });
                const cardDescStyle = {
                  fontSize:12, color:"#8e8e93", lineHeight:1.5, letterSpacing:-0.1,
                };
                const cardValueStyle = {
                  fontSize:17, fontWeight:800, color:"#1c1c1e",
                  letterSpacing:-0.5, marginTop:6,
                };
                const btnConfirmStyle = {
                  width:"100%", padding:"15px 0", borderRadius:14,
                  background:"linear-gradient(135deg, #007aff, #0051d4)",
                  color:"#fff", fontWeight:700, fontSize:16,
                  border:"none", cursor:"pointer", letterSpacing:-0.3,
                  boxShadow:"0 4px 20px rgba(0,122,255,0.35)",
                  transition:"transform 0.15s ease, box-shadow 0.15s ease",
                  marginTop:8, fontFamily:"inherit",
                };
                const btnCancelStyle = {
                  width:"100%", padding:"14px 0", borderRadius:14,
                  background:"rgba(0,0,0,0.06)", color:"#1c1c1e",
                  fontWeight:600, fontSize:15, border:"none", cursor:"pointer",
                  letterSpacing:-0.2, marginTop:6, fontFamily:"inherit",
                  transition:"background 0.15s ease",
                };

                const isPadrao = cfg.tipoPagamento !== "etapas";
                // Padrão: Apenas Arq
                const descArq     = descontoEtapa;   // reusa descontoEtapa para apenas arq
                const nParcArq    = parcelasEtapa;    // reusa parcelasEtapa para apenas arq
                const arqComDesc  = Math.round(arqVal * (1 - descArq/100) * 100)/100;
                const parcelaArq  = Math.round(arqComDesc / (nParcArq||3) * 100)/100;
                // Padrão: Pacote Arq+Eng
                const totalComDesc10 = Math.round((arqVal+engVal) * (1 - descontoPacote/100) * 100)/100;
                const parcela8x      = Math.round(totalComDesc10 / (parcelasPacote||4) * 100)/100;

                const inpStyle = { width:40, textAlign:"center", border:"1px solid rgba(0,0,0,0.15)", borderRadius:6, padding:"2px 4px", fontSize:12, fontWeight:700, outline:"none", fontFamily:"inherit" };

                return (
                  <>
                    <style>{`
                      @keyframes fadeInOverlay { from{opacity:0} to{opacity:1} }
                      @keyframes slideUpSheet { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
                    `}</style>
                    <div style={overlayStyle} onClick={()=>setShowPagamentoModal(false)}>
                      <div style={sheetStyle} onClick={e=>e.stopPropagation()}>
                        <div style={pillStyle} />
                        <div style={titleStyle}>Forma de Pagamento</div>
                        <div style={subtitleStyle}>Escolha antes de gerar o orçamento</div>

                        {/* Opção Padrão */}
                        <div style={cardStyle(isPadrao)} onClick={()=>setCfg(prev=>({...prev,tipoPagamento:"padrao"}))}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                            <div>
                              <div style={cardTitleStyle(isPadrao)}>Pagamento Padrão</div>
                              <div style={cardDescStyle}>Com desconto antecipado ou parcelado</div>
                            </div>
                            <div style={{ width:22, height:22, borderRadius:11,
                              border:`2px solid ${isPadrao?"#007aff":"rgba(0,0,0,0.2)"}`,
                              background: isPadrao?"#007aff":"transparent",
                              display:"flex", alignItems:"center", justifyContent:"center",
                              flexShrink:0, marginLeft:12, transition:"all 0.18s",
                            }}>
                              {isPadrao && <span style={{ color:"#fff", fontSize:11, fontWeight:900 }}>✓</span>}
                            </div>
                          </div>
                          {isPadrao && (
                            <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid rgba(0,122,255,0.15)" }}
                              onClick={e=>e.stopPropagation()}>

                              {/* Apenas Arquitetura */}
                              <div style={{ background:"#fafafa", borderRadius:10, padding:"10px 12px", marginBottom:10 }}>
                                <div style={{ fontSize:11, color:"#374151", fontWeight:700, marginBottom:8 }}>Apenas Arquitetura</div>
                                {/* Opção 1: antecipado com desconto */}
                                <div style={{ marginBottom:8, paddingBottom:8, borderBottom:"1px solid rgba(0,0,0,0.06)" }}>
                                  <div style={{ fontSize:10, color:"#8e8e93", marginBottom:4, fontWeight:600 }}>Antecipado (com desconto)</div>
                                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                    <input type="number" min="0" max="50" step="1" style={{ ...inpStyle, color:"#34c759" }}
                                      value={descontoEtapa} onChange={e=>setDescontoEtapa(parseFloat(e.target.value)||0)} />
                                    <span style={{ fontSize:11, color:"#8e8e93" }}>% OFF → {fmtV(arqComDesc)}</span>
                                  </div>
                                </div>
                                {/* Opção 2: parcelado sem desconto */}
                                <div>
                                  <div style={{ fontSize:10, color:"#8e8e93", marginBottom:4, fontWeight:600 }}>Parcelado (sem desconto)</div>
                                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                    <input type="number" min="1" max="24" step="1" style={{ ...inpStyle, color:"#007aff" }}
                                      value={parcelasEtapa} onChange={e=>setParcelasEtapa(parseInt(e.target.value)||3)} />
                                    <span style={{ fontSize:11, color:"#8e8e93" }}>× sem desconto → {fmtV(arqVal/(parcelasEtapa||3))}/mês</span>
                                  </div>
                                </div>
                              </div>

                              {/* Pacote Arq + Eng */}
                              {engVal > 0 && (
                                <div style={{ background:"#fafafa", borderRadius:10, padding:"10px 12px" }}>
                                  <div style={{ fontSize:11, color:"#374151", fontWeight:700, marginBottom:8 }}>Pacote (Arq. + Eng.)</div>
                                  {/* Opção 1: antecipado com desconto */}
                                  <div style={{ marginBottom:8, paddingBottom:8, borderBottom:"1px solid rgba(0,0,0,0.06)" }}>
                                    <div style={{ fontSize:10, color:"#8e8e93", marginBottom:4, fontWeight:600 }}>Antecipado (com desconto)</div>
                                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                      <input type="number" min="0" max="50" step="1" style={{ ...inpStyle, color:"#34c759" }}
                                        value={descontoPacote} onChange={e=>setDescontoPacote(parseFloat(e.target.value)||0)} />
                                      <span style={{ fontSize:11, color:"#8e8e93" }}>% OFF → {fmtV(totalComDesc10)}</span>
                                    </div>
                                  </div>
                                  {/* Opção 2: parcelado sem desconto */}
                                  <div>
                                    <div style={{ fontSize:10, color:"#8e8e93", marginBottom:4, fontWeight:600 }}>Parcelado (sem desconto)</div>
                                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                      <input type="number" min="1" max="24" step="1" style={{ ...inpStyle, color:"#6366f1" }}
                                        value={parcelasPacote} onChange={e=>setParcelasPacote(parseInt(e.target.value)||4)} />
                                      <span style={{ fontSize:11, color:"#8e8e93" }}>× sem desconto → {fmtV((arqVal+engVal)/(parcelasPacote||4))}/mês</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Opção Por Etapas */}
                        <div style={cardStyle(!isPadrao)} onClick={()=>setCfg(prev=>({...prev,tipoPagamento:"etapas"}))}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <div style={cardTitleStyle(!isPadrao)}>Pagamento por Etapas</div>
                              {/* Botão + etapa sempre visível ao lado do título */}
                              <button
                                onClick={e=>{ e.stopPropagation(); setCfg(prev=>{ const n=(prev.etapasPct||[]).length+1; return {...prev, tipoPagamento:"etapas", etapasPct:[...(prev.etapasPct||[]),{id:Date.now(),nome:`Etapa ${n}`,pct:0}]}; }); }}
                                style={{ fontSize:11, fontWeight:700, color:"#007aff", background:"rgba(0,122,255,0.1)", border:"1px solid rgba(0,122,255,0.25)", borderRadius:8, padding:"3px 10px", cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                                + Etapa
                              </button>
                            </div>
                            <div style={{ width:22, height:22, borderRadius:11,
                              border:`2px solid ${!isPadrao?"#007aff":"rgba(0,0,0,0.2)"}`,
                              background: !isPadrao?"#007aff":"transparent",
                              display:"flex", alignItems:"center", justifyContent:"center",
                              flexShrink:0, marginLeft:8, transition:"all 0.18s",
                            }}>
                              {!isPadrao && <span style={{ color:"#fff", fontSize:11, fontWeight:900 }}>✓</span>}
                            </div>
                          </div>

                          {!isPadrao && (
                            <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid rgba(0,122,255,0.15)" }}
                              onClick={e=>e.stopPropagation()}>

                              {/* Tabela editável de etapas */}
                              <div style={{ borderRadius:10, overflow:"hidden", border:"1px solid rgba(0,0,0,0.08)", marginBottom:10 }}>
                                {/* Header */}
                                <div style={{ display:"grid", gridTemplateColumns:"1fr 64px 1fr 28px", background:"rgba(0,122,255,0.08)", padding:"6px 10px", fontSize:10, color:"#8e8e93", fontWeight:700, textTransform:"uppercase", letterSpacing:0.5 }}>
                                  <span>Etapa</span><span style={{ textAlign:"center" }}>%</span><span style={{ textAlign:"right" }}>Valor</span><span/>
                                </div>
                                {/* Linhas editáveis */}
                                {etapas.map((e,i) => (
                                  <div key={e.id} style={{ display:"grid", gridTemplateColumns:"1fr 64px 1fr 28px", padding:"6px 10px", borderTop:"1px solid rgba(0,0,0,0.05)", alignItems:"center", background: i%2===0?"#fff":"rgba(0,0,0,0.02)" }}>
                                    <input
                                      type="text"
                                      value={e.nome}
                                      onChange={ev => setCfg(prev => ({ ...prev, etapasPct: prev.etapasPct.map((ep,j)=>j===i?{...ep,nome:ev.target.value}:ep) }))}
                                      style={{ fontSize:12, color:"#1c1c1e", fontWeight:500, border:"none", borderBottom:"1px solid rgba(0,0,0,0.12)", background:"transparent", outline:"none", fontFamily:"inherit", width:"100%", padding:"1px 0" }} />
                                    <div style={{ display:"flex", alignItems:"center", gap:2, justifyContent:"center" }}>
                                      <input type="number" min="0" max="100" step="1"
                                        style={{ width:40, textAlign:"center", border:"1px solid rgba(0,122,255,0.3)", borderRadius:6, padding:"2px 4px", fontSize:12, fontWeight:700, color:"#007aff", background:"rgba(0,122,255,0.06)", outline:"none", fontFamily:"inherit" }}
                                        value={e.pct}
                                        onChange={ev => setCfg(prev => ({ ...prev, etapasPct: prev.etapasPct.map((ep,j)=>j===i?{...ep,pct:Number(ev.target.value)||0}:ep) }))} />
                                      <span style={{ fontSize:11, color:"#8e8e93" }}>%</span>
                                    </div>
                                    <span style={{ fontSize:12, fontWeight:700, color:"#007aff", textAlign:"right" }}>{fmtV(arqVal*e.pct/100)}</span>
                                    <button
                                      onClick={ev=>{ ev.stopPropagation(); setCfg(prev=>({...prev, etapasPct: prev.etapasPct.filter((_,j)=>j!==i)})); }}
                                      style={{ width:20, height:20, borderRadius:10, background:"rgba(255,59,48,0.12)", border:"none", color:"#ff3b30", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0, fontFamily:"inherit" }}>
                                      ×
                                    </button>
                                  </div>
                                ))}
                                {/* Botão + etapa removido daqui — está no cabeçalho do card */}
                                {/* Linha Engenharia (se incluída) */}
                                {engVal > 0 && (
                                  <div style={{ display:"grid", gridTemplateColumns:"1fr 64px 1fr 28px", padding:"7px 10px", borderTop:"1px solid rgba(0,0,0,0.05)", alignItems:"center", background: etapas.length%2===0?"#fff":"rgba(0,0,0,0.02)" }}>
                                    <div>
                                      <div style={{ fontSize:12, color:"#1c1c1e", fontWeight:500 }}>Engenharia</div>
                                      <div style={{ fontSize:10, color:"#8e8e93" }}>Estrutural · Elétrico · Hidro</div>
                                    </div>
                                    <span style={{ textAlign:"center", fontSize:11, color:"#8e8e93" }}>—</span>
                                    <span style={{ fontSize:12, fontWeight:700, color:"#6366f1", textAlign:"right" }}>{fmtV(engVal)}</span>
                                    <span/>
                                  </div>
                                )}
                                {/* Total */}
                                <div style={{ display:"grid", gridTemplateColumns:"1fr 64px 1fr 28px", padding:"8px 10px", borderTop:"1px solid rgba(0,0,0,0.1)", background:"rgba(0,122,255,0.05)", alignItems:"center" }}>
                                  <span style={{ fontSize:12, fontWeight:700, color:"#1c1c1e" }}>Total</span>
                                  <span style={{ textAlign:"center", fontSize:12, fontWeight:700, color: Math.abs(totalPct-100)<0.5?"#34c759":"#ff3b30" }}>{totalPct.toFixed(0)}%</span>
                                  <span style={{ fontSize:12, fontWeight:800, color:"#1c1c1e", textAlign:"right" }}>{fmtV(totalVal)}</span>
                                  <span/>
                                </div>
                              </div>

                              {/* Descontos e parcelas editáveis */}
                              <div style={{ background:"rgba(0,0,0,0.03)", borderRadius:10, padding:"10px 12px" }}>
                                <div style={{ fontSize:10, color:"#8e8e93", fontWeight:700, textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>Condições de Contratação</div>
                                {/* Etapa a etapa */}
                                <div style={{ marginBottom:8, paddingBottom:8, borderBottom:"1px solid rgba(0,0,0,0.06)" }}>
                                  <div style={{ fontSize:11, color:"#3c3c43", fontWeight:600, marginBottom:6 }}>Etapa a Etapa</div>
                                  <div style={{ marginBottom:6, paddingBottom:6, borderBottom:"1px solid rgba(0,0,0,0.04)" }}>
                                    <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Antecipado (com desconto)</div>
                                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                      <input type="number" min="0" max="50" step="1"
                                        style={{ width:40, textAlign:"center", border:"1px solid rgba(0,0,0,0.15)", borderRadius:6, padding:"2px 4px", fontSize:12, fontWeight:700, color:"#34c759", outline:"none", fontFamily:"inherit" }}
                                        value={descontoEtapaCtrt}
                                        onChange={e => setDescontoEtapaCtrt(parseFloat(e.target.value)||0)} />
                                      <span style={{ fontSize:11, color:"#8e8e93" }}>% OFF · desconto antecipado</span>
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Parcelado (sem desconto)</div>
                                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                      <input type="number" min="1" max="12" step="1"
                                        style={{ width:40, textAlign:"center", border:"1px solid rgba(0,0,0,0.15)", borderRadius:6, padding:"2px 4px", fontSize:12, fontWeight:700, color:"#007aff", outline:"none", fontFamily:"inherit" }}
                                        value={parcelasEtapaCtrt}
                                        onChange={e => setParcelasEtapaCtrt(parseInt(e.target.value)||2)} />
                                      <span style={{ fontSize:11, color:"#8e8e93" }}>× sem desconto · por etapa</span>
                                    </div>
                                  </div>
                                </div>
                                {/* Pacote completo */}
                                <div>
                                  <div style={{ fontSize:11, color:"#3c3c43", fontWeight:600, marginBottom:6 }}>Pacote Completo</div>
                                  <div style={{ marginBottom:6, paddingBottom:6, borderBottom:"1px solid rgba(0,0,0,0.04)" }}>
                                    <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Antecipado (com desconto)</div>
                                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                      <input type="number" min="0" max="50" step="1"
                                        style={{ width:40, textAlign:"center", border:"1px solid rgba(0,0,0,0.15)", borderRadius:6, padding:"2px 4px", fontSize:12, fontWeight:700, color:"#007aff", outline:"none", fontFamily:"inherit" }}
                                        value={descontoPacoteCtrt}
                                        onChange={e => setDescontoPacoteCtrt(parseFloat(e.target.value)||0)} />
                                      <span style={{ fontSize:11, color:"#8e8e93" }}>% OFF · desconto</span>
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Parcelado (sem desconto)</div>
                                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                      <input type="number" min="1" max="24" step="1"
                                        style={{ width:40, textAlign:"center", border:"1px solid rgba(0,0,0,0.15)", borderRadius:6, padding:"2px 4px", fontSize:12, fontWeight:700, color:"#007aff", outline:"none", fontFamily:"inherit" }}
                                        value={parcelasPacoteCtrt}
                                        onChange={e => setParcelasPacoteCtrt(parseInt(e.target.value)||8)} />
                                      <span style={{ fontSize:11, color:"#8e8e93" }}>× sem desconto · {fmtV(totalVal/(parcelasPacoteCtrt||8))}/mês</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <button style={btnConfirmStyle}
                          onMouseDown={e=>e.currentTarget.style.transform="scale(0.97)"}
                          onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}
                          onClick={()=>handleEscolha(cfg.tipoPagamento||"padrao")}>
                          Confirmar e Gerar Orçamento
                        </button>
                        <button style={btnCancelStyle}
                          onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,0.1)"}
                          onMouseLeave={e=>e.currentTarget.style.background="rgba(0,0,0,0.06)"}
                          onClick={()=>setShowPagamentoModal(false)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ABA TESTE — wrapper standalone para FormOrcamentoProjetoTeste
// ═══════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════
// resultado-pdf.jsx
// ════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// RESULTADO DO ORÇAMENTO
// ═══════════════════════════════════════════════════════════════
function ResultadoOrcamentoProjeto({ orc, onEditar, onVerProposta, fmt, fmtM2 }) {
  const r = orc.resultado || {};
  const comodosAtivos = orc.comodos?.filter(c => c.qtd > 0) || [];
  // Controla quais cards têm detalhes expandidos (lojas, ancora, apto, memoria, tabela)
  const [expandido, setExpandido] = useState({ lojas:false, ancora:false, apto:false, galpao:false, memoria:false, tabela:false, eng:false, arq:false });
  const [incluiArq, setIncluiArq] = useState(true);
  const [incluiEng, setIncluiEng] = useState(true);
  const _arqBase = r.precoTotal || r.precoFinal || 0;
  const _engRaw  = Math.round((r.engTotal ?? calcularEngenharia(r.areaTotal||0).totalEng) * 100) / 100;
  const _engRepFator = (r.nUnidades||1) > 1
    ? (r.repeticaoFaixas||[]).length > 0
      ? (1 + (r.repeticaoFaixas||[]).reduce((s,f) => s + f.pct, 0))
      : (() => {
          let f = 1, acu = r.areaTotal||0;
          for (let i = 2; i <= (r.nUnidades||1); i++) {
            f += getTipoConfig(orc.tipo||r.tipo).repeticaoPcts(acu);
            acu += r.areaTotal||0;
          }
          return f;
        })()
    : 1;
  const _engRep = Math.round(_engRaw * _engRepFator * 100) / 100;
  const toggleExp = key => setExpandido(p => ({ ...p, [key]: !p[key] }));
  const BtnExp = ({ k }) => (
    <button onClick={()=>toggleExp(k)}
      style={{ background:"none", border:"1px solid #334155", borderRadius:4, color:"#64748b",
               fontSize:11, padding:"1px 7px", cursor:"pointer", fontFamily:"inherit", lineHeight:1.6 }}>
      {expandido[k] ? "▲ retrair" : "▼ expandir"}
    </button>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* HEADER RESULTADO */}
      <div style={S.resultHeader}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ color:"#64748b", fontSize:12, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Orçamento de Projeto</div>
            <h2 style={{ color:"#f1f5f9", fontWeight:900, fontSize:22, margin:0 }}>{orc.cliente || "Sem identificação"}</h2>
            {orc.tipo === "Comercial" ? (
              <div style={{ marginTop:6, display:"flex", flexDirection:"column", gap:4 }}>
                <span style={{ color:"#64748b", fontSize:12 }}>{orc.tipo} · {orc.subtipo} · Tipologia {orc.tipologia}</span>
                <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                  {(r.nLojas||0) > 0 && (
                    <div style={{ background:"#0f172a", border:"1px solid #1e3a5f", borderRadius:8, padding:"5px 12px", fontSize:11 }}>
                      <span style={{ color:"#3b82f6", fontWeight:700 }}>🏪 {r.nLojas}x Loja</span>
                      <span style={{ color:"#475569", margin:"0 4px" }}>·</span>
                      <span style={{ color:"#64748b" }}>Padrão <b style={{color:"#94a3b8"}}>{r.padraoLoja||orc.padrao}</b></span>
                      <span style={{ color:"#475569", margin:"0 4px" }}>·</span>
                      <span style={{ color:"#64748b" }}>Cômodos <b style={{color:"#94a3b8"}}>{r.tamanhoLoja||orc.tamanho}</b></span>
                    </div>
                  )}
                  {(r.nAncoras||0) > 0 && (
                    <div style={{ background:"#0f172a", border:"1px solid #2e1065", borderRadius:8, padding:"5px 12px", fontSize:11 }}>
                      <span style={{ color:"#6366f1", fontWeight:700 }}>🏬 {r.nAncoras}x Âncora</span>
                      <span style={{ color:"#475569", margin:"0 4px" }}>·</span>
                      <span style={{ color:"#64748b" }}>Padrão <b style={{color:"#94a3b8"}}>{r.padraoAncora||orc.padrao}</b></span>
                      <span style={{ color:"#475569", margin:"0 4px" }}>·</span>
                      <span style={{ color:"#64748b" }}>Cômodos <b style={{color:"#94a3b8"}}>{r.tamanhoAncora||orc.tamanho}</b></span>
                    </div>
                  )}
                  {(r.nApartamentos||0) > 0 && (
                    <div style={{ background:"#0f172a", border:"1px solid #451a03", borderRadius:8, padding:"5px 12px", fontSize:11 }}>
                      <span style={{ color:"#f59e0b", fontWeight:700 }}>🏠 {r.nApartamentos}x Apto</span>
                      <span style={{ color:"#475569", margin:"0 4px" }}>·</span>
                      <span style={{ color:"#64748b" }}>Padrão <b style={{color:"#94a3b8"}}>{r.padraoApto||orc.padrao}</b></span>
                      <span style={{ color:"#475569", margin:"0 4px" }}>·</span>
                      <span style={{ color:"#64748b" }}>Cômodos <b style={{color:"#94a3b8"}}>{r.tamanhoApto||orc.tamanho}</b></span>
                    </div>
                  )}
                  {(r.nGalpoes||0) > 0 && (
                    <div style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:8, padding:"5px 12px", fontSize:11 }}>
                      <span style={{ color:"#94a3b8", fontWeight:700 }}>{r.nGalpoes===1?"🏭 1x Galpão":"🏭 "+r.nGalpoes+"x Galpões"}</span>
                      <span style={{ color:"#475569", margin:"0 4px" }}>·</span>
                      <span style={{ color:"#64748b" }}>Padrão <b style={{color:"#94a3b8"}}>{r.padraoGalpao||orc.padrao}</b></span>
                      <span style={{ color:"#475569", margin:"0 4px" }}>·</span>
                      <span style={{ color:"#64748b" }}>Cômodos <b style={{color:"#94a3b8"}}>{r.tamanhoGalpao||orc.tamanho}</b></span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ color:"#64748b", fontSize:13, margin:"6px 0 0" }}>
                {orc.tipo} · {orc.subtipo} · Tipologia {orc.tipologia} · Padrão {orc.padrao} · Tamanho {orc.tamanho}
              </p>
            )}
          </div>
          <div style={{ textAlign:"right", display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
            <div style={{ color:"#64748b", fontSize:11 }}>Emitido em</div>
            <div style={{ color:"#94a3b8", fontSize:13 }}>{new Date(orc.criadoEm).toLocaleDateString("pt-BR")}</div>
            <div style={{ display:"flex", gap:8, marginTop:4, flexWrap:"wrap" }}>
              <button style={{ ...S.btnSecondary }} onClick={onEditar}>✏ Editar</button>
              <button style={{ background:"linear-gradient(135deg,#7c3aed,#5b21b6)", color:"#fff", border:"none", borderRadius:8, padding:"9px 16px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}
                onClick={() => document.getElementById("proposta-comercial-print")?.scrollIntoView({ behavior:"smooth" })}>
                📄 Ver Proposta
              </button>

              {orc.whatsapp && (
                <button style={S.btnWA}
                  onClick={() => {
                    const engTotal = orc.resultado?.engTotal ?? calcularEngenharia(orc.resultado?.areaTotal||0).totalEng;
                    const grandTotal = Math.round(((orc.resultado?.precoFinal||0) + engTotal) * 100) / 100;
                    const msg = `Olá ${orc.cliente?.split(" ")[0] || ""}! 👋\n\nSegue o orçamento do seu projeto:\n\n` +
                      `📐 *${orc.tipo} — ${orc.subtipo}*\n` +
                      `🏠 Tipologia: ${orc.tipologia} | Padrão: ${orc.padrao} | Tamanho: ${orc.tamanho}\n` +
                      `📏 Área total: ${fmtA(orc.resultado?.areaTotal,2)} m²\n\n` +
                      `💰 Projeto Arquitetônico: ${(orc.resultado?.precoFinal||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}\n` +
                      `🔩 Engenharia (Estrutural + Elétrico + Hidrossanitário): ${engTotal.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}\n\n` +
                      `💵 *Total Geral: ${grandTotal.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}*\n\n` +
                      `Qualquer dúvida estou à disposição!`;
                    const num = orc.whatsapp.replace(/\D/g,"");
                    const numero = num.startsWith("55") ? num : "55"+num;
                    const a = document.createElement("a");
                    a.href = "https://wa.me/"+numero+"?text="+encodeURIComponent(msg);
                    a.target = "_blank";
                    a.rel = "noopener noreferrer";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}>
                  💬 Enviar pelo WhatsApp
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TOGGLES ARQ / ENG */}
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", background:"#0a1222", border:"1px solid #1e293b", borderRadius:10, padding:"10px 16px", marginBottom:6 }}>
          <span style={{ color:"#475569", fontSize:12, fontWeight:600 }}>Incluir:</span>
          <div onClick={()=>setIncluiArq(v=>!v)} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", background:incluiArq?"#0f172a":"#080e1a", border:`1px solid ${incluiArq?"#10b981":"#1e293b"}`, borderRadius:8, padding:"5px 12px", userSelect:"none" }}>
            <div style={{ width:14, height:14, borderRadius:3, border:`2px solid ${incluiArq?"#10b981":"#334155"}`, background:incluiArq?"#10b981":"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
              {incluiArq && <span style={{ color:"#fff", fontSize:10, fontWeight:900 }}>✓</span>}
            </div>
            <span style={{ color:incluiArq?"#10b981":"#475569", fontWeight:700, fontSize:13 }}>Arquitetura</span>
          </div>
          <div onClick={()=>setIncluiEng(v=>!v)} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", background:incluiEng?"#0f172a":"#080e1a", border:`1px solid ${incluiEng?"#a78bfa":"#1e293b"}`, borderRadius:8, padding:"5px 12px", userSelect:"none" }}>
            <div style={{ width:14, height:14, borderRadius:3, border:`2px solid ${incluiEng?"#a78bfa":"#334155"}`, background:incluiEng?"#a78bfa":"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
              {incluiEng && <span style={{ color:"#fff", fontSize:10, fontWeight:900 }}>✓</span>}
            </div>
            <span style={{ color:incluiEng?"#a78bfa":"#475569", fontWeight:700, fontSize:13 }}>Engenharia</span>
          </div>
          <span style={{ marginLeft:"auto", color:"#f59e0b", fontWeight:800 }}>{fmt((incluiArq?(_arqBase):0)+(incluiEng?(_engRep):0))}</span>
        </div>

        {/* KPIs principais */}
        {(() => {
          const engTotal = _engRaw;
          const nUnid = r.nUnidades || 1;
          const arqTotal = _arqBase;
          const engTotalRepet = _engRep;
          const grandTotal = Math.round((arqTotal + engTotalRepet) * 100) / 100;
          const temRepet = nUnid > 1;
          const isComercial = r.tipo === "Comercial";
          const at1 = r.areaTotal || 1;
          const atTotal = at1 * nUnid;
          const tcfgR = getTipoConfig(r.tipo);
          // Imposto
          const temImposto = r.impostoAplicado && (r.aliquotaImposto||0) > 0;
          const aliqImp = r.aliquotaImposto || 0;
          // Valor sem imposto = valor_bruto * (1 - aliq/100) pois foi calculado por dentro
          const totalComImposto = (incluiArq?arqTotal:0)+(incluiEng?engTotalRepet:0);
          const totalSemImposto = temImposto ? Math.round(totalComImposto * (1 - aliqImp/100) * 100) / 100 : totalComImposto;
          const valorImposto    = temImposto ? Math.round((totalComImposto - totalSemImposto) * 100) / 100 : 0;
          return (
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:20 }}>
              {/* Cards KPI — sempre no topo */}
              {(() => {
                const cards = [
                  { l:"Área Útil",         v:fmtM2(r.areaBruta),  c:"#3b82f6", m2:null },
                  { l:`Área Total (+${tcfgR.labelCirk}%)${temRepet ? ` · ${nUnid} unid.` : ""}`,
                    v: temRepet ? fmtM2(atTotal) : fmtM2(at1), c:"#6366f1",
                    m2: temRepet ? `1 unid.: ${fmtM2(at1)}` : null },
                  ...(incluiArq ? [{ l: isComercial ? "Projeto Arq." : temRepet ? `Arq. (${nUnid} unid.)` : "Projeto Arq.",
                    v: fmt(arqTotal), c:"#10b981",
                    m2: atTotal > 0 ? `R$ ${fmtA(arqTotal/atTotal)}/m²` : null,
                    sub: temRepet && !isComercial ? `1ª unid: ${fmt(r.precoFinal)} · R$ ${fmtA(r.precoFinal/at1)}/m²` : null }] : []),
                  ...(incluiEng ? [{ l: isComercial ? "Eng. (3 proj.)" : temRepet ? `Eng. (${nUnid} unid.)` : "Eng. (3 proj.)",
                    v: fmt(engTotalRepet), c:"#a78bfa",
                    m2: atTotal > 0 ? `R$ ${fmtA(engTotalRepet/atTotal)}/m²` : null,
                    sub: temRepet && !isComercial ? `1ª unid: ${fmt(engTotal)} · R$ ${fmtA(engTotal/at1)}/m²` : null }] : []),
                ];
                return (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    <div style={{ display:"grid", gridTemplateColumns:`repeat(${cards.length},1fr)`, gap:12, marginBottom:0 }}>
                      {cards.map(({l,v,c,m2,sub}) => (
                        <div key={l} style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:"14px 16px", borderTop:`3px solid ${c}` }}>
                          <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:0.5 }}>{l}</div>
                          <div style={{ color:c, fontWeight:800, fontSize:17, marginTop:4 }}>{v}</div>
                          {m2 && <div style={{ color:"#475569", fontSize:10, marginTop:3 }}>{m2}</div>}
                          {sub && <div style={{ color:"#475569", fontSize:10, marginTop:2 }}>{sub}</div>}
                        </div>
                      ))}
                    </div>

                    {/* TOTAL GERAL — card separado destacado */}
                    <div style={{ background:"rgba(0,0,0,0.4)", borderRadius:10, padding:"14px 20px", borderTop:"3px solid #f59e0b", display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:8 }}>
                      <div>
                        <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:0.5, marginBottom:4 }}>
                          {temRepet ? `TOTAL GERAL · ${nUnid} unid.` : "TOTAL GERAL"}
                        </div>
                        {temImposto ? (
                          <>
                            <div style={{ color:"#94a3b8", fontSize:12, marginBottom:2 }}>
                              Sem imposto: {fmt(totalSemImposto)}
                            </div>
                            <div style={{ color:"#f59e0b", fontWeight:900, fontSize:22 }}>
                              {fmt(totalComImposto)}
                            </div>
                          </>
                        ) : (
                          <div style={{ color:"#f59e0b", fontWeight:900, fontSize:22 }}>
                            {fmt(totalComImposto)}
                          </div>
                        )}
                        {atTotal > 0 && <div style={{ color:"#475569", fontSize:10, marginTop:3 }}>R$ {fmtA(totalComImposto/atTotal)}/m²</div>}
                      </div>
                      {temImposto && (
                        <div style={{ textAlign:"right" }}>
                          <div style={{ background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:8, padding:"8px 14px" }}>
                            <div style={{ color:"#94a3b8", fontSize:10, textTransform:"uppercase", letterSpacing:0.5 }}>
                              Imposto ({aliqImp}% por dentro)
                            </div>
                            <div style={{ color:"#f87171", fontWeight:700, fontSize:15, marginTop:2 }}>
                              + {fmt(valorImposto)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
              {/* KPIs Comercial */}
              {isComercial && incluiArq && (
                <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:8 }}>

                  {/* Bloco Lojas */}
                  {(r.nLojas||0) > 0 && (r.precoLojas||0) > 0 && (
                  <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:"14px 16px", borderTop:"3px solid #3b82f6" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                      <span style={{ color:"#3b82f6", fontWeight:700, fontSize:12, textTransform:"uppercase", letterSpacing:0.5 }}>
                        🏪 Lojas — {r.nLojas}x
                      </span>
                      <BtnExp k="lojas" />
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                      {[
                        ["Área por loja", fmtM2(r.m2Loja1)],
                        ["Área total lojas", fmtM2((r.m2Loja1||0)*r.nLojas)],
                        ["Valor por loja", fmt(r.precoLoja1)],
                        ["R$/m² (loja)", `R$ ${fmtA(r.precoM2Loja)}/m²`],
                      ].map(([l,v]) => (
                        <div key={l}>
                          <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:0.5 }}>{l}</div>
                          <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:14, marginTop:3 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {/* Faixas 1ª loja + repetição — retrátil */}
                    {expandido.lojas && <div style={{ marginTop:10, borderTop:"1px solid #1e293b", paddingTop:8 }}>
                      <div style={{ color:"#475569", fontSize:10, marginBottom:6, textTransform:"uppercase", letterSpacing:0.5 }}>Faixas — 1ª loja (preço cheio)</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                        {(r.detalheFaixasLoja1||[]).map((f,i) => (
                          <div key={i} style={{ background:"#0f172a", borderRadius:6, padding:"4px 10px", fontSize:11 }}>
                            <span style={{ color:"#64748b" }}>{fmtA(f.de,0)}–{fmtA(f.ate,0)}m²</span>
                            {f.desconto > 0
                              ? <span style={{ color:"#f87171", marginLeft:4 }}>−{(f.desconto*100).toFixed(0)}%</span>
                              : <span style={{ color:"#4ade80", marginLeft:4 }}>cheio</span>}
                            <span style={{ color:"#94a3b8", marginLeft:6 }}>{fmt(f.preco)}</span>
                          </div>
                        ))}
                      </div>
                      {(r.repeticaoLojas||[]).length > 1 && (
                        <>
                          <div style={{ color:"#475569", fontSize:10, margin:"8px 0 6px", textTransform:"uppercase", letterSpacing:0.5 }}>Repetição de lojas</div>
                          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                            {(r.repeticaoLojas||[]).map((f,i) => (
                              <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                                <span style={{ color: f.unidade===1?"#4ade80":"#475569" }}>
                                  Loja {f.unidade} {f.unidade===1?"(cheio)":`(${(f.pct*100).toFixed(0)}% — ${fmtA(f.areaAcum,0)}m² acum.)`}
                                </span>
                                <span style={{ color: f.unidade===1?"#10b981":"#a78bfa", fontWeight:600 }}>{fmt(f.precoUni)}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>}
                    {/* Total lojas — sempre visível */}
                    {(r.repeticaoLojas||[]).length > 0 && (
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginTop:8, paddingTop:8, borderTop:"1px solid #1e293b" }}>
                        <span style={{ color:"#e2e8f0", fontWeight:700, fontSize:12 }}>Total lojas</span>
                        <span style={{ textAlign:"right" }}>
                          <span style={{ color:"#3b82f6", fontWeight:800, fontSize:14 }}>{fmt(r.precoLojas)}</span>
                          <span style={{ color:"#475569", fontSize:10, marginLeft:6 }}>
                            ({`R$ ${fmtA(r.precoLojas / ((r.m2Loja1||1) * r.nLojas))}/m²`})
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                  )}

                  {/* Bloco Âncoras */}
                  {(r.nAncoras||0) > 0 && (r.precoAncoras||0) > 0 && (
                    <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:"14px 16px", borderTop:"3px solid #6366f1" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                        <span style={{ color:"#6366f1", fontWeight:700, fontSize:12, textTransform:"uppercase", letterSpacing:0.5 }}>
                          🏬 Espaços Âncoras — {r.nAncoras}x
                        </span>
                        <BtnExp k="ancora" />
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                        {[
                          ["Área por âncora", fmtM2(r.m2Anc1)],
                          ["Área total âncoras", fmtM2((r.m2Anc1||0)*r.nAncoras)],
                          ["Valor por âncora", fmt(r.precoAnc1)],
                          ["R$/m² (âncora)", `R$ ${fmtA(r.precoM2Ancora)}/m²`],
                        ].map(([l,v]) => (
                          <div key={l}>
                            <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:0.5 }}>{l}</div>
                            <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:14, marginTop:3 }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      {/* Faixas 1ª âncora + repetição */}
                      {expandido.ancora && <div style={{ marginTop:10, borderTop:"1px solid #1e293b", paddingTop:8 }}>
                        <div style={{ color:"#475569", fontSize:10, marginBottom:6, textTransform:"uppercase", letterSpacing:0.5 }}>Faixas — 1ª âncora (preço cheio)</div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                          {(r.detalheFaixasAnc1||[]).map((f,i) => (
                            <div key={i} style={{ background:"#0f172a", borderRadius:6, padding:"4px 10px", fontSize:11 }}>
                              <span style={{ color:"#64748b" }}>{fmtA(f.de,0)}–{fmtA(f.ate,0)}m²</span>
                              {f.desconto > 0
                                ? <span style={{ color:"#f87171", marginLeft:4 }}>−{(f.desconto*100).toFixed(0)}%</span>
                                : <span style={{ color:"#4ade80", marginLeft:4 }}>cheio</span>}
                              <span style={{ color:"#94a3b8", marginLeft:6 }}>{fmt(f.preco)}</span>
                            </div>
                          ))}
                        </div>
                        {(r.repeticaoAncoras||[]).length > 1 && (
                          <>
                            <div style={{ color:"#475569", fontSize:10, margin:"8px 0 6px", textTransform:"uppercase", letterSpacing:0.5 }}>Repetição de âncoras</div>
                            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                              {(r.repeticaoAncoras||[]).map((f,i) => (
                                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                                  <span style={{ color: f.unidade===1?"#4ade80":"#475569" }}>
                                    Âncora {f.unidade} {f.unidade===1?"(cheio)":`(${(f.pct*100).toFixed(0)}% — ${fmtA(f.areaAcum,0)}m² acum.)`}
                                  </span>
                                  <span style={{ color: f.unidade===1?"#10b981":"#a78bfa", fontWeight:600 }}>{fmt(f.precoUni)}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>}
                      {/* Total âncoras — sempre visível */}
                      {(r.repeticaoAncoras||[]).length > 0 && (
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginTop:8, paddingTop:8, borderTop:"1px solid #1e293b" }}>
                          <span style={{ color:"#e2e8f0", fontWeight:700, fontSize:12 }}>Total âncoras</span>
                          <span style={{ textAlign:"right" }}>
                            <span style={{ color:"#6366f1", fontWeight:800, fontSize:14 }}>{fmt(r.precoAncoras)}</span>
                            <span style={{ color:"#475569", fontSize:10, marginLeft:6 }}>
                              ({`R$ ${fmtA(r.precoAncoras / ((r.m2Anc1||1) * r.nAncoras))}/m²`})
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Apartamentos */}
                  {(r.nApartamentos||0) > 0 && (r.precoAptos||0) > 0 && (
                    <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:"14px 16px", borderTop:"3px solid #f59e0b" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                        <span style={{ color:"#f59e0b", fontWeight:700, fontSize:12, textTransform:"uppercase", letterSpacing:0.5 }}>
                          🏠 Apartamentos — {r.nApartamentos}x
                        </span>
                        <BtnExp k="apto" />
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                        {[
                          ["Área por apto",      fmtM2(r.m2Apto1)],
                          ["Área total aptos",   fmtM2((r.m2Apto1||0)*r.nApartamentos)],
                          ["Valor por apto",     fmt(r.precoApto1)],
                          ["R$/m² (apto)",       `R$ ${fmtA(r.precoM2Apto)}/m²`],
                        ].map(([l,v]) => (
                          <div key={l}>
                            <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:0.5 }}>{l}</div>
                            <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:14, marginTop:3 }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      {expandido.apto && <div style={{ marginTop:10, borderTop:"1px solid #1e293b", paddingTop:8 }}>
                        <div style={{ color:"#475569", fontSize:10, marginBottom:6, textTransform:"uppercase", letterSpacing:0.5 }}>Faixas — 1º apto (preço cheio)</div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                          {(r.detalheFaixasApto1||[]).map((f,i) => (
                            <div key={i} style={{ background:"#0f172a", borderRadius:6, padding:"4px 10px", fontSize:11 }}>
                              <span style={{ color:"#64748b" }}>{fmtA(f.de,0)}–{fmtA(f.ate,0)}m²</span>
                              {f.desconto > 0
                                ? <span style={{ color:"#f87171", marginLeft:4 }}>−{(f.desconto*100).toFixed(0)}%</span>
                                : <span style={{ color:"#4ade80", marginLeft:4 }}>cheio</span>}
                              <span style={{ color:"#94a3b8", marginLeft:6 }}>{fmt(f.preco)}</span>
                            </div>
                          ))}
                        </div>
                        {(r.repeticaoAptos||[]).length > 1 && (
                          <>
                            <div style={{ color:"#475569", fontSize:10, margin:"8px 0 6px", textTransform:"uppercase", letterSpacing:0.5 }}>Repetição de apartamentos</div>
                            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                              {(r.repeticaoAptos||[]).map((f,i) => (
                                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                                  <span style={{ color: f.unidade===1?"#4ade80":"#475569" }}>
                                    Apto {f.unidade} {f.unidade===1?"(cheio)":`(${(f.pct*100).toFixed(0)}% — ${fmtA(f.areaAcum,0)}m² acum.)`}
                                  </span>
                                  <span style={{ color: f.unidade===1?"#10b981":"#fbbf24", fontWeight:600 }}>{fmt(f.precoUni)}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>}
                      {/* Total aptos — sempre visível */}
                      {(r.repeticaoAptos||[]).length > 0 && (
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginTop:8, paddingTop:8, borderTop:"1px solid #1e293b" }}>
                          <span style={{ color:"#e2e8f0", fontWeight:700, fontSize:12 }}>Total apartamentos</span>
                          <span style={{ textAlign:"right" }}>
                            <span style={{ color:"#f59e0b", fontWeight:800, fontSize:14 }}>{fmt(r.precoAptos)}</span>
                            <span style={{ color:"#475569", fontSize:10, marginLeft:6 }}>
                              ({`R$ ${fmtA(r.precoAptos / ((r.m2Apto1||1) * r.nApartamentos))}/m²`})
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Galpoes */}
                  {(r.nGalpoes||0) > 0 && (r.precoGalpoes||0) > 0 && (
                    <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:"14px 16px", borderTop:"3px solid #64748b" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                        <span style={{ color:"#94a3b8", fontWeight:700, fontSize:12, textTransform:"uppercase", letterSpacing:0.5 }}>
                          🏭 {r.nGalpoes===1?"Galpão":"Galpões"} — {r.nGalpoes}x
                        </span>
                        <BtnExp k="galpao" />
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                        {[
                          ["Área por galpão",    fmtM2(r.m2Galpao1)],
                          ["Área total galpões", fmtM2((r.m2Galpao1||0)*r.nGalpoes)],
                          ["Valor por galpão",   fmt(r.precoGalpao1)],
                          ["R$/m² (galpão)",     `R$ ${fmtA(r.precoM2Galpao)}/m²`],
                        ].map(([l,v]) => (
                          <div key={l}>
                            <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:0.5 }}>{l}</div>
                            <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:14, marginTop:3 }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      {expandido.galpao && <div style={{ marginTop:10, borderTop:"1px solid #1e293b", paddingTop:8 }}>
                        <div style={{ color:"#475569", fontSize:10, marginBottom:6, textTransform:"uppercase", letterSpacing:0.5 }}>Faixas — 1º galpão (preço cheio)</div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                          {(r.detalheFaixasGalpao1||[]).map((f,i) => (
                            <div key={i} style={{ background:"#0f172a", borderRadius:6, padding:"4px 10px", fontSize:11 }}>
                              <span style={{ color:"#64748b" }}>{fmtA(f.de,0)}–{fmtA(f.ate,0)}m²</span>
                              {f.desconto > 0
                                ? <span style={{ color:"#f87171", marginLeft:4 }}>−{(f.desconto*100).toFixed(0)}%</span>
                                : <span style={{ color:"#4ade80", marginLeft:4 }}>cheio</span>}
                              <span style={{ color:"#94a3b8", marginLeft:6 }}>{fmt(f.preco)}</span>
                            </div>
                          ))}
                        </div>
                        {(r.repeticaoGalpoes||[]).length > 1 && (
                          <>
                            <div style={{ color:"#475569", fontSize:10, margin:"8px 0 6px", textTransform:"uppercase", letterSpacing:0.5 }}>Repetição de galpões</div>
                            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                              {(r.repeticaoGalpoes||[]).map((f,i) => (
                                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                                  <span style={{ color: f.unidade===1?"#4ade80":"#475569" }}>
                                    Galpão {f.unidade} {f.unidade===1?"(cheio)":`(${(f.pct*100).toFixed(0)}% — ${fmtA(f.areaAcum,0)}m² acum.)`}
                                  </span>
                                  <span style={{ color: f.unidade===1?"#10b981":"#94a3b8", fontWeight:600 }}>{fmt(f.precoUni)}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>}
                      {(r.repeticaoGalpoes||[]).length > 0 && (
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginTop:8, paddingTop:8, borderTop:"1px solid #1e293b" }}>
                          <span style={{ color:"#e2e8f0", fontWeight:700, fontSize:12 }}>Total galpões</span>
                          <span style={{ textAlign:"right" }}>
                            <span style={{ color:"#94a3b8", fontWeight:800, fontSize:14 }}>{fmt(r.precoGalpoes)}</span>
                            <span style={{ color:"#475569", fontSize:10, marginLeft:6 }}>
                              ({`R$ ${fmtA(r.precoGalpoes / ((r.m2Galpao1||1) * r.nGalpoes))}/m²`})
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Fachada + Áreas Comuns */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:"12px 16px", borderTop:"3px solid #475569" }}>
                      <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:0.5 }}>Áreas Comuns</div>
                      <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:14, marginTop:3 }}>{fmt(r.precoComum)}</div>
                    </div>
                    <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:"12px 16px", borderTop:"3px solid #f59e0b" }}>
                      <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:0.5 }}>🏗 Fachada (+{((r.indiceFachada||0)*100).toFixed(0)}%)</div>
                      <div style={{ color:"#f59e0b", fontWeight:700, fontSize:14, marginTop:3 }}>{fmt(r.precoFachada)}</div>
                    </div>
                  </div>

                </div>
              )}

              {temRepet && incluiArq && (
                <div style={{ background:"rgba(245,158,11,0.08)", border:"1px solid #f59e0b40", borderRadius:8, padding:"8px 14px", display:"flex", gap:24, alignItems:"center" }}>
                  <span style={{ color:"#f59e0b", fontSize:11, fontWeight:700 }}>🔁 {nUnid} unidades</span>
                  <span style={{ color:"#64748b", fontSize:11 }}>1ª unidade: {fmt((r.precoFinal||0) + engTotal)}</span>
                  <span style={{ color:"#64748b", fontSize:11 }}>Demais unidades: {fmt(arqTotal - (r.precoFinal||0) + engTotalRepet - engTotal)}</span>
                  <span style={{ color:"#f59e0b", fontWeight:800, fontSize:13, marginLeft:"auto" }}>Total: {fmt(grandTotal)}</span>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16, alignItems:"stretch" }}>
        {/* LISTA DE CÔMODOS */}
        <div style={{ ...S.section, paddingBottom: expandido.tabela ? undefined : 0 }}>
          <div style={{ ...S.sectionTitle, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span>Composição dos Ambientes</span>
            <BtnExp k="tabela" />
          </div>
          {expandido.tabela && <table style={{ width:"100%", borderCollapse:"collapse", marginTop:12 }}>
            <thead>
              <tr>{["Cômodo","Qtd","Dimensões","Área Unit.","Área Útil","Índice"].map(h=>(
                <th key={h} style={S.th}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {(() => {
                const isGal = orc.tipo === "Comercial";
                const nomesLoja   = isGal ? new Set(Object.keys(COMODOS_GALERIA_LOJA))   : new Set();
                const nomesAncora = isGal ? new Set(Object.keys(COMODOS_GALERIA_ANCORA)) : new Set();
                const nomesComum  = isGal ? new Set(Object.keys(COMODOS_GALERIA_COMUM))  : new Set();
                const nomesAptoG  = isGal ? new Set(Object.keys(COMODOS_GALERIA_APTO))   : new Set();

                const getGrupo = nome => {
                  if (nomesLoja.has(nome))   return "loja";
                  if (nomesAncora.has(nome)) return "ancora";
                  if (nomesComum.has(nome))  return "comum";
                  if (nomesAptoG.has(nome))  return "apto";
                  return "outro";
                };

                // Cabeçalho de separação por grupo
                const SepRow = ({ cor, icone, label }) => (
                  <tr>
                    <td colSpan={6} style={{ padding:"10px 8px 4px", borderBottom:"none" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:cor, flexShrink:0 }} />
                        <span style={{ color:cor, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8 }}>
                          {icone} {label}
                        </span>
                      </div>
                    </td>
                  </tr>
                );

                let lastGrupo = null;
                const rows = [];

                comodosAtivos.forEach(c => {
                  const dados = (getComodosConfig(orc.tipo||"Residencial").comodos)[c.nome];
                  const [comp, larg] = dados?.medidas[orc.tamanho] || [0,0];
                  const areaUnit = comp * larg;
                  const areaTotal = areaUnit * c.qtd;
                  const grupo = getGrupo(c.nome);

                  if (isGal && grupo !== lastGrupo) {
                    lastGrupo = grupo;
                    if (grupo === "loja")   rows.push(<SepRow key="sep-loja"   cor="#3b82f6" icone="🏪" label="Ambientes Lojas" />);
                    if (grupo === "ancora") rows.push(<SepRow key="sep-ancora" cor="#6366f1" icone="🏬" label="Ambientes Espaços Âncoras" />);
                    if (grupo === "comum")  rows.push(<SepRow key="sep-comum"  cor="#10b981" icone="" label="Áreas Comuns" />);
                    if (grupo === "apto")   rows.push(<SepRow key="sep-apto"   cor="#f59e0b" icone="🏠" label="Ambientes Apartamentos" />);
                  }

                  rows.push(
                    <tr key={c.nome} style={{ borderBottom:"1px solid #0f172a" }}>
                      <td style={{ ...S.td, fontWeight:600, color:"#e2e8f0", paddingLeft: isGal ? 18 : undefined }}>{c.nome}</td>
                      <td style={{ ...S.td, textAlign:"center" }}>{c.qtd}</td>
                      <td style={S.td}>{comp}m × {larg}m</td>
                      <td style={S.td}>{fmtA(areaUnit)} m²</td>
                      <td style={{ ...S.td, color:"#60a5fa", fontWeight:600 }}>{fmtA(areaTotal)} m²</td>
                      <td style={{ ...S.td, color:"#f59e0b" }}>{fmtA(dados?.indice, 2)}</td>
                    </tr>
                  );
                });

                return rows;
              })()}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:"2px solid #1e293b" }}>
                <td colSpan={4} style={{ ...S.td, fontWeight:700, color:"#94a3b8" }}>Subtotal</td>
                <td style={{ ...S.td, color:"#3b82f6", fontWeight:800 }}>{fmtA(r.areaBruta)} m²</td>
                <td style={{ ...S.td, color:"#f59e0b", fontWeight:700 }}>{fmtA(r.indiceComodos||0, 3)}</td>
              </tr>
              <tr>
                <td colSpan={4} style={{ ...S.td, color:"#64748b", fontSize:12 }}>+ {getTipoConfig(orc.tipo).labelCirk}% (circulação/estrutura)</td>
                <td style={{ ...S.td, color:"#6366f1", fontWeight:800 }}>{fmtA(r.areaTotal)} m²</td>
                <td style={S.td}/>
              </tr>
            </tfoot>
          </table>}
        </div>

        {/* MEMÓRIA DE CÁLCULO */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={S.section}>
            <div style={{ ...S.sectionTitle, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span>Memória de Cálculo</span>
              <BtnExp k="memoria" />
            </div>
            <div style={{ display: expandido.memoria ? "flex" : "none", flexDirection:"column", gap:8, marginTop:12 }}>
              {[
                ["Preço Base", `R$ ${orc.precoBase}/m²${r.padrao === "Baixo" ? " (−20% padrão Baixo → R$ " + fmtA(parseFloat(orc.precoBase)*0.8) + ")" : ""}`, "#94a3b8"],
                ["Área Útil", fmtM2(r.areaBruta), "#3b82f6"],
                ["Área Total (+25%)", fmtM2(r.areaTotal), "#60a5fa"],
                ...(r.tipo !== "Galeria" ? [
                  ["Índice Cômodos", fmtA(r.indiceComodos ?? 0, 3), "#f59e0b"],
                  ["Índice Padrão",  fmtA(r.indicePadrao  ?? 0, 2), "#f59e0b"],
                  ["Fator Total",    `× ${fmtA(r.fator||1, 3)}`,    "#fbbf24"],
                ] : [
                  ["Fator Lojas",   `× ${fmtA(r.fatorLoja||1, 3)}`,  "#f59e0b"],
                  ["Fator Âncoras", (r.nAncoras > 0 && (r.precoAncoras||0) > 0) ? `× ${fmtA(r.fatorAnc||1, 3)}` : "—", "#f59e0b"],
                  ["Fator Aptos",   (r.nApartamentos > 0 && (r.precoAptos||0) > 0) ? `× ${fmtA(r.fatorApto||1, 3)}` : "—", "#f59e0b"],
                ]),
              ].map(([l,v,c]) => v !== undefined && (
                <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #0f172a" }}>
                  <span style={{ color:"#64748b", fontSize:12 }}>{l}</span>
                  <span style={{ color:c, fontWeight:600, fontSize:13 }}>{v}</span>
                </div>
              ))}

              {/* Faixas Arquitetura — expansivel */}
              <div style={{ marginTop:8, border:"1px solid #1e293b", borderRadius:8, overflow:"hidden" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"8px 12px", background:"#0a1122", cursor:"pointer" }}
                  onClick={() => toggleExp("arq")}>
                  <span style={{ color:"#475569", fontSize:10, textTransform:"uppercase", letterSpacing:1 }}>Desconto progressivo — Arquitetura</span>
                  <BtnExp k="arq" />
                </div>
                {expandido.arq && (
                  <div style={{ padding:"8px 12px" }}>
                    {(r.detalheFaixas||[]).map((f,i) => (
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, padding:"4px 0", borderBottom:"1px solid #0f172a" }}>
                        <span style={{ color:"#475569" }}>
                          {fmtA(f.de,0)}–{fmtA(f.ate,0)} m²
                          {f.desconto > 0
                            ? <span style={{ color:"#f87171" }}> (–{(f.desconto*100).toFixed(0)}%)</span>
                            : <span style={{ color:"#4ade80" }}> (cheio)</span>}
                        </span>
                        <span style={{ color:"#10b981", fontWeight:600 }}>{fmt(f.preco)}</span>
                      </div>
                    ))}
                    {/* Repetição dentro do expansivel Arq */}
                    {r.nUnidades > 1 && (r.repeticaoFaixas||[]).length > 0 && (
                      <div style={{ marginTop:8, paddingTop:8, borderTop:"1px solid #1e293b" }}>
                        <div style={{ color:"#475569", fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Repeticao — {r.nUnidades} unidades</div>
                        {(r.repeticaoFaixas||[]).map((f,i) => (
                          <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, padding:"4px 0", borderBottom:"1px solid #0f172a" }}>
                            <span style={{ color:"#475569" }}>Unid. {f.unidade} ({(f.pct*100).toFixed(0)}% — {fmtA(f.areaAcum,0)}m² acum.)</span>
                            <span style={{ color:"#a78bfa", fontWeight:600 }}>{fmt(f.precoUni)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Valor unidade 1 */}
              <div style={{ background:"#0f172a", borderRadius:8, padding:12, marginTop:8, textAlign:"center" }}>
                <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:1 }}>{r.nUnidades > 1 ? "1a Unidade — Arquitetura" : "Valor do Projeto"}</div>
                <div style={{ color:"#f59e0b", fontWeight:900, fontSize:20, marginTop:4 }}>
                  {fmt(r.precoFinal)}
                </div>
                <div style={{ color:"#64748b", fontSize:11, marginTop:4 }}>
                  {r.areaTotal > 0 ? `R$ ${fmtA(r.precoFinal / r.areaTotal)}/m² · ${fmtM2(r.areaTotal)}` : ""}
                </div>
              </div>

              {/* Total com repeticao */}
              {r.nUnidades > 1 && (
                <div style={{ background:"#0f172a", borderRadius:8, padding:12, marginTop:8, textAlign:"center" }}>
                  <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:1 }}>Total {r.nUnidades} unidades — Arquitetura</div>
                  <div style={{ color:"#a78bfa", fontWeight:900, fontSize:20, marginTop:4 }}>
                    {fmt(r.precoTotal)}
                  </div>
                  <div style={{ color:"#64748b", fontSize:11, marginTop:4 }}>
                    {r.areaTotal > 0 ? `R$ ${fmtA((r.precoTotal||0) / (r.areaTotal * r.nUnidades))} /m² (media) · ${fmtM2(r.areaTotal * r.nUnidades)} total` : ""}
                  </div>
                </div>
              )}
            </div>
          </div>


        </div>
      </div>

      <div style={{ display: incluiEng ? undefined : "none" }}>
      {/* PROJETOS DE ENGENHARIA */}
      {(() => {
        const areaTotal = r.areaTotal || 0;
        const precoEng = 50;
        const nUnid = r.nUnidades || 1;
        // Usa engTotal salvo — mesma fonte dos KPIs
        const { faixas: engFaixas, precoM2Efetivo: engPrecoM2Ef } = calcularEngenharia(areaTotal, precoEng);
        const totalEng = _engRaw;
        // Repeticao: usa faixas salvas se existir
        let engRepet = 0;
        const engRepetFaixas = [];
        if (nUnid > 1) {
          if ((r.repeticaoFaixas||[]).length > 0) {
            let areaAcum = areaTotal;
            for (let i = 2; i <= nUnid; i++) {
              const pct = getTipoConfig(r.tipo).repeticaoPcts(areaAcum);
              const val = totalEng * pct;
              engRepetFaixas.push({ unidade: i, areaAcum, pct, val });
              engRepet += val;
              areaAcum += areaTotal;
            }
          } else {
            let areaAcum = areaTotal;
            for (let i = 2; i <= nUnid; i++) {
              const pct = getTipoConfig(r.tipo).repeticaoPcts(areaAcum);
              const val = totalEng * pct;
              engRepetFaixas.push({ unidade: i, areaAcum, pct, val });
              engRepet += val;
              areaAcum += areaTotal;
            }
          }
        }
        const engTotalRepet = _engRep;
        const arqTotal = _arqBase;
        const grandTotal = Math.round((arqTotal + engTotalRepet) * 100) / 100;
        const projetos = [
          { key:"estrutural", icon:"🏗", label:"Projeto Estrutural",     descricao:"Dimensionamento de fundações, vigas, pilares e lajes",     pct:0.50 },
          { key:"eletrico",   icon:"⚡", label:"Projeto Elétrico",        descricao:"Instalações elétricas, quadros, pontos de iluminação",      pct:0.25 },
          { key:"hidro",      icon:"🔧", label:"Projeto Hidrossanitário", descricao:"Instalações hidráulicas, esgoto, água fria e quente",       pct:0.25 },
        ];
        return (
          <div style={{ ...S.section, marginTop:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div>
                <div style={S.sectionTitle}>🔩 Projetos de Engenharia</div>
                <div style={{ color:"#475569", fontSize:12, marginTop:2 }}>
                  R$ {precoEng}/m² base com desconto progressivo — inclui Estrutural, Elétrico e Hidrossanitário
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ color:"#64748b", fontSize:11 }}>{nUnid > 1 ? `Total Eng. (${nUnid} unid.)` : "Total Engenharia"}</div>
                <div style={{ color:"#a78bfa", fontWeight:900, fontSize:22 }}>{fmt(engTotalRepet)}</div>
                {nUnid > 1 && <div style={{ color:"#64748b", fontSize:11, marginTop:2 }}>1ª unid.: {fmt(totalEng)}</div>}
              </div>
            </div>

            {/* Cards 50/25/25 */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
              {projetos.map(p => (
                <div key={p.key} style={{ background:"#0f172a", border:"1px solid #2d1b69", borderRadius:10, padding:"16px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                    <span style={{ fontSize:22 }}>{p.icon}</span>
                    <span style={{ color:"#e2e8f0", fontWeight:700, fontSize:13 }}>{p.label}</span>
                  </div>
                  <div style={{ color:"#475569", fontSize:11, lineHeight:1.5 }}>{p.descricao}</div>
                  <div style={{ color:"#a78bfa", fontWeight:700, fontSize:13, marginTop:8 }}>{fmt(engTotalRepet * p.pct)}</div>
                  {nUnid > 1 && <div style={{ color:"#64748b", fontSize:11, marginTop:2 }}>1ª unid.: {fmt(totalEng * p.pct)}</div>}
                  <div style={{ color:"#475569", fontSize:10, marginTop:4 }}>{fmtA(p.pct*100,0)}% do total</div>
                </div>
              ))}
            </div>

            {/* Faixas da 1ª unidade + Repetição Eng — expansivel */}
            <div style={{ background:"#0a1222", border:"1px solid #1e293b", borderRadius:10, padding:"14px 18px", marginTop:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <span style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>
                  Desconto progressivo — Engenharia{nUnid > 1 ? ` (${nUnid} unidades)` : " (1a unidade)"}
                </span>
                <BtnExp k="eng" />
              </div>
              {expandido.eng && <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <div style={{ color:"#475569", fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>1a Unidade</div>
                {engFaixas.map((f,i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"5px 0", borderBottom:"1px solid #0f172a" }}>
                    <span style={{ color:"#475569" }}>
                      {fmtA(f.de,0)}–{fmtA(f.ate,0)} m²
                      {f.desconto > 0
                        ? <span style={{ color:"#f87171", marginLeft:8 }}>–{fmtA(f.desconto,1)}% acum.</span>
                        : <span style={{ color:"#4ade80", marginLeft:8 }}>preco cheio</span>}
                    </span>
                    <span style={{ display:"flex", gap:16 }}>
                      <span style={{ color:"#475569" }}>{fmtA(f.area,1)} m² × R$ {fmtA(precoEng * f.fator)}/m²</span>
                      <span style={{ color:"#a78bfa", fontWeight:600 }}>{fmt(f.preco)}</span>
                    </span>
                  </div>
                ))}
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, paddingTop:8, borderTop:"1px solid #1e293b" }}>
                  <span style={{ color:"#94a3b8", fontSize:12 }}>Preco medio efetivo (1a unid.)</span>
                  <span style={{ color:"#a78bfa", fontWeight:700 }}>R$ {fmtA(engPrecoM2Ef)}/m²</span>
                </div>
                {/* Repetição Eng dentro do expansivel */}
                {nUnid > 1 && (
                  <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #4c1d95" }}>
                    <div style={{ color:"#a78bfa", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>
                      Repeticao — {nUnid} unidades
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"5px 0", borderBottom:"1px solid #0f172a" }}>
                      <span style={{ color:"#4ade80" }}>Unidade 1 (cheio)</span>
                      <span style={{ color:"#a78bfa", fontWeight:600 }}>{fmt(totalEng)}</span>
                    </div>
                    {engRepetFaixas.map((f,i) => (
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"5px 0", borderBottom:"1px solid #0f172a" }}>
                        <span style={{ color:"#475569" }}>Unid. {f.unidade} ({(f.pct*100).toFixed(0)}% — {fmtA(f.areaAcum,0)}m² acum.)</span>
                        <span style={{ color:"#a78bfa", fontWeight:600 }}>{fmt(f.val)}</span>
                      </div>
                    ))}
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, paddingTop:8, borderTop:"1px solid #4c1d95", fontWeight:700 }}>
                      <span style={{ color:"#e2e8f0" }}>Total Engenharia ({nUnid} unid.)</span>
                      <span style={{ color:"#a78bfa", fontSize:16 }}>{fmt(engTotalRepet)}</span>
                    </div>
                  </div>
                )}
              </div>}
            </div>

            <div style={{ background:"linear-gradient(135deg,#1a0b3c,#0d1526)", border:"1px solid #4c1d95", borderRadius:10, padding:"16px 20px", marginTop:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ color:"#a78bfa", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>Total Pacote Completo</div>
                <div style={{ color:"#64748b", fontSize:12, marginTop:2 }}>
                  Arquitetura + Engenharia{nUnid > 1 ? ` · ${nUnid} unidades` : " · pacote 3 projetos"}
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ color:"#475569", fontSize:12 }}>{fmt(arqTotal)} + {fmt(engTotalRepet)}</div>
                <div style={{ color:"#f59e0b", fontWeight:900, fontSize:26, letterSpacing:-1 }}>
                  {fmt(grandTotal)}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      </div>
      {/* PROPOSTA COMERCIAL */}
      <PropostaComercial orc={orc} fmt={fmt} fmtM2={fmtM2} incluiArq={incluiArq} incluiEng={incluiEng} />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// BOTÃO GERAR PDF
// ═══════════════════════════════════════════════════════════════
async function buildPdf(orc, logo=null, modeloPdf=null, corTema=null, bgLogo="#ffffff", incluiArq=true, incluiEng=true) {
  const { jsPDF } = window.jspdf;

  // ── Dados base ─────────────────────────────────────────────
  const r       = orc.resultado || {};
  const area    = r.areaTotal || 0;
  const nUnid   = r.nUnidades || 1;

  // Imposto
  const temImp  = r.impostoAplicado && (r.aliquotaImposto||0) > 0;
  const aliqImp = r.aliquotaImposto || 0;
  const semFat  = temImp ? (1 - aliqImp/100) : 1;

  // Arq e Eng COM imposto (igual preview)
  const arqCI   = temImp ? Math.round((r.precoTotal||r.precoFinal||0)*100)/100
                         : Math.round((r.precoTotal||r.precoFinal||0)*100)/100;
  const engRaw  = Math.round((r.engTotal ?? calcularEngenharia(area).totalEng)*100)/100;
  let engRepet  = 0;
  if (nUnid > 1) {
    let ac = area;
    for (let i = 2; i <= nUnid; i++) {
      const pct = getTipoConfig(orc.tipo).repeticaoPcts(ac);
      engRepet += engRaw * pct; ac += area;
    }
  }
  const engBase = Math.round((engRaw + engRepet)*100)/100;
  const engCI   = temImp ? Math.round(engBase/semFat*100)/100 : engBase;
  const totSI   = Math.round((arqCI*semFat + engCI*semFat)*100)/100;
  const impostoV= temImp ? Math.round((arqCI+engCI - totSI)*100)/100 : 0;
  const totCI   = Math.round((arqCI + engCI)*100)/100;

  // Escopo (igual preview)
  const escopoDefault = [
    { titulo:"1. Estudo de Viabilidade", objetivo:"Analisar o potencial construtivo do terreno e verificar a viabilidade de implantação do empreendimento, considerando as condicionantes físicas, urbanísticas, legais e funcionais aplicáveis ao lote.", itens:["Levantamento inicial e consolidação das informações técnicas do terreno","Análise documental e física do lote, incluindo matrícula, dimensões, topografia e características existentes","Consulta e interpretação dos parâmetros urbanísticos e restrições legais aplicáveis","Verificação da viabilidade construtiva, considerando taxa de ocupação, coeficiente de aproveitamento, recuos obrigatórios, gabarito de altura e demais condicionantes normativas","Estimativa preliminar da área edificável e do potencial de aproveitamento do terreno","Avaliação da melhor ocupação do lote, alinhada ao programa de necessidades do cliente","Definição preliminar da implantação, organização dos acessos, fluxos, circulação, áreas livres e áreas construídas","Estudo de volumetria, análise de inserção no entorno e definição de pontos focais que contribuam para a valorização do empreendimento","Dimensionamento preliminar de estacionamentos, fluxos operacionais e viabilidade de circulação para veículos leves e pesados"], entregaveis:["Estudo técnico de ocupação do terreno, com planta de implantação e setorização preliminar","Esquema conceitual de implantação, incluindo diagramas de organização espacial, acessos e condicionantes do entorno","Representações gráficas, estudo volumétrico em 3D e imagens conceituais","Relatório sintético de viabilidade construtiva, contemplando memorial descritivo, quadro de áreas e síntese dos parâmetros urbanísticos aplicáveis"], obs:"Esta etapa tem como objetivo reduzir riscos e antecipar decisões estratégicas antes do desenvolvimento do projeto, permitindo validar a compatibilidade da proposta com o terreno, com a legislação municipal e com os objetivos do empreendimento." },
    { titulo:"2. Estudo Preliminar", objetivo:"Desenvolver o conceito arquitetônico inicial, organizando os ambientes, a implantação e a linguagem estética do projeto.", itens:["Reunião de briefing e entendimento das necessidades do cliente","Definição do programa de necessidades","Estudo de implantação da edificação no terreno","Desenvolvimento da concepção arquitetônica inicial","Definição preliminar de: layout, fluxos, volumetria, setorização e linguagem estética","Compatibilização entre funcionalidade, conforto, estética e viabilidade construtiva","Ajustes conforme alinhamento com o cliente"], entregaveis:["Planta baixa preliminar","Estudo volumétrico / fachada conceitual","Implantação inicial","Imagens, croquis ou perspectivas conceituais","Apresentação para validação do conceito arquitetônico"], obs:"É nesta etapa que o projeto ganha forma. O estudo preliminar define a essência da proposta e orienta todas as fases seguintes." },
    { titulo:"3. Aprovação na Prefeitura", objetivo:"Adequar e preparar o projeto arquitetônico para protocolo e aprovação junto aos órgãos públicos competentes.", itens:["Adequação do projeto às exigências legais e urbanísticas do município","Elaboração dos desenhos técnicos exigidos para aprovação","Montagem da documentação técnica necessária ao processo","Inserção de informações obrigatórias conforme normas municipais","Preparação de pranchas, quadros de áreas e demais peças gráficas","Apoio técnico durante o processo de aprovação","Atendimento a eventuais comunique-se ou exigências técnicas da prefeitura"], entregaveis:["Projeto legal para aprovação","Plantas, cortes, fachadas e implantação conforme exigência municipal","Quadros de áreas","Arquivos e documentação técnica para protocolo"], obs:"Não inclusos nesta etapa: taxas municipais, emolumentos, ART/RRT, levantamentos complementares, certidões e exigências extraordinárias de órgãos externos, salvo se expressamente previsto." },
    { titulo:"4. Projeto Executivo", objetivo:"Desenvolver o projeto arquitetônico em nível detalhado para execução da obra, fornecendo todas as informações necessárias para construção com precisão.", itens:["Desenvolvimento técnico completo do projeto aprovado","Detalhamento arquitetônico para obra","Definição precisa de: dimensões, níveis, cotas, eixos, paginações, esquadrias, acabamentos e elementos construtivos","Elaboração de desenhos técnicos executivos","Compatibilização arquitetônica com premissas de obra","Apoio técnico para leitura e entendimento do projeto pela equipe executora"], entregaveis:["Planta baixa executiva","Planta de locação e implantação","Planta de cobertura","Cortes e fachadas executivos","Planta de layout e pontos arquitetônicos","Planta de esquadrias e pisos","Detalhamentos construtivos","Quadro de esquadrias e quadro de áreas final"], obs:"É a etapa que transforma a ideia em construção real. Um bom projeto executivo reduz improvisos, retrabalhos e falhas de execução na obra." },
    { titulo:"5. Projetos Complementares de Engenharia", objetivo:"", itens:["Estrutural: lançamento, dimensionamento de vigas, pilares, lajes e fundações","Elétrico: dimensionamento de cargas, circuitos, quadros e pontos","Hidrossanitário: distribuição de pontos de água fria/quente, esgoto e dimensionamento","Compatibilização entre projetos arquitetônico e de engenharia para verificar possíveis interferências"], entregaveis:[], obs:"Obs.: Este item poderá ser contratado diretamente pelo cliente junto a engenheiros terceiros, ficando a compatibilização sob responsabilidade dos profissionais contratados." },
  ];

  const naoInclDefault = [
    "Taxas municipais, emolumentos e registros (CAU/Prefeitura)",
    "Projetos de climatização","Projeto de prevenção de incêndio","Projeto de automação",
    "Projeto de paisagismo","Projeto de interiores","Projeto de Marcenaria (Móveis internos)",
    "Projeto estrutural de estruturas metálicas",
    "Projeto estrutural para muros de contenção (arrimo) acima de 1 m de altura",
    "Sondagem e Planialtimétrico do terreno","Acompanhamento semanal de obra",
    "Gestão e execução de obra","Vistoria para Caixa Econômica Federal","RRT de Execução de obra",
    ...(!temImp ? ["Impostos"] : []),
  ];

  const isPadrao = (orc.tipoPagamento || "padrao") !== "etapas";
  const prazoDefault = isPadrao
    ? ["Prazo estimado para entrega do Projeto Arquitetônico: 30 dias úteis após aprovação do estudo preliminar.",
       "Prazo estimado para entrega dos Projetos de Engenharia: 30 dias úteis após aprovação na prefeitura."]
    : ["Prazo de 30 dias úteis por etapa, contados após conclusão e aprovação de cada etapa pelo cliente.",
       "Concluída e aprovada cada etapa, inicia-se automaticamente o prazo da etapa seguinte.",
       "Projetos de Engenharia: 30 dias úteis após aprovação do projeto na Prefeitura."];

  const etapasPdf = orc.etapasPct || [];

  // ── jsPDF setup ────────────────────────────────────────────
  const doc = new jsPDF({ unit:"mm", format:"a4" });
  const W=210, H=297, M=20, TW=W-2*M;
  let y = 12;

  // Helpers
  const sf  = (s,z) => { doc.setFont("helvetica",s); doc.setFontSize(z); };
  const stc = (rgb) => doc.setTextColor(...rgb);
  const sc  = (rgb,t="fill") => t==="fill" ? doc.setFillColor(...rgb) : doc.setDrawColor(...rgb);
  const tx  = (t,x,yy,o={}) => doc.text(String(t),x,yy,o);
  const hr  = (yy,x0=M,x1=W-M,w=0.3,col=[229,231,235]) => { sc(col,"draw"); doc.setLineWidth(w); doc.line(x0,yy,x1,yy); };
  const fmtB = v => "R$ "+v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtN = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});

  const INK   = [17,24,39];
  const INK_MD= [107,114,128];
  const INK_LT= [156,163,175];
  const LINE  = [229,231,235];
  const BG    = [249,250,251];

  const esc = { nome:"Padovan Arquitetos", tel:"(14) 99767-4200", email:"leopadovan.arq@gmail.com", social:"@padovan_arquitetos" };
  const hoje = new Date(orc.criadoEm || Date.now());
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const dataStr  = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
  const validade = new Date(hoje.getTime()+15*86400000).toLocaleDateString("pt-BR");

  // Nova página
  const novaPg = () => {
    doc.addPage(); y = 12;
    sc(INK); doc.rect(M,6,TW,0.5,"F");
    sf("bold",8); stc(INK); tx(esc.nome,M,12);
    sf("normal",7.5); stc(INK_LT); tx(`Proposta Comercial  ·  ${orc.cliente||""}`,W-M,12,{align:"right"});
    hr(16); y=22;
  };
  const nv = (h) => { if (y+h > H-18) novaPg(); };

  // Título de seção (label uppercase + linha horizontal — igual preview)
  const secTitle = (txt, mt=10) => {
    nv(12);
    y += mt;
    sf("bold",7.5); stc(INK_LT); tx(txt.toUpperCase(),M,y);
    const tw = doc.getTextWidth(txt.toUpperCase());
    sc(LINE,"draw"); doc.setLineWidth(0.3); doc.line(M+tw+4,y-1,W-M,y-1);
    y += 7;
  };

  // Bullet item
  const bullet = (txt, x=M+3, maxW=TW-6) => {
    sf("normal",8.5); stc(INK_MD);
    const ls = doc.splitTextToSize(txt, maxW-5);
    nv(ls.length*5+2);
    sf("normal",8.5); stc(INK_MD);
    tx("•", x, y);
    ls.forEach((ln,i) => tx(ln, x+4, y+i*5));
    y += ls.length*5+1;
  };

  // ── LINHA DECORATIVA TOPO ───────────────────────────────────
  sc(INK); doc.rect(M,6,TW,0.5,"F");

  // ── LOGO ───────────────────────────────────────────────────
  let logoData = null;
  try { const lr = await window.storage.get("escritorio-logo"); if (lr?.value) logoData = lr.value; } catch {}
  {
    const qX=M, qY=8, qR=3;
    if (logoData) {
      await new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          const maxH=22, maxW=60;
          const ratio = Math.min(maxW/img.naturalWidth, maxH/img.naturalHeight);
          const qW=img.naturalWidth*ratio, qH=img.naturalHeight*ratio;
          sc(INK); doc.roundedRect(qX,qY,qW,qH,qR,qR,"F");
          doc.addImage(logoData, logoData.startsWith("data:image/png")?"PNG":"JPEG", qX,qY,qW,qH,undefined,"FAST");
          y = qY+qH+3; resolve();
        };
        img.onerror = () => resolve();
        img.src = logoData;
      });
    } else {
      const qs=26;
      sc(INK); doc.roundedRect(qX,qY,qs,qs,qR,qR,"F");
      sf("bold",6.5); stc([255,255,255]);
      tx("PADOVAN",qX+qs/2,qY+qs/2-1,{align:"center"});
      tx("ARQUITETOS",qX+qs/2,qY+qs/2+4,{align:"center"});
      y = qY+qs+3;
    }
  }

  // Data + validade direita
  sf("normal",7.5); stc(INK_LT);
  tx(`Ourinhos, ${dataStr}  ·  Válido até ${validade}`, W-M, y, {align:"right"});
  hr(y+3);

  // Nome cliente + Arq à direita (label inline + valor)
  y += 10;
  sf("bold",16); stc(INK); tx(orc.cliente||"—", M, y);
  // Valor bold
  sf("bold",12); stc(INK); tx(fmtB(arqCI), W-M, y+1, {align:"right"});
  // Label "Apenas Arquitetura" cinza pequeno à esquerda do valor
  const wArqVal = doc.getTextWidth(fmtB(arqCI));
  sf("normal",6.5); stc(INK_LT); tx("Apenas Arquitetura", W-M-wArqVal-3, y+1, {align:"right"});
  // R$/m² abaixo mais próximo
  if (area>0) { sf("normal",6.5); stc(INK_LT); tx(`R$ ${fmtN(Math.round(arqCI/area*100)/100)}/m²`, W-M, y+6, {align:"right"}); }

  // "Proposta Comercial..." abaixo do nome
  y += 7;
  sf("normal",7); stc(INK_LT);
  tx("Proposta Comercial de Projetos de Arquitetura e Engenharia", M, y);

  // Linha dupla separadora
  y += 6;
  sc(INK); doc.rect(M,y,TW,0.5,"F");
  y += 5;

  // Resumo descritivo (gerado pelo defaultModelo)
  const resumoPdf = modeloPdf?.cliente?.resumo || "";
  if (resumoPdf) {
    sf("normal",8.5); stc(INK_LT);
    const ls = doc.splitTextToSize(resumoPdf, TW);
    ls.forEach(ln => { nv(5); tx(ln,M,y); y+=4.5; }); y+=2;
  }

  // ── VALORES DOS PROJETOS ───────────────────────────────────
  secTitle("Valores dos projetos", 4);

  const midX = M + TW/2;
  const colH = 22;
  nv(colH+4);

  // Coluna ARQ
  sf("bold",7); stc(INK_LT); tx("ARQUITETURA", M, y);
  sf("bold",11); stc(INK); tx(fmtB(arqCI), M, y+7);
  if(area>0){ sf("normal",6.5); stc(INK_LT); tx(`R$ ${fmtN(Math.round(arqCI/area*100)/100)}/m²`, M, y+12); }

  // Divisor vertical
  sc(LINE,"draw"); doc.setLineWidth(0.3); doc.line(midX, y-1, midX, y+colH);

  // Coluna ENG
  sf("bold",7); stc(INK_LT); tx("ENGENHARIA", midX+4, y);
  const wEng = doc.getTextWidth("ENGENHARIA");
  sf("normal",6); stc(INK_LT); tx("(Opcional)", midX+4+wEng+2, y);
  sf("bold",11); stc(INK); tx(fmtB(engCI), midX+4, y+7);
  sf("normal",6.5); stc(INK_LT);
  tx("Estrutural · Elétrico · Hidrossanitário", midX+4, y+12);
  if(area>0) tx(`R$ ${fmtN(Math.round(engCI/area*100)/100)}/m²`, midX+4, y+16);

  y += colH+2;

  // Quadro cinza — sempre visível
  nv(12);
  sc(BG); doc.roundedRect(M,y,TW,8,2,2,"F");
  sf("normal",7); stc(INK_LT);
  if (temImp) {
    const itxt = `+ Impostos — ${fmtB(impostoV)}   ·   Total com impostos — `;
    tx(itxt, M+4, y+5.5);
    const itw = doc.getTextWidth(itxt);
    sf("bold",7.5); stc(INK); tx(fmtB(totCI), M+4+itw, y+5.5);
  } else {
    tx("Total sem impostos — ", M+4, y+5.5);
    const itw2 = doc.getTextWidth("Total sem impostos — ");
    sf("bold",7.5); stc(INK); tx(fmtB(totCI), M+4+itw2, y+5.5);
  }
  y += 12;

  // ── CONTRATAÇÃO / FORMAS DE PAGAMENTO ─────────────────────
  secTitle(isPadrao ? "Formas de pagamento" : "Contratação por etapa");

  if (!isPadrao && etapasPdf.length > 0) {
    // Tabela de etapas
    nv(14);
    const cE=M, cP=W-M-45, cV=W-M, rH=8;
    sf("bold",7.5); stc(INK);
    tx("ETAPA",cE,y); tx("%",cP,y,{align:"right"}); tx("VALOR",cV,y,{align:"right"});
    y+=2; sc(INK); doc.rect(M,y,TW,0.5,"F"); y+=rH-1;

    etapasPdf.forEach(et => {
      nv(rH+3);
      sf("normal",8.5); stc(INK_MD); tx(et.nome||"",cE,y);
      sf("normal",8.5); stc(INK_LT); tx(`${et.pct}%`,cP,y,{align:"right"});
      sf("normal",8.5); stc(INK); tx(fmtB(Math.round(totCI*(et.pct/100)*100)/100),cV,y,{align:"right"});
      y+=1.5; sc(LINE); doc.rect(M,y,TW,0.3,"F"); y+=rH-1;
    });

    // Linha Engenharia
    nv(rH+5);
    sf("normal",8.5); stc(INK_MD); tx("Projetos de Engenharia",cE,y);
    sf("normal",6.5); stc(INK_LT); tx("Estrutural  ·  Elétrico  ·  Hidrossanitário",cE,y+4);
    sf("normal",8.5); stc(INK_LT); tx("—",cP,y+2,{align:"right"});
    sf("normal",8.5); stc(INK); tx(fmtB(engCI),cV,y+2,{align:"right"});
    y+=6; sc(LINE); doc.rect(M,y,TW,0.3,"F"); y+=rH-1;

    // Total
    nv(10);
    y+=1; sc(INK); doc.rect(M,y-1,TW,0.5,"F"); y+=3;
    sf("bold",8.5); stc(INK);
    tx("Total",cE,y);
    tx(`${etapasPdf.reduce((s,e)=>s+Number(e.pct),0)}%`,cP,y,{align:"right"});
    tx(fmtB(totCI),cV,y,{align:"right"});
    y+=10;

    // Condições etapa a etapa — reservar espaço para todo o bloco
    const dEt = orc.descontoEtapaCtrt??5, pEt = orc.parcelasEtapaCtrt??2;
    y+=4;
    nv(75);
    secTitle("Forma de Pagamento");
    sf("bold",8.5); stc(INK); tx("Etapa a Etapa",M,y);
    sf("normal",6.5); stc(INK_LT); tx("Obs.: Nesta opção valores de etapas futuras podem ser reajustados.",W-M,y,{align:"right"});
    sf("normal",8.5); stc(INK_MD); y+=6;
    sf("normal",8.5); stc(INK_MD);
    tx(`Opção 1: Antecipado por etapa (${dEt}% de desconto)`,M+2,y); y+=7;
    tx(`Opção 2: Parcelado ${pEt}× por etapa`,M+2,y); hr(y+3); y+=10;

    // Pacote completo etapas
    const dPac=orc.descontoPacoteCtrt??15, pPac=orc.parcelasPacoteCtrt??8;
    const tDesc=Math.round(totCI*(1-dPac/100)*100)/100;
    sf("bold",8.5); stc(INK); tx("Pacote Completo (Arq. + Eng.)",M,y); y+=6;
    sf("normal",8.5); stc(INK_MD);
    tx(`De ${fmtB(totCI)} por apenas:`,M+2,y);
    sf("bold",9); stc(INK); tx(fmtB(tDesc),W-M,y,{align:"right"}); y+=5;
    sf("normal",7.5); stc(INK_LT);
    tx(`Desconto de ${fmtB(Math.round(totCI*dPac/100*100)/100)} (${dPac}%)  ·  Parcelado ${pPac}× de ${fmtB(Math.round(tDesc/pPac*100)/100)} c/ desconto`,M+2,y);
    hr(y+3); y+=9;

  } else {
    // Pagamento padrão — reservar espaço para todo o bloco
    const dA=orc.descontoEtapa??5, pA=orc.parcelasEtapa??3;
    nv(70);
    sf("bold",8.5); stc(INK); tx("Apenas Arquitetura",M,y); y+=6;
    sf("normal",8.5); stc(INK_MD);
    tx(`Antecipado (${dA}% de desconto) — ${fmtB(Math.round(arqCI*(1-dA/100)*100)/100)}`,M+2,y); hr(y+3); y+=8;
    tx(`Parcelado ${pA}× — ${fmtB(Math.round(arqCI/pA*100)/100)}/mês`,M+2,y); hr(y+3); y+=10;

    const dP=orc.descontoPacote??10, pP=orc.parcelasPacote??4;
    const tDesc=Math.round(totCI*(1-dP/100)*100)/100;
    sf("bold",8.5); stc(INK); tx("Pacote Completo (Arq. + Eng.)",M,y); y+=6;
    sf("normal",8.5); stc(INK_MD);
    tx(`De ${fmtB(totCI)} por apenas:`,M+2,y);
    sf("bold",9); stc(INK); tx(fmtB(tDesc),W-M,y,{align:"right"}); y+=5;
    sf("normal",7.5); stc(INK_LT);
    tx(`Desconto de ${fmtB(Math.round(totCI*dP/100*100)/100)} (${dP}%)  ·  Parcelado ${pP}× de ${fmtB(Math.round(tDesc/pP*100)/100)} c/ desconto`,M+2,y);
    hr(y+3); y+=9;
  }

  // PIX
  sf("normal",8); stc(INK_LT);
  tx("PIX  ·  Chave CNPJ: 36.122.417/0001-74 — Leo Padovan Projetos e Construções  ·  Banco Sicoob",M,y);
  y+=8;

  // ── ESCOPO DOS SERVIÇOS ───────────────────────────────────
  secTitle("Escopo dos serviços");

  escopoDefault.forEach((bloco,bi) => {
    nv(20);
    sf("bold",9); stc(INK); tx(bloco.titulo,M,y); y+=6;

    if (bloco.objetivo) {
      sf("bold",7.5); stc(INK_LT); tx("OBJETIVO",M,y); y+=5;
      sf("normal",8.5); stc(INK_MD);
      const ls = doc.splitTextToSize(bloco.objetivo, TW);
      ls.forEach(ln => { nv(5); tx(ln,M,y); y+=4.5; }); y+=2;
    }

    if (bloco.itens.length) {
      sf("bold",7.5); stc(INK_LT); tx("SERVIÇOS INCLUSOS",M,y); y+=5;
      bloco.itens.forEach(it => bullet(it));
      y+=2;
    }

    if (bloco.entregaveis.length) {
      sf("bold",7.5); stc(INK_LT); tx("ENTREGÁVEIS",M,y); y+=5;
      bloco.entregaveis.forEach(it => bullet(it));
      y+=2;
    }

    if (bloco.obs) {
      sf("normal",7.5);
      const ls = doc.splitTextToSize(bloco.obs, TW);
      stc(INK_LT);
      ls.forEach(ln => { nv(5); tx(ln,M,y); y+=4; }); y+=2;
    }

    if (bi < escopoDefault.length-1) { nv(5); hr(y); y+=5; }
  });

  // ── SERVIÇOS NÃO INCLUSOS ─────────────────────────────────
  secTitle("Serviços não inclusos");
  const halfW = TW/2-8;
  const col1 = naoInclDefault.filter((_,i) => i%2===0);
  const col2 = naoInclDefault.filter((_,i) => i%2===1);
  const nRows = Math.max(col1.length, col2.length);
  for (let i=0; i<nRows; i++) {
    // Calcular altura máxima da linha (maior entre col1 e col2)
    sf("normal",8.5);
    const ls1 = col1[i] ? doc.splitTextToSize(col1[i], halfW-6) : [];
    const ls2 = col2[i] ? doc.splitTextToSize(col2[i], halfW-6) : [];
    const rowH = Math.max(ls1.length, ls2.length) * 4.5 + 1.5;
    nv(rowH + 1);
    stc(INK_MD);
    if(col1[i]) { tx("•",M+1,y); ls1.forEach((ln,li) => tx(ln, M+5, y+li*4.5)); }
    if(col2[i]) { tx("•",midX+1,y); ls2.forEach((ln,li) => tx(ln, midX+5, y+li*4.5)); }
    y += rowH;
  }
  nv(6);
  sf("normal",7.5); stc(INK_LT);
  tx("Obs: Todos os serviços não inclusos podem ser contratados como serviços adicionais.",M,y); y+=8;

  // ── PRAZO DE EXECUÇÃO ─────────────────────────────────────
  secTitle("Prazo de execução");
  prazoDefault.forEach(p => bullet(p));
  y+=4;

  // ── ACEITE DA PROPOSTA ────────────────────────────────────
  secTitle("Aceite da proposta");
  nv(40);

  const halfAc = TW/2-10;
  // Cliente
  sf("bold",7); stc(INK_LT); tx("CLIENTE",M,y); y+=5;
  sf("bold",10); stc(INK); tx(orc.cliente||"—",M,y); y+=16;
  hr(y,M,M+halfAc); sf("normal",7); stc(INK_LT);
  tx("Assinatura",M,y+4);
  tx("Data: _____ / _____ / _______",M+halfAc,y+4,{align:"right"});

  // Responsável
  const rx = midX+4;
  y -= 21;
  sf("bold",7); stc(INK_LT); tx("RESPONSÁVEL TÉCNICO",rx,y); y+=5;
  sf("bold",10); stc(INK); tx("Arq. Leonardo Padovan",rx,y); y+=5;
  sf("normal",7.5); stc(INK_LT); tx("CAU A30278-3  ·  Ourinhos",rx,y); y+=11;
  hr(y,rx,W-M); sf("normal",7); stc(INK_LT);
  tx("Assinatura",rx,y+4);
  tx(dataStr,W-M,y+4,{align:"right"});
  y+=14;

  // ── RODAPÉ (todas as páginas) ─────────────────────────────
  const totalPgs = doc.getNumberOfPages();
  const rodTxt = `Padovan Arquitetos  ·  leopadovan.arq@gmail.com  ·  (14) 99767-4200  ·  @padovan_arquitetos`;
  for (let pg=1; pg<=totalPgs; pg++) {
    doc.setPage(pg);
    sc(LINE,"draw"); doc.setLineWidth(0.3); doc.line(M,H-14,W-M,H-14);
    sf("normal",6.5); stc(INK_LT);
    tx(rodTxt,M,H-10);
    tx(`${pg} / ${totalPgs}`,W-M-12,H-10,{align:"right"});
    // QR na última página
    if (pg===totalPgs) {
      const qx=W-M-9, qy=H-13, qs=8;
      sc([255,255,255]); doc.rect(qx-0.5,qy-0.5,qs+1,qs+1,"F");
      sc(INK);
      // 3 quadrados de canto
      doc.rect(qx,qy,3,3,"F"); doc.rect(qx+qs-3,qy,3,3,"F"); doc.rect(qx,qy+qs-3,3,3,"F");
      // interiores
      doc.rect(qx+1,qy+1,1,1,"F"); doc.rect(qx+qs-2,qy+1,1,1,"F"); doc.rect(qx+1,qy+qs-2,1,1,"F");
      // pixels centrais
      doc.rect(qx+4,qy+1,1,1,"F"); doc.rect(qx+6,qy+1,1,1,"F");
      doc.rect(qx+4,qy+3,1,1,"F"); doc.rect(qx+6,qy+4,1,1,"F");
      doc.rect(qx+4,qy+5,1,1,"F"); doc.rect(qx+6,qy+6,1,1,"F");
      doc.rect(qx+qs-2,qy+4,1,1,"F"); doc.rect(qx+qs-2,qy+6,1,1,"F");
    }
  }

  // Download
  const blob = doc.output("blob");
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `proposta-${(orc.cliente||"projeto").replace(/\s+/g,"-").toLowerCase()}.pdf`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function defaultModelo(orc, arqTotal, engTotal, grandTotal, fmt, fmtM2, nUnid, engUnit, r) {
  const dataEmissao = new Date(orc.criadoEm).toLocaleDateString("pt-BR",{day:"numeric",month:"long",year:"numeric"});
  const validade    = new Date(new Date(orc.criadoEm).getTime()+15*86400000).toLocaleDateString("pt-BR");
  const comodosAtivos = (orc.comodos||[]).filter(c=>c.qtd>0);
  const totalComodos  = comodosAtivos.reduce((s,c)=>s+c.qtd,0);
  return {
    escritorio:   { nome:"Padovan Arquitetos", cidade:"Ourinhos — SP", tel:"(14) 99767-4200", email:"leopadovan.arq@gmail.com", social:"@padovan_arquitetos" },
    titulo:       "Projeto de Arquitetura e Engenharia",
    subtitulo:    "Proposta Comercial",
    dataEmissao,
    validade,
    cliente:      { nome: orc.cliente||"—", tipoObra:`${orc.tipo} — ${orc.subtipo}`, resumo: (() => {
        const subtipo = orc.subtipo || "Construção nova";
        const tipologia = (orc.tipologia||"térrea").toLowerCase();
        const fmtArea = (m2) => m2 > 0 ? m2.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+"m²" : null;

        if (orc.tipo === "Comercial") {
          const partes = [];
          if ((r.nLojas||0) > 0)
            partes.push(`${r.nLojas} loja${r.nLojas!==1?"s":""} (${fmtArea(r.m2Loja1 * r.nLojas)})`);
          if ((r.nAncoras||0) > 0)
            partes.push(`${r.nAncoras} ${r.nAncoras===1?"Espaço Âncora":"Espaços Âncoras"} (${fmtArea(r.m2Anc1 * r.nAncoras)})`);
          if ((r.nApartamentos||0) > 0)
            partes.push(`${r.nApartamentos} apartamento${r.nApartamentos!==1?"s":""} (${fmtArea(r.m2Apto1 * r.nApartamentos)})`);
          if ((r.nGalpoes||0) > 0)
            partes.push(`${r.nGalpoes} ${r.nGalpoes!==1?"galpões":"galpão"} (${fmtArea(r.m2Galpao1 * r.nGalpoes)})`);
          if ((r.atComum||0) > 0)
            partes.push(`Área Comum (${fmtArea(r.atComum)})`);
          const lista = partes.length > 1
            ? partes.slice(0,-1).join(", ") + " e " + partes[partes.length-1]
            : partes[0] || "";
          return `Conjunto comercial, contendo ${lista}, totalizando ${fmtArea(r.areaTotal)}.`;
        }

        if (orc.tipo === "Galpao") {
          const comAtivos = (orc.comodos||[]).filter(c=>c.qtd>0).map(c=>c.nome).join(", ");
          const areaUni = r.areaTotal || 0;
          const nUn = r.nUnidades || 1;
          const areaTotal = Math.round(areaUni * nUn * 100)/100;
          const fmtN = (n) => n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
          if (nUn > 1) {
            return `${nUn} galpões idênticos, com ${fmtN(areaUni)}m² de área por unidade, totalizando ${fmtN(areaTotal)}m². Cada unidade contendo: ${comAtivos}.`;
          }
          return `Galpão — ${subtipo}, com ${fmtArea(r.areaBruta)} de área útil (${fmtArea(r.areaTotal)} com circulação), contendo: ${comAtivos}.`;
        }

        // Residencial / Clínica — descrição humanizada
        const nUnidades = r.nUnidades || 1;
        const comodos = (orc.comodos||[]).filter(c=>c.qtd>0);
        const totalAmb = comodos.reduce((s,c)=>s+c.qtd,0);
        const areaUni = r.areaTotal || 0;
        const areaTot = Math.round(areaUni * nUnidades * 100)/100;
        const fmtN = (n) => n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});

        // Converte número em palavra para concordância
        const numPorExtenso = (n, genero="m") => {
          const masc = ["","um","dois","três","quatro","cinco","seis","sete","oito","nove","dez"];
          const fem  = ["","uma","duas","três","quatro","cinco","seis","sete","oito","nove","dez"];
          if (n >= 1 && n <= 10) return genero === "f" ? fem[n] : masc[n];
          return String(n);
        };

        // Formata lista de ambientes de forma humanizada
        const pluraisIrreg = {
          "garagem":"garagens","suíte":"suítes","lavabo":"lavabos","closet":"closets",
          "wc":"WCs","hall de entrada":"halls de entrada","sala tv":"salas de TV",
          "sala de tv":"salas de TV","living":"livings","cozinha":"cozinhas",
          "lavanderia":"lavanderias","depósito":"depósitos","escritório":"escritórios",
          "sala de jantar":"salas de jantar","área de lazer":"áreas de lazer",
          "piscina":"piscinas","sauna":"saunas","academia":"academias",
          "brinquedoteca":"brinquedotecas","closet suíte":"closets suíte",
          "suíte master":"suítes master","escada":"escadas","varanda":"varandas",
          "quarto":"quartos","banheiro":"banheiros","corredor":"corredores",
          "sala":"salas","estúdio":"estúdios","terraço":"terraços",
        };
        const pluralAmb = (nome, qtd) => {
          const key = nome.toLowerCase();
          if (qtd === 1) return key;
          return pluraisIrreg[key] || `${key}s`;
        };
        // Gênero dos ambientes para concordância
        const generoAmb = {
          "garagem":"f","suíte":"f","lavanderia":"f","academia":"f","brinquedoteca":"f",
          "sauna":"f","escada":"f","varanda":"f","sala tv":"f","sala de tv":"f",
          "sala de jantar":"f","área de lazer":"f","piscina":"f","cozinha":"f",
          "wc":"m","closet":"m","hall de entrada":"m","living":"m","depósito":"m",
          "escritório":"m","lavabo":"m","banheiro":"m","quarto":"m","terraço":"m",
          "closet suíte":"m","estúdio":"m","corredor":"m",
        };
        const listaAmb = comodos.map(c => {
          const key = c.nome.toLowerCase();
          if (c.qtd === 1) return key;
          // Garagem: caso especial
          if (key === "garagem") return `garagem com ${c.qtd === 1 ? "uma vaga" : `${numPorExtenso(c.qtd, "f")} vagas`}`;
          const gen = generoAmb[key] || "m";
          return `${numPorExtenso(c.qtd, gen)} ${pluralAmb(c.nome, c.qtd)}`;
        });
        const listaStr = listaAmb.length > 1
          ? listaAmb.slice(0,-1).join(", ") + " e " + listaAmb[listaAmb.length-1]
          : listaAmb[0] || "";

        const padrao  = (orc.padrao||"médio").toLowerCase();
        const isClinica = orc.tipo === "Clínica";

        // Tipologia humanizada
        const tipMap = {
          "térrea":"térrea","térreo":"térrea",
          "sobrado":"com dois pavimentos",
          "apartamento":"em apartamento","cobertura":"em cobertura",
        };
        const tipDesc = tipMap[tipologia] || tipologia;

        // Número por extenso feminino para unidades
        const numFem = ["","uma","duas","três","quatro","cinco","seis","sete","oito","nove","dez"];
        const nExt = nUnidades >= 1 && nUnidades <= 10 ? numFem[nUnidades] : String(nUnidades);

        if (nUnidades > 1) {
          const tipoPlural = isClinica ? "clínicas" : "residências";
          return `${nExt.charAt(0).toUpperCase()+nExt.slice(1)} ${tipoPlural} ${tipDesc} idênticas, com ${fmtN(areaUni)}m² por unidade, totalizando ${fmtN(areaTot)}m² de área construída. Cada unidade composta por ${totalAmb} ambientes: ${listaStr}.`;
        }
        const tipoSing = isClinica ? "clínica" : "residência";
        return `Uma ${tipoSing} ${tipDesc}, com ${fmtN(areaUni)}m² de área construída, composta por ${totalAmb} ambientes: ${listaStr}.`;
      })(), responsavel:"Arq. Leonardo Padovan · CAU A30278-3" },
    servicos: [
      { id:1, descricao:`Projeto Arquitetônico${nUnid>1?" ("+nUnid+" unidades)":""}`, sub: nUnid>1?`1ª unidade: ${fmt(r.precoFinal)}`:"", valor: arqTotal },
      { id:2, descricao:`Projetos de Engenharia${nUnid>1?" ("+nUnid+" unidades)":""}`, sub:`Estrutural · Elétrico · Hidrossanitário${nUnid>1?" — 1ª unidade: "+fmt(engUnit):""}`, valor: engTotal },
    ],
    pagamento: {
      pix: "Chave CNPJ: 36.122.417/0001-74 — Leo Padovan Projetos e Construções",
      banco: "Banco Sicoob",
      tipoPagamento: orc.tipoPagamento || "padrao",
      descontoEtapa:      orc.descontoEtapa      ?? 5,
      descontoPacote:     orc.descontoPacote     ?? 10,
      parcelasEtapa:      orc.parcelasEtapa      ?? 3,
      parcelasPacote:     orc.parcelasPacote     ?? 4,
      descontoEtapaCtrt:  orc.descontoEtapaCtrt  ?? 5,
      parcelasEtapaCtrt:  orc.parcelasEtapaCtrt  ?? 2,
      descontoPacoteCtrt: orc.descontoPacoteCtrt ?? 15,
      parcelasPacoteCtrt: orc.parcelasPacoteCtrt ?? 8,
      etapasPct: orc.etapasPct || [
        { id:1, nome:"Estudo de Viabilidade", pct:10 },
        { id:2, nome:"Estudo Preliminar",     pct:40 },
        { id:3, nome:"Aprovação Prefeitura",  pct:12 },
        { id:4, nome:"Projeto Executivo",     pct:38 },
      ],
      opcoes: [
        { id:1, titulo:"Apenas Arquitetura", base: arqTotal, descAntec: orc.descontoEtapa??5, nParcelas: orc.parcelasEtapa??3 },
        { id:2, titulo:"Pacote Completo (Arq. + Eng.)", base: grandTotal, descAntec: orc.descontoPacote??10, nParcelas: orc.parcelasPacote??4 },
      ]
    },
    escopo: [
      { id:1, titulo:"1. Estudo Preliminar",
        objetivo:"Desenvolver o conceito arquitetônico inicial, organizando os ambientes, a implantação e a linguagem estética do projeto.",
        itens:["Reunião de briefing e entendimento das necessidades do cliente","Definição do programa de necessidades","Estudo de implantação da edificação no terreno","Desenvolvimento da concepção arquitetônica inicial","Definição preliminar de: layout, fluxos, volumetria, setorização e linguagem estética","Compatibilização entre funcionalidade, conforto, estética e viabilidade construtiva","Ajustes conforme alinhamento com o cliente"],
        entregaveis:["Planta baixa preliminar","Estudo volumétrico / fachada conceitual","Implantação inicial","Imagens, croquis ou perspectivas conceituais","Apresentação para validação do conceito arquitetônico"],
        obs:"É nesta etapa que o projeto ganha forma. O estudo preliminar define a essência da proposta e orienta todas as fases seguintes." },
      { id:2, titulo:"2. Aprovação na Prefeitura",
        objetivo:"Adequar e preparar o projeto arquitetônico para protocolo e aprovação junto aos órgãos públicos competentes.",
        itens:["Adequação do projeto às exigências legais e urbanísticas do município","Elaboração dos desenhos técnicos exigidos para aprovação","Montagem da documentação técnica necessária ao processo","Inserção de informações obrigatórias conforme normas municipais","Preparação de pranchas, quadros de áreas e demais peças gráficas","Apoio técnico durante o processo de aprovação","Atendimento a eventuais comunique-se ou exigências técnicas da prefeitura"],
        entregaveis:["Projeto legal para aprovação","Plantas, cortes, fachadas e implantação conforme exigência municipal","Quadros de áreas","Arquivos e documentação técnica para protocolo"],
        obs:"Não inclusos nesta etapa: taxas municipais, emolumentos, ART/RRT, levantamentos complementares, certidões e exigências extraordinárias de órgãos externos, salvo se expressamente previsto." },
      { id:3, titulo:"3. Projeto Executivo",
        objetivo:"Desenvolver o projeto arquitetônico em nível detalhado para execução da obra, fornecendo todas as informações necessárias para construção com precisão.",
        itens:["Desenvolvimento técnico completo do projeto aprovado","Detalhamento arquitetônico para obra","Definição precisa de: dimensões, níveis, cotas, eixos, paginações, esquadrias, acabamentos e elementos construtivos","Elaboração de desenhos técnicos executivos","Compatibilização arquitetônica com premissas de obra","Apoio técnico para leitura e entendimento do projeto pela equipe executora"],
        entregaveis:["Planta baixa executiva","Planta de locação e implantação","Planta de cobertura","Cortes e fachadas executivos","Planta de layout e pontos arquitetônicos","Planta de esquadrias e pisos","Detalhamentos construtivos","Quadro de esquadrias e quadro de áreas final"],
        obs:"É a etapa que transforma a ideia em construção real. Um bom projeto executivo reduz improvisos, retrabalhos e falhas de execução na obra." },
    ],
    escopoEng: ["Estrutural: lançamento, dimensionamento de vigas, pilares, lajes e fundações","Elétrico: dimensionamento de cargas, circuitos, quadros e pontos","Hidrossanitário: distribuição de pontos de água fria/quente, esgoto e dimensionamento","Compatibilização entre projetos arquitetônico e de engenharia para verificar possíveis interferências"],
    escopoEtapas: [
      { id:1, titulo:"1. Estudo de Viabilidade",
        objetivo:"Analisar o potencial construtivo do terreno e verificar a viabilidade de implantação do empreendimento, considerando as condicionantes físicas, urbanísticas, legais e funcionais aplicáveis ao lote.",
        itens:["Levantamento inicial e consolidação das informações técnicas do terreno", "Análise documental e física do lote, incluindo matrícula, dimensões, topografia e características existentes", "Consulta e interpretação dos parâmetros urbanísticos e restrições legais aplicáveis", "Verificação da viabilidade construtiva, considerando taxa de ocupação, coeficiente de aproveitamento, recuos obrigatórios, gabarito de altura e demais condicionantes normativas", "Estimativa preliminar da área edificável e do potencial de aproveitamento do terreno", "Avaliação da melhor ocupação do lote, alinhada ao programa de necessidades do cliente", "Definição preliminar da implantação, organização dos acessos, fluxos, circulação, áreas livres e áreas construídas", "Estudo de volumetria, análise de inserção no entorno e definição de pontos focais que contribuam para a valorização do empreendimento", "Dimensionamento preliminar de estacionamentos, fluxos operacionais e viabilidade de circulação para veículos leves e pesados", "Análise inicial de conforto ambiental e estratégias passivas de sustentabilidade, considerando desempenho térmico, lumínico e acústico, além de ventilação natural e proteção solar", "Estimativa preliminar de investimento, com base na área projetada e em custos referenciais de mercado"],
        entregaveis:["Estudo técnico de ocupação do terreno, com planta de implantação e setorização preliminar", "Esquema conceitual de implantação, incluindo diagramas de organização espacial, acessos e condicionantes do entorno", "Representações gráficas, estudo volumétrico em 3D e imagens conceituais", "Relatório sintético de viabilidade construtiva, contemplando memorial descritivo, quadro de áreas e síntese dos parâmetros urbanísticos aplicáveis"],
        obs:"Esta etapa tem como objetivo reduzir riscos e antecipar decisões estratégicas antes do desenvolvimento do projeto, permitindo validar a compatibilidade da proposta com o terreno, com a legislação municipal e com os objetivos do empreendimento." },
      { id:2, titulo:"2. Estudo Preliminar",
        objetivo:"Desenvolver o conceito arquitetônico inicial, organizando os ambientes, a implantação e a linguagem estética do projeto.",
        itens:["Reunião de briefing e entendimento das necessidades do cliente","Definição do programa de necessidades","Estudo de implantação da edificação no terreno","Desenvolvimento da concepção arquitetônica inicial","Definição preliminar de: layout, fluxos, volumetria, setorização e linguagem estética","Compatibilização entre funcionalidade, conforto, estética e viabilidade construtiva","Ajustes conforme alinhamento com o cliente"],
        entregaveis:["Planta baixa preliminar","Estudo volumétrico / fachada conceitual","Implantação inicial","Imagens, croquis ou perspectivas conceituais","Apresentação para validação do conceito arquitetônico"],
        obs:"É nesta etapa que o projeto ganha forma. O estudo preliminar define a essência da proposta e orienta todas as fases seguintes." },
      { id:3, titulo:"3. Aprovação na Prefeitura",
        objetivo:"Adequar e preparar o projeto arquitetônico para protocolo e aprovação junto aos órgãos públicos competentes.",
        itens:["Adequação do projeto às exigências legais e urbanísticas do município","Elaboração dos desenhos técnicos exigidos para aprovação","Montagem da documentação técnica necessária ao processo","Inserção de informações obrigatórias conforme normas municipais","Preparação de pranchas, quadros de áreas e demais peças gráficas","Apoio técnico durante o processo de aprovação","Atendimento a eventuais comunique-se ou exigências técnicas da prefeitura"],
        entregaveis:["Projeto legal para aprovação","Plantas, cortes, fachadas e implantação conforme exigência municipal","Quadros de áreas","Arquivos e documentação técnica para protocolo"],
        obs:"Não inclusos nesta etapa: taxas municipais, emolumentos, ART/RRT, levantamentos complementares, certidões e exigências extraordinárias de órgãos externos, salvo se expressamente previsto." },
      { id:4, titulo:"4. Projeto Executivo",
        objetivo:"Desenvolver o projeto arquitetônico em nível detalhado para execução da obra, fornecendo todas as informações necessárias para construção com precisão.",
        itens:["Desenvolvimento técnico completo do projeto aprovado","Detalhamento arquitetônico para obra","Definição precisa de: dimensões, níveis, cotas, eixos, paginações, esquadrias, acabamentos e elementos construtivos","Elaboração de desenhos técnicos executivos","Compatibilização arquitetônica com premissas de obra","Apoio técnico para leitura e entendimento do projeto pela equipe executora"],
        entregaveis:["Planta baixa executiva","Planta de locação e implantação","Planta de cobertura","Cortes e fachadas executivos","Planta de layout e pontos arquitetônicos","Planta de esquadrias e pisos","Detalhamentos construtivos","Quadro de esquadrias e quadro de áreas final"],
        obs:"É a etapa que transforma a ideia em construção real. Um bom projeto executivo reduz improvisos, retrabalhos e falhas de execução na obra." },
    ],
    escopoEng: ["Estrutural: lançamento, dimensionamento de vigas, pilares, lajes e fundações","Elétrico: dimensionamento de cargas, circuitos, quadros e pontos","Hidrossanitário: distribuição de pontos de água fria/quente, esgoto e dimensionamento","Compatibilização entre projetos arquitetônico e de engenharia para verificar possíveis interferências"],
    naoInclusos: ["Taxas municipais, emolumentos e registros (CAU/Prefeitura)","Impostos","Projetos de climatização","Projeto de prevenção de incêndio","Projeto de automação","Projeto de paisagismo","Projeto de interiores","Projeto de Marcenaria (Móveis internos)","Projeto estrutural de estruturas metálicas","Projeto estrutural para muros de contenção (arrimo) acima de 1 m de altura","Sondagem e Planialtimétrico do terreno","Acompanhamento semanal de obra","Gestão e execução de obra","Vistoria para Caixa Econômica Federal","RRT de Execução de obra"],
    prazo: ["Prazo estimado para entrega do Projeto Arquitetônico: 30 dias úteis após aprovação do estudo preliminar.", "Prazo estimado para entrega dos Projetos de Engenharia: 30 dias úteis após aprovação na prefeitura."],
    aceite: { responsavel:"Arq. Leonardo Padovan", registro:"CAU A30278-3", cidade:"Ourinhos" },
    logoPos: { x:0, y:0 },
  };
}

var TEMAS_COR = [
  { nome:"Preto Clássico",   ink:[17,24,39],    accent:[17,24,39],    bg:[220,225,232], hex:"#111827" },
  { nome:"Azul Profundo",    ink:[15,40,80],     accent:[30,80,160],   bg:[210,225,245], hex:"#1e50a0" },
  { nome:"Verde Escritório", ink:[20,60,40],     accent:[30,100,60],   bg:[210,235,220], hex:"#1e643c" },
  { nome:"Bordô Elegante",   ink:[80,10,30],     accent:[140,20,50],   bg:[240,215,220], hex:"#8c1432" },
  { nome:"Cinza Moderno",    ink:[50,50,55],     accent:[80,80,90],    bg:[225,225,228], hex:"#505058" },
  { nome:"Azul Petróleo",    ink:[10,50,60],     accent:[15,90,110],   bg:[205,230,235], hex:"#0f5a6e" },
  { nome:"Dourado Luxo",     ink:[80,55,10],     accent:[140,100,15],  bg:[245,238,210], hex:"#8c640f" },
  { nome:"Roxo Corporativo", ink:[55,20,90],     accent:[100,40,160],  bg:[230,215,245], hex:"#6428a0" },
];

var PROPOSTA_PADRAO_KEY = "obramanager-proposta-padrao-v1";
var orcPropostaKey = (orcId) => `obramanager-proposta-${orcId}`;

function PropostaComercial({ orc, fmt, fmtM2, incluiArq=true, incluiEng=true }) {
  const [logo, setLogo]           = useState(null);
  const [logoCarregando, setLogoCarregando] = useState(true);
  const [savedMsg, setSavedMsg]   = useState("");
  const [modelo, setModelo]       = useState(null);
  const [logoPos, setLogoPos]     = useState({ x:0, y:0 });
  const [dragging, setDragging]         = useState(false);
  const dragOffset                      = useRef({ x:0, y:0 });
  const [quadroPos, setQuadroPos]       = useState({ x:0, y:0 });
  const [draggingQuadro, setDraggingQuadro] = useState(false);
  const dragOffsetQuadro                = useRef({ x:0, y:0 });
  const [showCorModal, setShowCorModal] = useState(false);
  const [bgLogo, setBgLogoSt]   = useState("#ffffff");
  const [corTema, setCorTemaSt] = useState(TEMAS_COR[0]);

  // Carrega preferências do storage persistente
  useEffect(() => {
    (async () => {
      try { const r = await window.storage.get("obramanager-bg-logo");    if (r?.value) setBgLogoSt(r.value); } catch {}
      try { const r = await window.storage.get("obramanager-cor-tema");   if (r?.value) setCorTemaSt(JSON.parse(r.value)); } catch {}
    })();
  }, []);

  const setBgLogo = async v => { setBgLogoSt(v); try { await window.storage.set("obramanager-bg-logo", v); } catch {} };
  const setCorTema = async t => { setCorTemaSt(t); try { await window.storage.set("obramanager-cor-tema", JSON.stringify(t)); } catch {} };

  const r        = orc.resultado || {};
  const nUnid    = r.nUnidades || 1;
  const engUnit  = r.engTotal ?? calcularEngenharia(r.areaTotal||0).totalEng;
  const arqTotal = r.precoTotal || r.precoFinal || 0;
  let engRepet   = 0;
  if (nUnid > 1) {
    let areaAcum = r.areaTotal || 0;
    for (let i = 2; i <= nUnid; i++) {
      const pct = getTipoConfig(r.tipo).repeticaoPcts(areaAcum);
      engRepet += engUnit * pct;
      areaAcum += (r.areaTotal||0);
    }
  }
  const engTotal   = engUnit + engRepet;
  const grandTotal = Math.round((arqTotal + engTotal) * 100) / 100;

  // Load logo + modelo
  // Prioridade: 1) modelo salvo para este orçamento específico
  //             2) modelo padrão (estrutura base) mesclado com dados do orçamento atual
  useEffect(() => {
    (async () => {
      try { const lr = await window.storage.get("escritorio-logo"); if (lr?.value) setLogo(lr.value); } catch {}
      try {
        // Tenta carregar modelo salvo para este orçamento
        const orcKey = orcPropostaKey(orc.id);
        const orcR = await window.storage.get(orcKey);
        if (orcR?.value) {
          const saved = JSON.parse(orcR.value);
          setModelo(saved);
          setLogoPos(saved.logoPos||{x:0,y:0});
        } else {
          // Nenhum modelo salvo para este orçamento — tenta modelo padrão para herdar escopo/escritório
          const padR = await window.storage.get(PROPOSTA_PADRAO_KEY);
          if (padR?.value) {
            const padrao = JSON.parse(padR.value);
            // Mescla: mantém escopo/escritório/prazo/naoInclusos/aceite do padrão
            // mas usa dados do orçamento atual para cliente/serviços/valores/datas
            const fresh = defaultModelo(orc, arqTotal, engTotal, grandTotal, fmt, fmtM2, nUnid, engUnit, r);
            const merged = {
              ...fresh,
              escritorio:  padrao.escritorio  || fresh.escritorio,
              escopo:      padrao.escopo       || fresh.escopo,
              naoInclusos: padrao.naoInclusos  || fresh.naoInclusos,
              prazo:       padrao.prazo        || fresh.prazo,
              prazoEtapas: padrao.prazoEtapas  || fresh.prazoEtapas,
              aceite:      padrao.aceite       || fresh.aceite,
              titulo:      padrao.titulo       || fresh.titulo,
              subtitulo:   padrao.subtitulo    || fresh.subtitulo,
            };
            setModelo(merged);
          }
          // Se não há padrão, o modelo fica null e defaultModelo será usado ao renderizar
        }
      } catch {}
      setLogoCarregando(false);
    })();
  }, [orc.id]);

  // Build fresh model when orc changes and no saved model
  const mRaw = modelo || defaultModelo(orc, arqTotal, engTotal, grandTotal, fmt, fmtM2, nUnid, engUnit, r);

  // Sincroniza escopoEtapas com etapasPct — adiciona blocos para etapas novas
  const etapasPctAtual = orc.etapasPct || [];
  const escopoEtapasSinc = (() => {
    const existentes = mRaw.escopoEtapas || [];
    const result = [...existentes];
    etapasPctAtual.forEach((etapa) => {
      const jaExiste = existentes.some(b =>
        b.titulo?.replace(/^\d+\.\s*/,"").trim() === etapa.nome?.trim() || b.id === etapa.id
      );
      if (!jaExiste) {
        result.push({
          id: etapa.id || Date.now(),
          titulo: `${result.length+1}. ${etapa.nome}`,
          objetivo: "",
          itens: ["A definir"],
          entregaveis: ["A definir"],
          obs: "",
        });
      }
    });
    // Renumera todos — preserva texto após ". "
    return result.map((b, i) => ({
      ...b,
      titulo: `${i+1}. ${b.titulo?.replace(/^\d+\.\s*/,"") || b.titulo}`,
    }));
  })();
  const engItemNaoIncl = "Projetos de Engenharia (Estrutural · Elétrico · Hidrossanitário)";
  const temImposto = r.impostoAplicado && (r.aliquotaImposto||0) > 0;
  const naoInclusosComEng = [
    ...(mRaw.naoInclusos||[]).filter(i =>
      !i.includes("Projetos de Engenharia") &&
      !i.toLowerCase().startsWith("imposto")
    ),
    ...(temImposto ? [] : ["Impostos"]),
    ...(!incluiEng ? [engItemNaoIncl] : []),
  ];
  const m = { ...mRaw,
    escopoEtapas: escopoEtapasSinc,
    naoInclusos: naoInclusosComEng,
    titulo: !incluiArq ? "Projetos de Engenharia" : !incluiEng ? "Projeto Arquitetônico" : mRaw.titulo,
    servicos: (mRaw.servicos||[]).filter(sv => {
      const d = (sv.descricao||"").toLowerCase();
      if (!incluiArq && d.includes("arquitet")) return false;
      if (!incluiEng && d.includes("engenhar")) return false;
      return true;
    }),
    escopo: (mRaw.escopo||[]).filter(g => {
      const t = (g.titulo||"").toLowerCase();
      if (!incluiArq && (t.includes("arquitet")||t.includes("assessoria"))) return false;
      if (!incluiEng && (t.includes("engenhar")||t.includes("complement"))) return false;
      return true;
    }),
    pagamento: { ...mRaw.pagamento, opcoes: (mRaw.pagamento?.opcoes||[]).filter(op => {
      const t = (op.titulo||"").toLowerCase();
      // Remove "Apenas Arq." se sem arq
      if (!incluiArq && t.includes("arquitet") && !t.includes("eng") && !t.includes("pacote")) return false;
      // Remove "Apenas Eng." se sem eng
      if (!incluiEng && t.includes("engenhar") && !t.includes("pacote")) return false;
      // Remove "Pacote Completo" se faltar qualquer um dos dois
      if (t.includes("pacote") && (!incluiArq || !incluiEng)) return false;
      return true;
    })},
    prazo: (mRaw.prazo||[]).filter(p => {
      if (!incluiEng && p.includes("Engenharia")) return false;
      return true;
    }),
  };

  const set = (path, val) => {
    const parts = path.split(".");
    setModelo(prev => {
      const base = prev || defaultModelo(orc, arqTotal, engTotal, grandTotal, fmt, fmtM2, nUnid, engUnit, r);
      const clone = JSON.parse(JSON.stringify(base));
      let cur = clone;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      cur[parts[parts.length-1]] = val;
      return clone;
    });
  };

  async function salvarModelo() {
    const toSave = { ...(modelo || defaultModelo(orc, arqTotal, engTotal, grandTotal, fmt, fmtM2, nUnid, engUnit, r)), logoPos };
    // Salva modelo específico deste orçamento
    await window.storage.set(orcPropostaKey(orc.id), JSON.stringify(toSave));
    // Salva também como padrão — mas apenas a estrutura reutilizável (sem dados de cliente/valores)
    const padrao = {
      escritorio:  toSave.escritorio,
      escopo:      toSave.escopo,
      naoInclusos: toSave.naoInclusos,
      prazo:       toSave.prazo,
      prazoEtapas: toSave.prazoEtapas,
      aceite:      toSave.aceite,
      titulo:      toSave.titulo,
      subtitulo:   toSave.subtitulo,
    };
    await window.storage.set(PROPOSTA_PADRAO_KEY, JSON.stringify(padrao));
    setSavedMsg("✓ Modelo salvo!");
    setTimeout(() => setSavedMsg(""), 3000);
  }

  async function handleGeraPDF() {
    if (!window.jspdf) { setSavedMsg("Aguarde 2s e tente novamente."); return; }
    try {
      let logoData = null;
      try { const lr = await window.storage.get("escritorio-logo"); if (lr?.value) logoData = lr.value; } catch {}
      await buildPdf(orc, logoData, modelo || defaultModelo(orc, arqTotal, engTotal, grandTotal, fmt, fmtM2, nUnid, engUnit, r), corTema, bgLogo, incluiArq, incluiEng);
    } catch(err) { setSavedMsg("Erro: "+err.message); }
  }

  function handleLogo(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setLogo(ev.target.result); try { window.storage.set("escritorio-logo", ev.target.result); } catch {} };
    reader.readAsDataURL(file);
  }

  // Drag logo
  function onLogoDragStart(e) {
    setDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  }
  function onMouseMove(e) {
    const container = document.getElementById("proposta-logo-container");
    if (!container) return;
    const cr = container.getBoundingClientRect();
    if (dragging) setLogoPos({ x: e.clientX - cr.left - dragOffset.current.x, y: e.clientY - cr.top - dragOffset.current.y });
    if (draggingQuadro) {
      const nx = e.clientX - cr.left - dragOffsetQuadro.current.x;
      const ny = e.clientY - cr.top - dragOffsetQuadro.current.y;
      setQuadroPos({ x:nx, y:ny });
    }
  }
  function onMouseUp() { setDragging(false); setDraggingQuadro(false); }
  function onQuadroDragStart(e) {
    setDraggingQuadro(true);
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffsetQuadro.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  }

  // Editable text
  const E = ({ val, onSave, style={}, multiline=false, bold=false }) => {
    const [editing, setEditing] = useState(false);
    const [tmp, setTmp] = useState(val);
    if (editing) {
      const s = { fontFamily:"inherit", fontSize:"inherit", color:"inherit", fontWeight:"inherit", background:"#fffde7", border:"2px solid #f59e0b", borderRadius:4, padding:"2px 6px", width:"100%", outline:"none", resize:"vertical", ...style };
      if (multiline) return <textarea autoFocus rows={3} style={s} value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={()=>{onSave(tmp);setEditing(false);}} />;
      return <input autoFocus type="text" style={s} value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={()=>{onSave(tmp);setEditing(false);}} onKeyDown={e=>{if(e.key==="Enter"){onSave(tmp);setEditing(false);}}} />;
    }
    return <span style={{ cursor:"pointer", borderBottom:"1px dashed #cbd5e1", fontWeight:bold?"700":"inherit", ...style }} title="Clique para editar" onClick={()=>{setTmp(val);setEditing(true);}}>{val}</span>;
  };

  // Editable number
  const EN = ({ val, onSave, style={} }) => {
    const [editing, setEditing] = useState(false);
    const [tmp, setTmp] = useState(val);
    if (editing) return <input autoFocus type="number" style={{ fontFamily:"inherit", fontSize:"inherit", fontWeight:"inherit", background:"#fffde7", border:"2px solid #f59e0b", borderRadius:4, padding:"2px 6px", width:120, outline:"none", textAlign:"right", ...style }} value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={()=>{onSave(parseFloat(tmp)||0);setEditing(false);}} onKeyDown={e=>{if(e.key==="Enter"){onSave(parseFloat(tmp)||0);setEditing(false);}}} />;
    return <span style={{ cursor:"pointer", borderBottom:"1px dashed #cbd5e1", ...style }} title="Clique para editar o valor" onClick={()=>{setTmp(val);setEditing(true);}}>{fmt(val)}</span>;
  };

  const totalServicos = (m.servicos||[]).reduce((s,sv)=>s+(sv.valor||0),0);
  // Imposto no editor HTML
  const temImpHTML   = r.impostoAplicado && (r.aliquotaImposto||0) > 0;
  const aliqImpHTML  = r.aliquotaImposto || 0;
  const semImpHTML   = temImpHTML ? (1 - aliqImpHTML/100) : 1;
  // servicos já têm valor COM imposto; extraímos SEM imposto para exibir nos itens
  const totalSemImpHTML  = Math.round(totalServicos * semImpHTML * 100)/100;
  const valorImpHTML     = Math.round((totalServicos - totalSemImpHTML) * 100)/100;
  const totalComImpHTML  = totalServicos;

  const secStyle = { marginBottom:24 };
  const secHead  = { borderBottom:`2px solid ${corTema.hex}`, paddingBottom:6, marginBottom:14, display:"flex", justifyContent:"space-between", alignItems:"center" };
  const secTitle = { color:corTema.hex, fontWeight:800, fontSize:14 };
  const addBtn   = { background:"#e0f2fe", border:"1px solid #7dd3fc", borderRadius:4, padding:"2px 8px", fontSize:11, cursor:"pointer", color:"#0369a1", fontFamily:"inherit" };
  const delBtn   = { background:"#fee2e2", border:"1px solid #fca5a5", borderRadius:4, padding:"1px 6px", fontSize:10, cursor:"pointer", color:"#dc2626", fontFamily:"inherit", marginLeft:6 };

  return (
    <div style={{ fontFamily:"Arial,sans-serif", background:"#fff", color:corTema.hex, borderRadius:12, border:"1px solid #e2e8f0" }}>

      {/* BARRA DE CONTROLES */}
      <div style={{ background:"#f8fafc", borderBottom:"1px solid #e2e8f0", padding:"10px 24px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <span style={{ color:"#64748b", fontSize:12, fontWeight:700 }}>✏️ Editor de Proposta</span>
        <span style={{ color:"#94a3b8", fontSize:11 }}>Clique em qualquer texto para editar</span>
        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          {savedMsg && <span style={{ color:"#4ade80", fontSize:12, fontWeight:700 }}>{savedMsg}</span>}
          <label style={{ background:"#1e293b", border:"1px solid #334155", borderRadius:6, padding:"6px 12px", fontSize:12, cursor:"pointer", color:"#94a3b8" }}>
            {logo ? "🔄 Trocar Logo" : "📎 Carregar Logo"}
            <input type="file" accept="image/*" onChange={handleLogo} style={{ display:"none" }} />
          </label>
          {logo && <button onClick={()=>{setLogo(null);try{window.storage.delete("escritorio-logo");}catch{}}} style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:6, padding:"6px 10px", fontSize:12, cursor:"pointer", color:"#f87171", fontFamily:"inherit" }}>✕ Logo</button>}
          <button onClick={()=>setShowCorModal(true)} style={{ background:"#1e293b", border:`2px solid ${corTema.hex}`, borderRadius:6, padding:"6px 12px", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit", color:"#f1f5f9", display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ width:12, height:12, borderRadius:"50%", background:corTema.hex, display:"inline-block" }} />
            Cores PDF
          </button>
          <button onClick={salvarModelo} style={{ background:"linear-gradient(135deg,#059669,#047857)", color:"#fff", border:"none", borderRadius:6, padding:"6px 16px", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>💾 Salvar Modelo</button>
          <button onClick={handleGeraPDF} style={{ background:"linear-gradient(135deg,#7c3aed,#5b21b6)", color:"#fff", border:"none", borderRadius:6, padding:"6px 16px", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>⬇ Gerar PDF</button>
        </div>
      </div>

      {/* MODAL CORES */}
      {showCorModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={()=>setShowCorModal(false)}>
          <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:14, padding:28, minWidth:380, maxWidth:480 }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ fontWeight:800, fontSize:15, color:"#f1f5f9", marginBottom:6 }}>🎨 Escolher Cores do PDF</div>
            <div style={{ color:"#64748b", fontSize:11, marginBottom:20 }}>A cor escolhida será usada nos títulos, linhas, fundo dos itens e caixa de total.</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {TEMAS_COR.map(t => (
                <div key={t.nome} onClick={()=>{ setCorTema(t); setShowCorModal(false); }}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:8, cursor:"pointer",
                    border: corTema.nome===t.nome ? `2px solid ${t.hex}` : "2px solid #1e293b",
                    background: corTema.nome===t.nome ? "rgba(255,255,255,0.05)" : "transparent" }}>
                  <div style={{ width:28, height:28, borderRadius:6, background:t.hex, flexShrink:0, border:"1px solid rgba(255,255,255,0.1)" }} />
                  <div>
                    <div style={{ color:"#e2e8f0", fontSize:12, fontWeight:600 }}>{t.nome}</div>
                    <div style={{ color:"#475569", fontSize:10 }}>{t.hex}</div>
                  </div>
                  {corTema.nome===t.nome && <span style={{ marginLeft:"auto", color:t.hex, fontSize:14 }}>✓</span>}
                </div>
              ))}
            </div>
            <div style={{ marginTop:20, borderTop:"1px solid #1e293b", paddingTop:16 }}>
              <div style={{ color:"#94a3b8", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, marginBottom:10 }}>Fundo do Logotipo</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {[
                  { nome:"Transparente", val:"transparent", preview:"repeating-conic-gradient(#555 0% 25%,#333 0% 50%) 0 0/10px 10px" },
                  { nome:"Branco",       val:"#ffffff",     preview:"#ffffff" },
                  { nome:"Preto",        val:"#111827",     preview:"#111827" },
                  { nome:"Cinza Claro",  val:"#f1f5f9",     preview:"#f1f5f9" },
                  { nome:"Cor do Tema",  val:"__tema__",    preview: corTema.hex },
                ].map(opt => (
                  <div key={opt.val} onClick={()=>setBgLogo(opt.val)}
                    style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, cursor:"pointer", opacity: bgLogo===opt.val ? 1 : 0.6 }}>
                    <div style={{ width:36, height:36, borderRadius:6, background:opt.preview, border: bgLogo===opt.val ? `2px solid ${corTema.hex}` : "2px solid #334155" }} />
                    <span style={{ color:"#94a3b8", fontSize:9 }}>{opt.nome}</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={()=>setShowCorModal(false)} style={{ marginTop:16, width:"100%", background:"#1e293b", border:"none", borderRadius:8, padding:"8px 0", color:"#94a3b8", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Fechar</button>
          </div>
        </div>
      )}

      {/* PROPOSTA */}
      <div id="proposta-comercial-print" style={{ padding:"40px 48px", maxWidth:820, margin:"0 auto" }}
        onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>

        {/* CABEÇALHO */}
        <div id="proposta-logo-container" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:32, paddingBottom:24, borderBottom:`3px solid ${corTema.hex}`, position:"relative", minHeight:90 }}>
          <div style={{ position:"relative", minWidth:180, minHeight:80 }}>
            {/* Quadro colorido arrastável — exatamente o tamanho do logo */}
            <div
              onMouseDown={onQuadroDragStart}
              style={{ position:"absolute", left:quadroPos.x, top:quadroPos.y,
                background:corTema.hex, borderRadius:6,
                cursor:"grab", userSelect:"none",
                display:"inline-block", lineHeight:0 }}>
              {logo
                ? <img src={logo} alt="Logo"
                    style={{ maxWidth:200, height:64, width:"auto", objectFit:"contain", display:"block", borderRadius:6 }}
                    draggable={false} />
                : <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center",
                    width:72, height:72, color:"#fff", fontWeight:800, fontSize:11,
                    letterSpacing:1, textAlign:"center", padding:8, boxSizing:"border-box" }}>
                    {m.escritorio.nome}
                  </span>
              }
            </div>
          </div>
          <div style={{ textAlign:"right", fontSize:12, color:"#475569", lineHeight:2 }}>
            <div style={{ fontWeight:700, color:corTema.hex }}><E val={m.escritorio.nome} onSave={v=>set("escritorio.nome",v)} bold /></div>
            <div><E val={m.escritorio.cidade} onSave={v=>set("escritorio.cidade",v)} /></div>
            <div><E val={m.escritorio.tel} onSave={v=>set("escritorio.tel",v)} /></div>
            <div><E val={m.escritorio.email} onSave={v=>set("escritorio.email",v)} /></div>
            <div><E val={m.escritorio.social} onSave={v=>set("escritorio.social",v)} /></div>
          </div>
        </div>

        {/* TÍTULO */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ background:`linear-gradient(135deg,${corTema.hex}cc,${corTema.hex})`, color:"#fff", borderRadius:10, padding:"18px 32px", display:"inline-block" }}>
            <div style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", opacity:0.8, marginBottom:6 }}>
              <E val={m.subtitulo} onSave={v=>set("subtitulo",v)} style={{ color:"#fff", opacity:0.8 }} />
            </div>
            <div style={{ fontSize:18, fontWeight:800 }}>
              <E val={m.titulo} onSave={v=>set("titulo",v)} style={{ color:"#fff" }} />
            </div>
          </div>
          <div style={{ marginTop:12, color:"#64748b", fontSize:12 }}>
            Emitido em <E val={m.dataEmissao} onSave={v=>set("dataEmissao",v)} /> · Válido até <E val={m.validade} onSave={v=>set("validade",v)} />
          </div>
        </div>

        {/* 1. DADOS DO CLIENTE */}
        <div style={secStyle}>
          <div style={secHead}><span style={secTitle}>1. DADOS DO CLIENTE E DO PROJETO</span></div>
          <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"16px 20px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {[["Cliente","cliente.nome"],["Tipo de Obra","cliente.tipoObra"],["Responsável","cliente.responsavel"]].map(([lbl,path])=>(
              <div key={path}>
                <div style={{ fontSize:10, color:"#64748b", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{lbl}</div>
                <div style={{ fontWeight:600, color:corTema.hex }}><E val={m.cliente[path.split(".")[1]]} onSave={v=>set(path,v)} /></div>
              </div>
            ))}
            <div style={{ gridColumn:"1 / -1" }}>
              <div style={{ fontSize:10, color:"#64748b", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Resumo do Projeto</div>
              <div style={{ fontWeight:600, color:corTema.hex, whiteSpace:"pre-wrap", wordBreak:"break-word", lineHeight:1.5 }}>
                <E val={m.cliente["resumo"]} onSave={v=>set("cliente.resumo",v)} />
              </div>
            </div>
          </div>
        </div>

        {/* 2. VALORES */}
        <div style={secStyle}>
          <div style={secHead}>
            <span style={secTitle}>2. VALORES DOS PROJETOS</span>
            <button style={addBtn} onClick={()=>{
              const newId = Date.now();
              set("servicos", [...(m.servicos||[]), { id:newId, descricao:"Novo Serviço", sub:"", valor:0 }]);
            }}>+ Adicionar serviço</button>
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:corTema.hex, color:"#fff" }}>
                <th style={{ padding:"10px 14px", textAlign:"left", fontWeight:700, fontSize:12 }}>Serviço</th>
                <th style={{ padding:"10px 14px", textAlign:"right", fontWeight:700, fontSize:12 }}>
                  {temImpHTML ? "Valor (sem imposto)" : "Valor"}
                </th>
                <th style={{ padding:"4px", width:30 }}></th>
              </tr>
            </thead>
            <tbody>
              {(m.servicos||[]).map((sv,i)=>(
                <tr key={sv.id} style={{ background: i%2===0?"#fff":"#f8fafc", borderBottom:"1px solid #e2e8f0" }}>
                  <td style={{ padding:"10px 14px" }}>
                    <div style={{ fontWeight:600 }}>
                      <E val={sv.descricao} onSave={v=>{ const s=[...(m.servicos||[])]; s[i]={...s[i],descricao:v}; set("servicos",s); }} />
                    </div>
                    {(sv.sub||"").length>0 && (
                      <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>
                        <E val={sv.sub} onSave={v=>{ const s=[...(m.servicos||[])]; s[i]={...s[i],sub:v}; set("servicos",s); }} />
                      </div>
                    )}
                  </td>
                  <td style={{ padding:"10px 14px", textAlign:"right", fontWeight:700 }}>
                    {temImpHTML
                      ? fmt(Math.round(sv.valor * semImpHTML * 100)/100)
                      : <EN val={sv.valor} onSave={v=>{ const s=[...(m.servicos||[])]; s[i]={...s[i],valor:v}; set("servicos",s); }} />
                    }
                  </td>
                  <td style={{ padding:"4px", textAlign:"center" }}>
                    <button style={delBtn} onClick={()=>{ const s=(m.servicos||[]).filter((_,j)=>j!==i); set("servicos",s); }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {temImpHTML ? (
                <>
                  <tr style={{ background:"#f8fafc", borderBottom:"1px solid #e2e8f0" }}>
                    <td style={{ padding:"10px 14px", color:"#64748b", fontSize:13 }}>Total sem impostos</td>
                    <td style={{ padding:"10px 14px", textAlign:"right", color:"#64748b", fontWeight:700 }}>{fmt(totalSemImpHTML)}</td>
                    <td></td>
                  </tr>
                  <tr style={{ background:"#fff3f3", borderBottom:"1px solid #fecaca" }}>
                    <td style={{ padding:"8px 14px", fontSize:12, color:"#dc2626" }}>+ {aliqImpHTML}% de impostos (ISS/tributos)</td>
                    <td style={{ padding:"8px 14px", textAlign:"right", color:"#dc2626", fontWeight:700 }}>{fmt(valorImpHTML)}</td>
                    <td></td>
                  </tr>
                  <tr style={{ background:corTema.hex, color:"#fff" }}>
                    <td style={{ padding:"12px 14px", fontWeight:800, fontSize:14 }} colSpan={2}>
                      TOTAL GERAL (com impostos) &nbsp;&nbsp; {fmt(totalComImpHTML)}
                    </td>
                    <td></td>
                  </tr>
                </>
              ) : (
                <tr style={{ background:corTema.hex, color:"#fff" }}>
                  <td style={{ padding:"12px 14px", fontWeight:800, fontSize:14 }} colSpan={2}>
                    TOTAL GERAL &nbsp;&nbsp; {fmt(totalServicos)}
                  </td>
                  <td></td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        {/* 3. FORMAS DE PAGAMENTO */}
        <div style={secStyle}>
          <div style={secHead}>
            <span style={secTitle}>
              {m.pagamento.tipoPagamento === "etapas"
                ? "3. FORMAS DE PAGAMENTO E CONTRATAÇÃO POR ETAPA"
                : "3. FORMAS DE PAGAMENTO"}
            </span>
          </div>

          {/* Tabela de etapas */}
          {m.pagamento.tipoPagamento === "etapas" && (() => {
            const arqValCI = (m.servicos||[])[0]?.valor || totalServicos; // com imposto
            const engValCI = incluiEng ? (m.servicos||[]).slice(1).reduce((s,sv)=>s+(sv.valor||0),0) : 0;
            const arqValSI = temImpHTML ? Math.round(arqValCI * semImpHTML * 100)/100 : arqValCI;
            const engValSI = temImpHTML ? Math.round(engValCI * semImpHTML * 100)/100 : engValCI;
            const etapas = m.pagamento.etapasPct || [];
            const totalPct = etapas.reduce((s,e)=>s+Number(e.pct),0);
            const totalGeralCI = arqValCI + engValCI;
            const totalGeralSI = arqValSI + engValSI;
            const fmtBrl2 = v => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
            return (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, color:"#64748b", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Cronograma de Pagamento — Por Etapas</div>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead>
                    <tr style={{ background:corTema.hex, color:"#fff" }}>
                      <th style={{ padding:"8px 12px", textAlign:"left", fontWeight:700, fontSize:12 }}>Etapa</th>
                      <th style={{ padding:"8px 12px", textAlign:"center", fontWeight:700, fontSize:12, width:60 }}>%</th>
                      <th style={{ padding:"8px 12px", textAlign:"right", fontWeight:700, fontSize:12 }}>{temImpHTML ? "Valor (c/ impostos)" : "Valor"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {etapas.map((etapa,i) => (
                      <tr key={etapa.id} style={{ background: i%2===0?"#f8fafc":"#fff", borderBottom:"1px solid #e2e8f0" }}>
                        <td style={{ padding:"9px 12px", color:"#1e293b", fontWeight:600 }}>{etapa.nome}</td>
                        <td style={{ padding:"9px 12px", textAlign:"center", color:corTema.hex, fontWeight:700 }}>{etapa.pct}%</td>
                        <td style={{ padding:"9px 12px", textAlign:"right", color:"#1e293b", fontWeight:700 }}>{fmtBrl2(arqValCI * etapa.pct / 100)}</td>
                      </tr>
                    ))}
                    {incluiEng && engValCI > 0 && (
                      <tr style={{ background: etapas.length%2===0?"#f8fafc":"#fff", borderBottom:"1px solid #e2e8f0" }}>
                        <td style={{ padding:"9px 12px" }}>
                          <div style={{ color:"#1e293b", fontWeight:600 }}>Projetos de Engenharia</div>
                          <div style={{ color:"#64748b", fontSize:11, marginTop:2 }}>Estrutural · Elétrico · Hidrossanitário</div>
                        </td>
                        <td style={{ padding:"9px 12px", textAlign:"center", color:"#64748b" }}>—</td>
                        <td style={{ padding:"9px 12px", textAlign:"right", color:"#1e293b", fontWeight:700 }}>{fmtBrl2(engValCI)}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:corTema.hex, color:"#fff" }}>
                      <td style={{ padding:"9px 12px", fontWeight:800 }}>Total</td>
                      <td style={{ padding:"9px 12px", textAlign:"center", fontWeight:800 }}>{totalPct.toFixed(0)}%</td>
                      <td style={{ padding:"9px 12px", textAlign:"right", fontWeight:800 }}>{fmtBrl2(totalGeralCI)}</td>
                    </tr>
                  </tfoot>
                </table>

                {/* Contratação Etapa a Etapa */}
                <div style={{ marginTop:16, border:`1px solid ${corTema.hex}44`, borderRadius:10, overflow:"hidden" }}>
                  <div style={{ background:corTema.hex, color:"#fff", padding:"10px 14px", fontWeight:700, fontSize:13 }}>
                    Contratação — Etapa a Etapa
                  </div>
                  <div style={{ padding:"12px 14px", background:`${corTema.hex}08` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid #e2e8f0" }}>
                      <span style={{ fontSize:12, color:"#475569" }}>Pagamento antecipado por etapa ({m.pagamento?.descontoEtapaCtrt??orc.descontoEtapaCtrt??5}% de desconto antecipado)</span>
                      <span style={{ fontSize:12, color:"#64748b", fontWeight:600 }}>—</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0" }}>
                      <span style={{ fontSize:12, color:"#475569" }}>Parcelado: entrada + {(m.pagamento?.parcelasEtapaCtrt??orc.parcelasEtapaCtrt??2)-1} parcela{(m.pagamento?.parcelasEtapaCtrt??orc.parcelasEtapaCtrt??2)>2?"s":""} em 30 dias</span>
                      <span style={{ fontSize:12, color:"#475569", fontWeight:700 }}>{m.pagamento?.parcelasEtapaCtrt??orc.parcelasEtapaCtrt??2}× por etapa</span>
                    </div>
                  </div>
                </div>

                {/* Contratação Pacote Completo */}
                {(() => {
                  const pctDescP = m.pagamento?.descontoPacoteCtrt??orc.descontoPacoteCtrt??15;
                  const labelPacote = incluiArq && incluiEng
                    ? "Contratação — Etapas Completas (Arq. + Eng.)"
                    : incluiArq ? "Contratação — Etapas Completas Arquitetônico"
                    : "Contratação — Etapas Completas Engenharia";
                  // Desconto sobre SEM imposto → reaplica imposto por dentro
                  const totalSIDisc  = Math.round(totalGeralSI * (1 - pctDescP/100) * 100)/100;
                  const totalCIDisc  = temImpHTML ? Math.round(totalSIDisc / semImpHTML * 100)/100 : totalSIDisc;
                  const economia     = Math.round((totalGeralCI - totalCIDisc) * 100)/100;
                  const parcela8x    = Math.round(totalCIDisc / (m.pagamento?.parcelasPacoteCtrt??orc.parcelasPacoteCtrt??8) * 100)/100;
                  return (
                    <div style={{ marginTop:12, border:`2px solid ${corTema.hex}`, borderRadius:10, overflow:"hidden" }}>
                      <div style={{ background:corTema.hex, color:"#fff", padding:"10px 14px", fontWeight:700, fontSize:13 }}>
                        {labelPacote}
                      </div>
                      <div style={{ padding:"14px 16px", background:`${corTema.hex}0d` }}>
                        <div style={{ fontSize:11, color:"#94a3b8", textDecoration:"line-through", marginBottom:2 }}>De {fmtBrl2(totalGeralCI)} (sem desconto)</div>
                        {temImpHTML && <div style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>Desconto calculado sobre valor sem impostos: {fmtBrl2(totalGeralSI)}</div>}
                        <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4 }}>
                          <span style={{ fontWeight:900, fontSize:20, color:"#1e293b" }}>{fmtBrl2(totalCIDisc)}</span>
                          <span style={{ background:`${corTema.hex}22`, color:corTema.hex, fontWeight:700, fontSize:11, borderRadius:4, padding:"2px 7px" }}>{pctDescP}% OFF</span>
                        </div>
                        <div style={{ fontSize:11, color:"#10b981", fontWeight:600, marginBottom:10 }}>
                          Desconto de {fmtBrl2(economia)} ({pctDescP}%){temImpHTML ? ` · Total c/ impostos: ${fmtBrl2(totalCIDisc)}` : ""}
                        </div>
                        <div style={{ background:"#fff", border:`1px solid ${corTema.hex}44`, borderRadius:8, padding:"10px 12px" }}>
                          <div style={{ fontSize:11, color:corTema.hex, fontWeight:700, marginBottom:4 }}>📅 Parcelado em {m.pagamento?.parcelasPacoteCtrt??orc.parcelasPacoteCtrt??8}× — {pctDescP}% de desconto já incluso</div>
                          <div style={{ fontWeight:800, fontSize:16, color:"#1e293b" }}>{fmtBrl2(parcela8x)} × {m.pagamento?.parcelasPacoteCtrt??orc.parcelasPacoteCtrt??8}×</div>
                          <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>Entrada + {(m.pagamento?.parcelasPacoteCtrt??orc.parcelasPacoteCtrt??8)-1} parcelas iguais com desconto incluso</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* Pagamento padrão — cards */}
          {m.pagamento.tipoPagamento !== "etapas" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              {(m.pagamento.opcoes||[]).map((op,i)=>{
                const baseCI   = i===0 ? ((m.servicos||[])[0]?.valor || totalServicos) : totalServicos;
                const baseSI   = temImpHTML ? Math.round(baseCI * semImpHTML * 100)/100 : baseCI;
                const desc     = op.descAntec || 0;
                const nParc    = op.nParcelas || 4;
                // Desconto sobre SEM imposto → reaplica imposto
                const baseSIDisc = Math.round(baseSI*(1-desc/100)*100)/100;
                const economia   = Math.round(baseSI*desc/100*100)/100;
                const comDescCI  = temImpHTML ? Math.round(baseSIDisc/semImpHTML*100)/100 : baseSIDisc;
                const parcela    = Math.round(comDescCI/nParc*100)/100;
                return (
                  <div key={op.id} style={{ border:`2px solid ${corTema.hex}`, borderRadius:10, overflow:"hidden" }}>
                    <div style={{ background: corTema.hex, color:"#fff", padding:"12px 16px", fontWeight:700, fontSize:13 }}>
                      <E val={op.titulo} onSave={v=>{ const ops=[...(m.pagamento.opcoes||[])]; ops[i]={...ops[i],titulo:v}; set("pagamento.opcoes",ops); }} style={{ color:"#fff" }} />
                    </div>
                    <div style={{ padding:"14px 16px", background:`${corTema.hex}0d` }}>
                      <div style={{ fontSize:11, color:"#94a3b8", textDecoration:"line-through", marginBottom:2 }}>De {fmt(baseCI)}</div>
                      {temImpHTML && <div style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>Desc. s/ val. sem impostos: {fmt(baseSI)}</div>}
                      <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4 }}>
                        <span style={{ fontWeight:900, fontSize:20, color:"#1e293b" }}>{fmt(comDescCI)}</span>
                        <span style={{ background:`${corTema.hex}22`, color:corTema.hex, fontWeight:700, fontSize:11, borderRadius:4, padding:"2px 7px" }}>{desc}% OFF</span>
                      </div>
                      <div style={{ fontSize:11, color:"#10b981", fontWeight:600, marginBottom:10 }}>Economia de {fmt(economia)}</div>
                      <div style={{ background:"#fff", border:`1px solid ${corTema.hex}44`, borderRadius:8, padding:"10px 12px" }}>
                        <div style={{ fontSize:11, color:corTema.hex, fontWeight:700, marginBottom:4 }}>📅 Parcelado em {nParc}× — {desc}% de desconto incluso</div>
                        <div style={{ fontWeight:800, fontSize:16, color:"#1e293b" }}>{fmt(parcela)} × {nParc}×</div>
                        <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>Entrada + {nParc-1} parcelas iguais com desconto incluso</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop:16, background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8, padding:"14px 18px" }}>
            <div style={{ fontWeight:700, color:"#15803d", fontSize:13, marginBottom:4 }}>Pagamento via PIX</div>
            <div style={{ color:"#475569", fontSize:12 }}><E val={m.pagamento.pix} onSave={v=>set("pagamento.pix",v)} /></div>
            <div style={{ color:"#64748b", fontSize:11, marginTop:4 }}><E val={m.pagamento.banco} onSave={v=>set("pagamento.banco",v)} /></div>
          </div>
        </div>

        {/* 4. ESCOPO */}
        <div style={secStyle}>
          <div style={secHead}>
            <span style={secTitle}>4. ESCOPO DOS SERVIÇOS</span>
            {m.pagamento.tipoPagamento !== "etapas" && (
              <button style={addBtn} onClick={()=>{ const newId=Date.now(); set("escopo",[...(m.escopo||[]),{id:newId,titulo:"Novo Grupo",itens:[""]}]); }}>+ Grupo</button>
            )}
          </div>

          {/* Escopo por etapas — blocos editáveis */}
          {m.pagamento.tipoPagamento === "etapas" ? (() => {
            const blocos = m.escopoEtapas || [];
            const engItens = m.escopoEng || [];
            // Renumera títulos após inserção/exclusão — preserva texto após ". "
            const renumerar = (arr) => arr.map((b, i) => {
              const semNum = b.titulo?.replace(/^\d+\.\s*/, "") || b.titulo || "";
              return { ...b, titulo: `${i+1}. ${semNum}` };
            });
            const updBloco = (gi, field, val) => {
              const e = JSON.parse(JSON.stringify(blocos));
              e[gi][field] = val;
              set("escopoEtapas", e);
            };
            const updBlocoItem = (gi, field, ii, val) => {
              const e = JSON.parse(JSON.stringify(blocos));
              e[gi][field][ii] = val;
              set("escopoEtapas", e);
            };
            const delBlocoItem = (gi, field, ii) => {
              const e = JSON.parse(JSON.stringify(blocos));
              e[gi][field].splice(ii,1);
              set("escopoEtapas", e);
            };
            const addBlocoItem = (gi, field) => {
              const e = JSON.parse(JSON.stringify(blocos));
              e[gi][field].push("Novo item");
              set("escopoEtapas", e);
            };
            return (
              <div>
                {blocos.map((bloco,gi) => (
                  <div key={bloco.id} style={{ marginBottom:20, border:"1px solid #e2e8f0", borderRadius:10, overflow:"hidden" }}>
                    {/* Título do bloco */}
                    <div style={{ background:corTema.hex, color:"#fff", padding:"10px 16px", display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ flex:1, fontWeight:700, fontSize:13 }}>
                        <E val={bloco.titulo} onSave={v=>updBloco(gi,"titulo",v)} style={{ color:"#fff" }} />
                      </div>
                      {gi >= 4 && <button style={delBtn} onClick={()=>set("escopoEtapas", renumerar(blocos.filter((_,j)=>j!==gi)))}>✕</button>}
                    </div>
                    <div style={{ padding:"14px 16px" }}>
                      {/* Objetivo */}
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>Objetivo</div>
                        <div style={{ fontSize:14, color:"#374151", lineHeight:1.6 }}>
                          <E val={bloco.objetivo} onSave={v=>updBloco(gi,"objetivo",v)} multiline />
                        </div>
                      </div>
                      {/* Serviços Inclusos */}
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6, display:"flex", justifyContent:"space-between" }}>
                          <span>Serviços Inclusos</span>
                          <button style={addBtn} onClick={()=>addBlocoItem(gi,"itens")}>+ item</button>
                        </div>
                        {(bloco.itens||[]).map((it,ii)=>(
                          <div key={ii} style={{ display:"flex", gap:8, fontSize:14, color:"#374151", marginBottom:4, alignItems:"flex-start" }}>
                            <span style={{ color:corTema.hex, flexShrink:0, marginTop:2 }}>•</span>
                            <div style={{ flex:1 }}><E val={it} onSave={v=>updBlocoItem(gi,"itens",ii,v)} multiline /></div>
                            <button style={delBtn} onClick={()=>delBlocoItem(gi,"itens",ii)}>✕</button>
                          </div>
                        ))}
                      </div>
                      {/* Entregáveis */}
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6, display:"flex", justifyContent:"space-between" }}>
                          <span>Entregáveis</span>
                          <button style={addBtn} onClick={()=>addBlocoItem(gi,"entregaveis")}>+ item</button>
                        </div>
                        {(bloco.entregaveis||[]).map((it,ii)=>(
                          <div key={ii} style={{ display:"flex", gap:8, fontSize:14, color:"#374151", marginBottom:4, alignItems:"flex-start" }}>
                            <span style={{ color:corTema.hex, flexShrink:0, marginTop:2 }}>–</span>
                            <div style={{ flex:1 }}><E val={it} onSave={v=>updBlocoItem(gi,"entregaveis",ii,v)} multiline /></div>
                            <button style={delBtn} onClick={()=>delBlocoItem(gi,"entregaveis",ii)}>✕</button>
                          </div>
                        ))}
                      </div>
                      {/* Observação */}
                      <div style={{ background:"#f8fafc", borderRadius:6, padding:"10px 12px", fontSize:13, color:"#64748b", lineHeight:1.5, borderLeft:`3px solid ${corTema.hex}` }}>
                        <E val={bloco.obs} onSave={v=>updBloco(gi,"obs",v)} multiline />
                      </div>
                    </div>
                  </div>
                ))}
                <button style={{ ...addBtn, marginBottom:16 }} onClick={()=>{ const n=blocos.length+1; set("escopoEtapas", renumerar([...blocos,{id:Date.now(),titulo:`${n}. Nova Etapa`,objetivo:"",itens:[""],entregaveis:[""],obs:""}])); }}>+ Etapa</button>

                {/* Engenharia — editável */}
                {incluiEng && (
                  <div style={{ border:"1px solid #e2e8f0", borderRadius:10, overflow:"hidden" }}>
                    <div style={{ background:corTema.hex, color:"#fff", padding:"10px 16px", fontWeight:700, fontSize:13, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span>{blocos.length+1}. Projetos Complementares de Engenharia</span>
                      <button style={addBtn} onClick={()=>set("escopoEng",[...engItens,"Novo item"])}>+ item</button>
                    </div>
                    <div style={{ padding:"14px 16px" }}>
                      {engItens.map((it,ii)=>(
                        <div key={ii} style={{ display:"flex", gap:8, fontSize:14, color:"#374151", marginBottom:4, alignItems:"flex-start" }}>
                          <span style={{ color:corTema.hex, flexShrink:0, marginTop:2 }}>•</span>
                          <div style={{ flex:1 }}><E val={it} onSave={v=>{ const e=[...engItens]; e[ii]=v; set("escopoEng",e); }} multiline /></div>
                          <button style={delBtn} onClick={()=>set("escopoEng",engItens.filter((_,j)=>j!==ii))}>✕</button>
                        </div>
                      ))}
                      <div style={{ marginTop:10, fontSize:13, color:"#94a3b8", fontStyle:"italic", lineHeight:1.5 }}>
                        Obs.: Este item poderá ser contratado diretamente pelo cliente junto a engenheiros terceiros, ficando a compatibilização sob responsabilidade dos profissionais contratados.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })() : (() => {
            /* Escopo padrão — blocos detalhados editáveis (mesmo padrão do escopoEtapas) */
            const blocos = m.escopo || [];
            const engItensP = m.escopoEng || [];
            const updBloco = (gi, field, val) => {
              const e = JSON.parse(JSON.stringify(blocos));
              e[gi][field] = val;
              set("escopo", e);
            };
            const updBlocoItem = (gi, field, ii, val) => {
              const e = JSON.parse(JSON.stringify(blocos));
              e[gi][field][ii] = val;
              set("escopo", e);
            };
            const delBlocoItem = (gi, field, ii) => {
              const e = JSON.parse(JSON.stringify(blocos));
              e[gi][field].splice(ii,1);
              set("escopo", e);
            };
            const addBlocoItem = (gi, field) => {
              const e = JSON.parse(JSON.stringify(blocos));
              e[gi][field] = [...(e[gi][field]||[]), "Novo item"];
              set("escopo", e);
            };
            return (
              <div>
                {blocos.map((bloco,gi) => (
                  <div key={bloco.id||gi} style={{ marginBottom:20, border:"1px solid #e2e8f0", borderRadius:10, overflow:"hidden" }}>
                    <div style={{ background:corTema.hex, color:"#fff", padding:"10px 16px", display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ flex:1, fontWeight:700, fontSize:13 }}>
                        <E val={bloco.titulo} onSave={v=>updBloco(gi,"titulo",v)} style={{ color:"#fff" }} />
                      </div>
                      {gi >= 3 && <button style={delBtn} onClick={()=>{ const renP=(arr)=>arr.map((b,i)=>({...b,titulo:`${i+1}. ${b.titulo?.replace(/^\d+\.\s*/,"")}`})); set("escopo",renP(blocos.filter((_,j)=>j!==gi))); }}>✕</button>}
                    </div>
                    <div style={{ padding:"14px 16px" }}>
                      {bloco.objetivo !== undefined && (
                        <div style={{ marginBottom:12 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>Objetivo</div>
                          <div style={{ fontSize:14, color:"#374151", lineHeight:1.6 }}>
                            <E val={bloco.objetivo||""} onSave={v=>updBloco(gi,"objetivo",v)} multiline />
                          </div>
                        </div>
                      )}
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6, display:"flex", justifyContent:"space-between" }}>
                          <span>Serviços Inclusos</span>
                          <button style={addBtn} onClick={()=>addBlocoItem(gi,"itens")}>+ item</button>
                        </div>
                        {(bloco.itens||[]).map((it,ii)=>(
                          <div key={ii} style={{ display:"flex", gap:8, fontSize:14, color:"#374151", marginBottom:4, alignItems:"flex-start" }}>
                            <span style={{ color:corTema.hex, flexShrink:0, marginTop:2 }}>•</span>
                            <div style={{ flex:1 }}><E val={it} onSave={v=>updBlocoItem(gi,"itens",ii,v)} multiline /></div>
                            <button style={delBtn} onClick={()=>delBlocoItem(gi,"itens",ii)}>✕</button>
                          </div>
                        ))}
                      </div>
                      {bloco.entregaveis !== undefined && (
                        <div style={{ marginBottom:12 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6, display:"flex", justifyContent:"space-between" }}>
                            <span>Entregáveis</span>
                            <button style={addBtn} onClick={()=>addBlocoItem(gi,"entregaveis")}>+ item</button>
                          </div>
                          {(bloco.entregaveis||[]).map((it,ii)=>(
                            <div key={ii} style={{ display:"flex", gap:8, fontSize:14, color:"#374151", marginBottom:4, alignItems:"flex-start" }}>
                              <span style={{ color:corTema.hex, flexShrink:0, marginTop:2 }}>–</span>
                              <div style={{ flex:1 }}><E val={it} onSave={v=>updBlocoItem(gi,"entregaveis",ii,v)} multiline /></div>
                              <button style={delBtn} onClick={()=>delBlocoItem(gi,"entregaveis",ii)}>✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                      {bloco.obs !== undefined && (
                        <div style={{ background:"#f8fafc", borderRadius:6, padding:"10px 12px", fontSize:13, color:"#64748b", lineHeight:1.5, borderLeft:`3px solid ${corTema.hex}` }}>
                          <E val={bloco.obs||""} onSave={v=>updBloco(gi,"obs",v)} multiline />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <button style={{ ...addBtn, marginBottom:16 }} onClick={()=>set("escopo",[...blocos,{id:Date.now(),titulo:`${blocos.length+1}. Novo Bloco`,objetivo:"",itens:[""],entregaveis:[""],obs:""}])}>+ Bloco</button>
                {incluiEng && (
                  <div style={{ border:"1px solid #e2e8f0", borderRadius:10, overflow:"hidden" }}>
                    <div style={{ background:corTema.hex, color:"#fff", padding:"10px 16px", fontWeight:700, fontSize:13, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span>{blocos.length+1}. Projetos Complementares de Engenharia</span>
                      <button style={addBtn} onClick={()=>set("escopoEng",[...engItensP,"Novo item"])}>+ item</button>
                    </div>
                    <div style={{ padding:"14px 16px" }}>
                      {engItensP.map((it,ii)=>(
                        <div key={ii} style={{ display:"flex", gap:8, fontSize:14, color:"#374151", marginBottom:4, alignItems:"flex-start" }}>
                          <span style={{ color:corTema.hex, flexShrink:0, marginTop:2 }}>•</span>
                          <div style={{ flex:1 }}><E val={it} onSave={v=>{ const e=[...engItensP]; e[ii]=v; set("escopoEng",e); }} multiline /></div>
                          <button style={delBtn} onClick={()=>set("escopoEng",engItensP.filter((_,j)=>j!==ii))}>✕</button>
                        </div>
                      ))}
                      <div style={{ marginTop:10, fontSize:13, color:"#94a3b8", fontStyle:"italic", lineHeight:1.5 }}>
                        Obs.: Este item poderá ser contratado diretamente pelo cliente junto a engenheiros terceiros, ficando a compatibilização sob responsabilidade dos profissionais contratados.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* 5. NÃO INCLUSOS */}
        <div style={secStyle}>
          <div style={secHead}>
            <span style={secTitle}>5. SERVIÇOS NÃO INCLUSOS</span>
            <button style={addBtn} onClick={()=>set("naoInclusos",[...(m.naoInclusos||[]),"Novo item"])}>+ item</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
            {(m.naoInclusos||[]).map((item,i)=>(
              <div key={i} style={{ display:"flex", gap:8, fontSize:12, color:"#6b7280", alignItems:"flex-start" }}>
                <span style={{ color:"#ef4444", flexShrink:0, marginTop:2 }}>✕</span>
                <div style={{ flex:1 }}><E val={item} onSave={v=>{ const n=[...(m.naoInclusos||[])]; n[i]=v; set("naoInclusos",n); }} /></div>
                <button style={delBtn} onClick={()=>set("naoInclusos",(m.naoInclusos||[]).filter((_,j)=>j!==i))}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ marginTop:8, fontSize:11, color:"#94a3b8", fontStyle:"italic" }}>
            Obs: Todos os serviços não inclusos podem ser contratados como serviços adicionais.
          </div>
        </div>
        <div style={secStyle}>
          <div style={secHead}>
            <span style={secTitle}>6. PRAZO DE EXECUÇÃO</span>
          </div>
          {(() => {
            const prazoEtapasDefault = [
                "Prazo de 30 dias úteis por etapa, contados após conclusão e aprovação de cada etapa pelo cliente.",
                "Concluída e aprovada cada etapa, inicia-se automaticamente o prazo da etapa seguinte.",
                ...(incluiEng ? ["Projetos de Engenharia: 30 dias úteis após aprovação do projeto na Prefeitura."] : []),
            ];
            const prazoItems = m.pagamento.tipoPagamento === "etapas"
              ? (m.prazoEtapas && m.prazoEtapas.length > 0 ? m.prazoEtapas : prazoEtapasDefault)
              : (m.prazo && m.prazo.length > 0 ? m.prazo : []);
            const prazoKey = m.pagamento.tipoPagamento === "etapas" ? "prazoEtapas" : "prazo";
            return (<>
              {prazoItems.map((item,i)=>(
                <div key={i} style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, padding:"12px 16px", fontSize:13, color:"#92400e", marginBottom:8, display:"flex", gap:8, alignItems:"flex-start" }}>
                  <span style={{ flexShrink:0 }}>⏱</span>
                  <div style={{ flex:1 }}><E val={item} onSave={v=>{ const p=[...prazoItems]; p[i]=v; set(prazoKey,p); }} multiline /></div>
                  {prazoItems.length > 1 && <button style={delBtn} onClick={()=>set(prazoKey,prazoItems.filter((_,j)=>j!==i))}>✕</button>}
                </div>
              ))}
              <button style={addBtn} onClick={()=>set(prazoKey,[...prazoItems,"Novo prazo"])}>+ item</button>
            </>);
          })()}
        </div>

        {/* 7. ACEITE */}
        <div style={secStyle}>
          <div style={secHead}><span style={secTitle}>7. ACEITE DA PROPOSTA</span></div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
            <div>
              <div style={{ borderTop:`1px solid ${corTema.hex}`, paddingTop:8, marginTop:32, fontSize:12, color:"#475569" }}>
                <div>Cliente: {orc.cliente||"___________________________"}</div>
                <div style={{ marginTop:8 }}>Data: _____ / _____ / _________</div>
              </div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:12, color:"#475569", marginBottom:8 }}>Responsável Técnico</div>
              <div style={{ borderTop:`1px solid ${corTema.hex}`, paddingTop:8, marginTop:20 }}>
                <div style={{ fontWeight:700 }}><E val={m.aceite.responsavel} onSave={v=>set("aceite.responsavel",v)} bold /></div>
                <div><E val={m.aceite.registro} onSave={v=>set("aceite.registro",v)} /></div>
                <div style={{ color:"#64748b" }}><E val={m.aceite.cidade} onSave={v=>set("aceite.cidade",v)} />, {m.dataEmissao}</div>
              </div>
            </div>
          </div>
        </div>

        {/* RODAPÉ */}
        <div style={{ borderTop:"1px solid #e2e8f0", marginTop:24, paddingTop:12, textAlign:"center", fontSize:11, color:"#94a3b8" }}>
          <E val={`${m.escritorio.nome}  ·  ${m.escritorio.email}  ·  ${m.escritorio.tel}  ·  ${m.escritorio.social}`}
            onSave={v=>{ /* rodapé composto, não editável diretamente — edite os campos acima */ }} />
        </div>

      </div>
    </div>
  );
}



// ════════════════════════════════════════════════════════════
// orcamento-teste.jsx
// ════════════════════════════════════════════════════════════

function TesteOrcamento({ data, save }) {
  const [orcBase, setOrcBase] = useState(null);

  async function salvarOrcamento(orc) {
    const todos = data.orcamentosProjeto || [];
    const nextId = () => {
      const max = todos.reduce((mx, o) => {
        const m = (o.id || "").match(/^ORC-(\d+)$/);
        return m ? Math.max(mx, parseInt(m[1])) : mx;
      }, 0);
      return "ORC-" + String(max + 1).padStart(4, "0");
    };
    const novo = { ...orc, id: orc.id || nextId(), criadoEm: orc.criadoEm || new Date().toISOString() };
    setOrcBase(novo);
    const novos = orc.id ? todos.map(o => o.id === orc.id ? novo : o) : [...todos, novo];
    save({ ...data, orcamentosProjeto: novos }).catch(console.error);
  }

  return (
    <div style={{ margin:"-24px -28px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        <div style={{ background:"#78350f", border:"1px solid #92400e", borderRadius:8, padding:"6px 14px" }}>
          <span style={{ color:"#fcd34d", fontWeight:800, fontSize:13 }}>🧪 Modo Teste</span>
        </div>
        <div style={{ color:"#475569", fontSize:13 }}>Alterações aqui não afetam o formulário de produção</div>
      </div>
      <FormOrcamentoProjetoTeste
        clienteNome="Teste"
        clienteWA=""
        orcBase={orcBase}
        onSalvar={salvarOrcamento}
        onVoltar={() => setOrcBase(null)}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FORM ORCAMENTO PROJETO — VERSAO TESTE
// ═══════════════════════════════════════════════════════════════
function AreaDetalhe({ calculo, fmtNum }) {
  const [aberto, setAberto] = useState(false);
  const [engAberto, setEngAberto] = useState(false);
  const fmt  = (v) => fmtNum(v);
  const brl  = (v) => v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const m2s  = (v, a) => a > 0 ? ` · R$ ${fmt(Math.round(v/a*100)/100)}/m²` : "";
  const pct  = (v) => (v * 100).toLocaleString("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:0}) + "%";
  const row  = (lbl, val, opts={}) => (
    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:3, ...opts.style }}>
      <span style={{ color: opts.lblColor||"#6b7280" }}>{lbl}</span>
      <span style={{ color: opts.valColor||"#374151", fontWeight: opts.bold?600:400 }}>{val}</span>
    </div>
  );
  return (
    <div style={{ background:"#f9fafb", border:"1px solid #f3f4f6", borderRadius:8, padding:"10px 14px", marginBottom:10, fontSize:13, color:"#374151" }}>
      {/* Linha Área útil */}
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ fontSize:12, color:"#9ca3af" }}>Área útil</span>
        <span style={{ fontSize:13, color:"#374151" }}>{fmt(calculo.areaBruta)} m²</span>
      </div>
      {/* Linha Área total com seta */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:12, color:"#9ca3af" }}>Área total (+circ.)</span>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:13, fontWeight:600, color:"#111" }}>{fmt(calculo.areaTotal)} m²</span>
          <span onClick={() => setAberto(v => !v)}
            style={{ cursor:"pointer", fontSize:11, color:"#9ca3af", userSelect:"none", lineHeight:1 }}>
            {aberto ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* Detalhe expandido */}
      {aberto && (
        <div style={{ marginTop:12, paddingTop:10, borderTop:"1px solid #e5e7eb", display:"flex", flexDirection:"column", gap:5 }}>

          {calculo.isComercial ? (<>
            {/* ── COMERCIAL ── */}
            {row("Área útil", fmt(calculo.areaBruta)+" m²")}
            {row(`+ ${pct(calculo.acrescimoCirk)} Circulação`, `+${fmt(Math.round(calculo.areaBruta*calculo.acrescimoCirk*100)/100)} m²`)}

            {(calculo.blocosCom||[]).map((b,i) => (
              <div key={i} style={{ borderTop:"1px solid #e5e7eb", marginTop:6, paddingTop:6 }}>
                {b.label === "Área Comum" ? (<>
                  {/* Área Comum — só total e R$/m² */}
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontWeight:700, color:"#374151", marginBottom:3 }}>
                    <span>Área Comum · {fmt(b.area1)} m²</span>
                    <span>{brl(b.precoTot)}{m2s(b.precoTot, b.area1)}</span>
                  </div>
                </>) : (<>
                  {/* Cabeçalho do bloco */}
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontWeight:700, color:"#374151", marginBottom:3 }}>
                    <span>{b.n > 1 ? `${b.n} ${b.label}s` : b.label} · {fmt(b.area1)} m² cada · total {fmt(Math.round(b.area1*b.n*100)/100)} m²</span>
                  </div>
                  {/* Preço unitário */}
                  {row(
                    `${b.label} (1ª unid.)`,
                    `${brl(b.precoUni)}${m2s(b.precoUni, b.area1)}`,
                    { bold: false }
                  )}
                  {/* Total */}
                  {b.n > 1 && row(
                    `Total ${b.label}s`,
                    `${brl(b.precoTot)}${m2s(b.precoTot, b.area1*b.n)}`,
                    { bold: true, valColor:"#111" }
                  )}
                </>)}
              </div>
            ))}

            {/* Fachada */}
            {calculo.precoFachada > 0 && (
              <div style={{ borderTop:"1px solid #e5e7eb", marginTop:6, paddingTop:6 }}>
                {row("+15% Fachada", brl(calculo.precoFachada), { bold:false })}
              </div>
            )}

            {/* Engenharia faixas */}
            <div style={{ borderTop:"1px solid #e5e7eb", marginTop:6, paddingTop:6 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1 }}>Engenharia <span style={{ fontSize:8, fontWeight:400, letterSpacing:0, textTransform:"none" }}>(Faixas de desconto)</span></div>
                <span onClick={() => setEngAberto(v => !v)} style={{ cursor:"pointer", fontSize:11, color:"#9ca3af", userSelect:"none" }}>{engAberto ? "▲" : "▼"}</span>
              </div>
              {engAberto && calculo.faixasEng.map((f, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:3 }}>
                  <span style={{ color:"#6b7280" }}>
                    {f.desconto > 0 ? `−${f.desconto.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}% · ` : ""}{fmt(f.area)} m² × R$ {fmt(Math.round(f.fator*50*100)/100)}/m²
                  </span>
                  <span style={{ color:"#374151", fontWeight:500 }}>R$ {fmt(Math.round(f.preco*100)/100)}</span>
                </div>
              ))}
            </div>
          </>) : (<>
            {/* ── NÃO COMERCIAL ── */}
            {calculo.nRep > 1 && row(`Área Total (${calculo.nRep}x)`, `${fmt(calculo.areaTotal)} m² → Total ${fmt(calculo.areaTot)} m²`)}
            {row("Total de ambientes", calculo.totalAmbientes)}
            {row("Área útil", fmt(calculo.areaBruta)+" m²")}
            {calculo.areaPiscina > 0 && row("Piscina (Excluído)", fmt(calculo.areaPiscina)+" m²")}
            {(() => {
              const base = (calculo.areaBruta||0) + (calculo.areaPiscina||0);
              const cirkReal = base > 0 ? Math.round((calculo.areaTotal/base - 1)*100) : 0;
              const vCirk = Math.round(base*(cirkReal/100)*100)/100;
              return row(`+ ${cirkReal}% Circulação e paredes`, `+${fmt(vCirk)} m²`);
            })()}

            <div style={{ borderTop:"1px solid #e5e7eb", marginTop:4, paddingTop:6 }}>
              <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Índice multiplicador</div>
              {row("Qtd de cômodos", calculo.indiceComodos.toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3}))}
              {row("Padrão", calculo.indicePadrao.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1}))}
              {row("Fator multiplicar", `x${calculo.fatorMult.toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3})}`, { bold:true, valColor:"#111" })}
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, borderTop:"1px solid #e5e7eb", paddingTop:6, marginTop:2 }}>
              <span style={{ color:"#6b7280" }}>Preço base</span>
              <span style={{ color:"#374151" }}>{fmt(calculo.precoBaseVal)} × {calculo.fatorMult.toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3})} = {fmt(Math.round(calculo.precoBaseVal*calculo.fatorMult*100)/100)} R$/m²</span>
            </div>

            <div style={{ borderTop:"1px solid #e5e7eb", marginTop:4, paddingTop:6 }}>
              <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Faixa de Desconto — Arquitetura (1ª Unidade)</div>
              {calculo.faixasArqDet.map((f, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:3 }}>
                  <span style={{ color:"#6b7280" }}>{f.desconto > 0 ? `−${pct(f.desconto)} · ` : ""}{fmt(f.area)} m² × R$ {fmt(Math.round(f.precoM2*100)/100)}/m²</span>
                  <span style={{ color:"#374151", fontWeight:500 }}>R$ {fmt(f.preco)}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop:"1px solid #e5e7eb", marginTop:4, paddingTop:6 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1 }}>Engenharia <span style={{ fontSize:8, fontWeight:400, letterSpacing:0 }}>(Faixas de desconto)</span></div>
                <span onClick={() => setEngAberto(v => !v)} style={{ cursor:"pointer", fontSize:11, color:"#9ca3af", userSelect:"none" }}>{engAberto ? "▲" : "▼"}</span>
              </div>
              {engAberto && calculo.faixasEng.map((f, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:3 }}>
                  <span style={{ color:"#6b7280" }}>{f.desconto > 0 ? `−${f.desconto.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}% · ` : ""}{fmt(f.area)} m² × R$ {fmt(Math.round(f.fator*50*100)/100)}/m²</span>
                  <span style={{ color:"#374151", fontWeight:500 }}>R$ {fmt(Math.round(f.preco*100)/100)}</span>
                </div>
              ))}
            </div>
          </>)}

        </div>
      )}
    </div>
  );
}

function ResumoDetalhes({ calculo, fmtNum, C }) {
  const [repAberto, setRepAberto] = useState(false);
  const fmt2   = (v) => v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const m2str  = (v, area) => area > 0 ? ` (R$ ${fmtNum(Math.round(v / area * 100) / 100)}/m²)` : "";
  const hasRep = calculo.nRep > 1;
  return (
    <>
      {/* Arquitetura */}
      <div style={{ ...C.resumoSec, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span>Arquitetura</span>
        {hasRep && (
          <span onClick={() => setRepAberto(v => !v)} style={{ cursor:"pointer", fontSize:13, color:"#9ca3af", userSelect:"none" }}>
            {repAberto ? "▲" : "▼"}
          </span>
        )}
      </div>
      <div style={{ display:"flex", alignItems:"baseline", gap:8, marginTop:4 }}>
        <span style={C.resumoVal}>{fmt2(calculo.precoArq)}</span>
        <span style={C.resumoM2}>R$ {fmtNum(calculo.precoM2Arq)}/m²</span>
      </div>
      {hasRep && repAberto && (
        <div style={{ marginTop:4, borderLeft:"2px solid #f3f4f6", paddingLeft:8 }}>
          {calculo.unidades.map(u => (
            <div key={u.und} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#6b7280", marginTop:3 }}>
              <span>Und {u.und}{u.und > 1 ? ` (${Math.round(calculo.pctRep * 100)}%)` : ""}</span>
              <span>{fmt2(u.arq)}{m2str(u.arq, calculo.areaTotal)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Engenharia */}
      <div style={{ ...C.resumoSec, marginTop:16, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span>Engenharia</span>
      </div>
      <div style={{ display:"flex", alignItems:"baseline", gap:8, marginTop:4 }}>
        <span style={C.resumoVal}>{fmt2(calculo.precoEng)}</span>
        <span style={C.resumoM2}>R$ {fmtNum(calculo.precoM2Eng)}/m²</span>
      </div>
      {hasRep && repAberto && (
        <div style={{ marginTop:4, borderLeft:"2px solid #f3f4f6", paddingLeft:8 }}>
          {calculo.unidades.map(u => (
            <div key={u.und} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#6b7280", marginTop:3 }}>
              <span>Und {u.und}{u.und > 1 ? ` (${Math.round(calculo.pctRep * 100)}%)` : ""}</span>
              <span>{fmt2(u.eng)}{m2str(u.eng, calculo.areaTotal)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Total Geral */}
      <div style={{ marginTop:20, paddingTop:14, borderTop:"1px solid #f3f4f6" }}>
        <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Total Geral</div>
        <div style={{ display:"flex", alignItems:"baseline", gap:8, marginTop:4 }}>
          <span style={{ fontSize:20, fontWeight:800, color:"#111" }}>{fmt2(calculo.precoArq + calculo.precoEng)}</span>
          <span style={C.resumoM2}>R$ {fmtNum(calculo.areaTot > 0 ? Math.round((calculo.precoArq + calculo.precoEng) / calculo.areaTot * 100) / 100 : 0)}/m²</span>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// PROPOSTA PREVIEW — espelho fiel do PDF em HTML
// ═══════════════════════════════════════════════════════════════
function PropostaPreview({ data, onVoltar }) {
  if (!data) return null;
  const { tipoProjeto, tipoObra, padrao, tipologia, tamanho, clienteNome,
          calculo, tipoPgto, temImposto, aliqImp,
          descArq, parcArq, descPacote, parcPacote,
          descEtCtrt, parcEtCtrt, descPacCtrt, parcPacCtrt,
          etapasPct, totSI, totCI, impostoV } = data;

  const fmtV = v => v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const fmtN = v => v.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
  const isPadrao = tipoPgto === "padrao";
  const hoje = new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const dataStr = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
  const validade = new Date(hoje.getTime()+15*86400000).toLocaleDateString("pt-BR");

  const arqCI = temImposto ? Math.round(calculo.precoArq/(1-aliqImp/100)*100)/100 : calculo.precoArq;
  const engCI = temImposto ? Math.round(calculo.precoEng/(1-aliqImp/100)*100)/100 : calculo.precoEng;
  const areaTot = calculo.areaTot || calculo.areaTotal || 0;

  const escopoDefault = [
    { titulo:"1. Estudo de Viabilidade", objetivo:"Analisar o potencial construtivo do terreno e verificar a viabilidade de implantação do empreendimento, considerando as condicionantes físicas, urbanísticas, legais e funcionais aplicáveis ao lote.", itens:["Levantamento inicial e consolidação das informações técnicas do terreno","Análise documental e física do lote, incluindo matrícula, dimensões, topografia e características existentes","Consulta e interpretação dos parâmetros urbanísticos e restrições legais aplicáveis","Verificação da viabilidade construtiva, considerando taxa de ocupação, coeficiente de aproveitamento, recuos obrigatórios, gabarito de altura e demais condicionantes normativas","Estimativa preliminar da área edificável e do potencial de aproveitamento do terreno","Avaliação da melhor ocupação do lote, alinhada ao programa de necessidades do cliente","Definição preliminar da implantação, organização dos acessos, fluxos, circulação, áreas livres e áreas construídas","Estudo de volumetria, análise de inserção no entorno e definição de pontos focais que contribuam para a valorização do empreendimento","Dimensionamento preliminar de estacionamentos, fluxos operacionais e viabilidade de circulação para veículos leves e pesados"], entregaveis:["Estudo técnico de ocupação do terreno, com planta de implantação e setorização preliminar","Esquema conceitual de implantação, incluindo diagramas de organização espacial, acessos e condicionantes do entorno","Representações gráficas, estudo volumétrico em 3D e imagens conceituais","Relatório sintético de viabilidade construtiva, contemplando memorial descritivo, quadro de áreas e síntese dos parâmetros urbanísticos aplicáveis"], obs:"Esta etapa tem como objetivo reduzir riscos e antecipar decisões estratégicas antes do desenvolvimento do projeto, permitindo validar a compatibilidade da proposta com o terreno, com a legislação municipal e com os objetivos do empreendimento." },
    { titulo:"2. Estudo Preliminar", objetivo:"Desenvolver o conceito arquitetônico inicial, organizando os ambientes, a implantação e a linguagem estética do projeto.", itens:["Reunião de briefing e entendimento das necessidades do cliente","Definição do programa de necessidades","Estudo de implantação da edificação no terreno","Desenvolvimento da concepção arquitetônica inicial","Definição preliminar de: layout, fluxos, volumetria, setorização e linguagem estética","Compatibilização entre funcionalidade, conforto, estética e viabilidade construtiva","Ajustes conforme alinhamento com o cliente"], entregaveis:["Planta baixa preliminar","Estudo volumétrico / fachada conceitual","Implantação inicial","Imagens, croquis ou perspectivas conceituais","Apresentação para validação do conceito arquitetônico"], obs:"É nesta etapa que o projeto ganha forma. O estudo preliminar define a essência da proposta e orienta todas as fases seguintes." },
    { titulo:"3. Aprovação na Prefeitura", objetivo:"Adequar e preparar o projeto arquitetônico para protocolo e aprovação junto aos órgãos públicos competentes.", itens:["Adequação do projeto às exigências legais e urbanísticas do município","Elaboração dos desenhos técnicos exigidos para aprovação","Montagem da documentação técnica necessária ao processo","Inserção de informações obrigatórias conforme normas municipais","Preparação de pranchas, quadros de áreas e demais peças gráficas","Apoio técnico durante o processo de aprovação","Atendimento a eventuais comunique-se ou exigências técnicas da prefeitura"], entregaveis:["Projeto legal para aprovação","Plantas, cortes, fachadas e implantação conforme exigência municipal","Quadros de áreas","Arquivos e documentação técnica para protocolo"], obs:"Não inclusos nesta etapa: taxas municipais, emolumentos, ART/RRT, levantamentos complementares, certidões e exigências extraordinárias de órgãos externos, salvo se expressamente previsto." },
    { titulo:"4. Projeto Executivo", objetivo:"Desenvolver o projeto arquitetônico em nível detalhado para execução da obra, fornecendo todas as informações necessárias para construção com precisão.", itens:["Desenvolvimento técnico completo do projeto aprovado","Detalhamento arquitetônico para obra","Definição precisa de: dimensões, níveis, cotas, eixos, paginações, esquadrias, acabamentos e elementos construtivos","Elaboração de desenhos técnicos executivos","Compatibilização arquitetônica com premissas de obra","Apoio técnico para leitura e entendimento do projeto pela equipe executora"], entregaveis:["Planta baixa executiva","Planta de locação e implantação","Planta de cobertura","Cortes e fachadas executivos","Planta de layout e pontos arquitetônicos","Planta de esquadrias e pisos","Detalhamentos construtivos","Quadro de esquadrias e quadro de áreas final"], obs:"É a etapa que transforma a ideia em construção real. Um bom projeto executivo reduz improvisos, retrabalhos e falhas de execução na obra." },
    { titulo:"5. Projetos Complementares de Engenharia", objetivo:"", itens:["Estrutural: lançamento, dimensionamento de vigas, pilares, lajes e fundações","Elétrico: dimensionamento de cargas, circuitos, quadros e pontos","Hidrossanitário: distribuição de pontos de água fria/quente, esgoto e dimensionamento","Compatibilização entre projetos arquitetônico e de engenharia para verificar possíveis interferências"], entregaveis:[], obs:"Obs.: Este item poderá ser contratado diretamente pelo cliente junto a engenheiros terceiros, ficando a compatibilização sob responsabilidade dos profissionais contratados." },
  ];

  const naoInclDefault = [
    "Taxas municipais, emolumentos e registros (CAU/Prefeitura)",
    "Projetos de climatização","Projeto de prevenção de incêndio","Projeto de automação",
    "Projeto de paisagismo","Projeto de interiores","Projeto de Marcenaria (Móveis internos)",
    "Projeto estrutural de estruturas metálicas",
    "Projeto estrutural para muros de contenção (arrimo) acima de 1 m de altura",
    "Sondagem e Planialtimétrico do terreno","Acompanhamento semanal de obra",
    "Gestão e execução de obra","Vistoria para Caixa Econômica Federal","RRT de Execução de obra",
    ...(!temImposto ? ["Impostos"] : []),
  ];

  const prazoDefault = isPadrao
    ? ["Prazo estimado para entrega do Projeto Arquitetônico: 30 dias úteis após aprovação do estudo preliminar.",
       "Prazo estimado para entrega dos Projetos de Engenharia: 30 dias úteis após aprovação na prefeitura."]
    : ["Prazo de 30 dias úteis por etapa, contados após conclusão e aprovação de cada etapa pelo cliente.",
       "Concluída e aprovada cada etapa, inicia-se automaticamente o prazo da etapa seguinte.",
       "Projetos de Engenharia: 30 dias úteis após aprovação do projeto na Prefeitura."];

  const C = "#111827";
  const LT = "#9ca3af";
  const MD = "#6b7280";
  const LN = "#e5e7eb";
  const wrap  = { fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", background:"#fff", minHeight:"100vh", color:C, fontSize:13 };
  const page  = { maxWidth:860, margin:"0 auto", padding:"32px 40px 80px" };
  const secH  = (mt=28) => ({ display:"flex", alignItems:"center", gap:12, margin:`${mt}px 0 14px` });
  const secL  = { fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", color:LT, fontWeight:600, whiteSpace:"nowrap" };
  const secLn = { flex:1, height:1, background:LN };
  const tag   = { fontSize:10, fontWeight:600, color:LT, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5, marginTop:10 };
  const bl    = { display:"flex", gap:8, marginBottom:4 };
  const dot   = { color:LT, flexShrink:0 };

  const Sec = ({title, mt, children}) => (
    <div>
      <div style={secH(mt)}>
        <span style={secL}>{title}</span>
        <div style={secLn} />
      </div>
      {children}
    </div>
  );

  const Row = ({label, value, sub}) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
      <span style={{ fontSize:13, color:MD }}>{label}</span>
      <div style={{ textAlign:"right" }}>
        <span style={{ fontSize:13, fontWeight:500, color:C }}>{value}</span>
        {sub && <div style={{ fontSize:11, color:LT }}>{sub}</div>}
      </div>
    </div>
  );

  // QR SVG simples
  const QR = () => (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="16" height="16" rx="1.5" stroke={C} strokeWidth="1.5" fill="none"/>
      <rect x="5.5" y="5.5" width="9" height="9" rx="0.5" fill={C}/>
      <rect x="26" y="2" width="16" height="16" rx="1.5" stroke={C} strokeWidth="1.5" fill="none"/>
      <rect x="29.5" y="5.5" width="9" height="9" rx="0.5" fill={C}/>
      <rect x="2" y="26" width="16" height="16" rx="1.5" stroke={C} strokeWidth="1.5" fill="none"/>
      <rect x="5.5" y="29.5" width="9" height="9" rx="0.5" fill={C}/>
      <rect x="26" y="26" width="5" height="5" fill={C}/>
      <rect x="33" y="26" width="5" height="5" fill={C}/>
      <rect x="26" y="33" width="5" height="5" fill={C}/>
      <rect x="33" y="33" width="5" height="5" fill={C}/>
      <rect x="40" y="26" width="2" height="2" fill={C}/>
      <rect x="40" y="33" width="2" height="2" fill={C}/>
      <rect x="26" y="40" width="5" height="2" fill={C}/>
      <rect x="40" y="40" width="2" height="2" fill={C}/>
    </svg>
  );

  const handlePdf = async () => {
    if (!window.jspdf) { alert("Aguarde 2s e tente novamente."); return; }
    try {
      const c = data.calculo;
      const nUnid = c.nRep || 1;
      const arqTotal = arqCI;
      const engTotal = engCI;
      const grandTotal = totCI;
      const engUnit = engCI;
      const r = { areaTotal: areaTot, areaBruta: c.areaBruta||0, nUnidades: nUnid, precoFinal: arqTotal, precoTotal: arqTotal, engTotal, impostoAplicado: temImposto, aliquotaImposto: aliqImp };
      const fmt   = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
      const fmtM2 = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+" m²";
      const orc = { id:"teste-"+Date.now(), cliente:data.clienteNome||"Cliente", tipo:data.tipoProjeto, subtipo:data.tipoObra, padrao:data.padrao, tipologia:data.tipologia, tamanho:data.tamanho, comodos:data.comodos||[], tipoPagamento:data.tipoPgto, descontoEtapa:data.descArq, parcelasEtapa:data.parcArq, descontoPacote:data.descPacote, parcelasPacote:data.parcPacote, descontoEtapaCtrt:data.descEtCtrt, parcelasEtapaCtrt:data.parcEtCtrt, descontoPacoteCtrt:data.descPacCtrt, parcelasPacoteCtrt:data.parcPacCtrt, etapasPct:data.etapasPct, incluiImposto:data.temImposto, aliquotaImposto:data.aliqImp, criadoEm:new Date().toISOString(), resultado:r };
      const modelo = defaultModelo(orc, arqTotal, engTotal, grandTotal, fmt, fmtM2, nUnid, engUnit, r);
      // Usar resumo gerado no preview (mais preciso para comercial)
      if (data.resumoDescritivo && modelo.cliente) modelo.cliente.resumo = data.resumoDescritivo;
      let logoData = null;
      try { const lr = await window.storage.get("escritorio-logo"); if (lr?.value) logoData = lr.value; } catch {}
      await buildPdf(orc, logoData, modelo, null, "#ffffff", true, true);
    } catch(e) { console.error(e); alert("Erro ao gerar PDF: "+e.message); }
  };

  return (
    <div style={wrap}>
      <div style={page}>

        {/* Toolbar */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:36 }}>
          <button onClick={onVoltar} style={{ background:"none", border:`1px solid ${LN}`, borderRadius:8, padding:"7px 14px", fontSize:13, cursor:"pointer", fontFamily:"inherit", color:MD }}>
            ← Voltar
          </button>
          <button onClick={handlePdf} style={{ background:C, border:"none", borderRadius:8, padding:"8px 22px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", color:"#fff" }}>
            Gerar PDF
          </button>
        </div>

        {/* Cabeçalho */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ background:C, borderRadius:6, width:80, height:44, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ color:"#fff", fontSize:9, fontWeight:700, textAlign:"center", lineHeight:1.5, letterSpacing:"0.05em" }}>PADOVAN<br/><span style={{ letterSpacing:"0.15em" }}>ARQ</span>UITETOS</div>
          </div>
          <div style={{ fontSize:11, color:LT }}>Ourinhos, {dataStr} · Válido até {validade}</div>
        </div>

        {/* Nome + Total */}
        <div style={{ borderTop:`1.5px solid ${C}`, borderBottom:`0.5px solid ${LN}`, padding:"12px 0", marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
          <div>
            <div style={{ fontSize:24, fontWeight:600, color:C }}>{clienteNome || "Cliente"}</div>
            <div style={{ fontSize:10, color:LT, marginTop:3, letterSpacing:"0.04em" }}>Proposta Comercial de Projetos de Arquitetura e Engenharia</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ display:"flex", alignItems:"baseline", justifyContent:"flex-end", gap:6 }}>
              <span style={{ fontSize:10, color:LT }}>Apenas Arquitetura</span>
              <span style={{ fontSize:22, fontWeight:600, color:C }}>{fmtV(arqCI)}</span>
            </div>
            <div style={{ fontSize:11, color:LT }}>{areaTot > 0 ? `R$ ${fmtN(Math.round(arqCI/areaTot*100)/100)}/m²` : ""}</div>
          </div>
        </div>

        {/* Resumo descritivo */}
        {data.resumoDescritivo && (
          <div style={{ fontSize:13, color:MD, lineHeight:1.7, marginBottom:20 }}>{data.resumoDescritivo}</div>
        )}

        {/* Valores */}
        <Sec title="Valores dos projetos" mt={0}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 0.5px 1fr", gap:0, marginBottom:12 }}>
            <div style={{ paddingRight:20 }}>
              <div style={tag}>Arquitetura</div>
              <div style={{ fontSize:20, fontWeight:600, color:C }}>{fmtV(arqCI)}</div>
              <div style={{ fontSize:11, color:LT }}>{areaTot > 0 ? `R$ ${fmtN(Math.round(arqCI/areaTot*100)/100)}/m²` : ""}</div>
            </div>
            <div style={{ background:LN }} />
            <div style={{ paddingLeft:20 }}>
              <div style={tag}>Engenharia <span style={{ fontSize:10, color:LT, textTransform:"none", letterSpacing:0 }}>(Opcional)</span></div>
              <div style={{ fontSize:20, fontWeight:600, color:C }}>{fmtV(engCI)}</div>
              <div style={{ fontSize:11, color:LT }}>{areaTot > 0 ? `R$ ${fmtN(Math.round(engCI/areaTot*100)/100)}/m²` : ""}</div>
            </div>
          </div>
          <div style={{ border:`0.5px solid ${LN}`, borderRadius:8, padding:"8px 14px", fontSize:12, color:LT, marginBottom:4 }}>
            {temImposto ? (<>
              + Impostos — <span style={{ color:MD, fontWeight:500 }}>{fmtV(impostoV)}</span>
              &nbsp;·&nbsp; Total com impostos — <span style={{ fontSize:13, fontWeight:600, color:C }}>{fmtV(totCI)}</span>
            </>) : (<>
              Total sem impostos — <span style={{ fontSize:13, fontWeight:600, color:C }}>{fmtV(totCI)}</span>
            </>)}
          </div>
        </Sec>

        {/* Pagamento */}
        <Sec title={isPadrao ? "Formas de pagamento" : "Contratação por etapa"}>
          {isPadrao ? (<>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:6 }}>Apenas Arquitetura</div>
              <div style={{ fontSize:13, color:MD, marginBottom:3 }}>Antecipado ({descArq}% de desconto) — {fmtV(Math.round(arqCI*(1-descArq/100)*100)/100)}</div>
              <div style={{ fontSize:13, color:MD }}>Parcelado {parcArq}× — {fmtV(Math.round(arqCI/parcArq*100)/100)}/mês</div>
            </div>
            <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:12, marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:6 }}>Pacote Completo (Arq. + Eng.)</div>
              <div style={{ fontSize:13, color:MD, marginBottom:3 }}>De {fmtV(totCI)} por apenas: <strong style={{ color:C }}>{fmtV(Math.round(totCI*(1-descPacote/100)*100)/100)}</strong></div>
              <div style={{ fontSize:11, color:LT }}>Desconto de {fmtV(Math.round(totCI*descPacote/100*100)/100)} ({descPacote}%) · Parcelado {parcPacote}× de {fmtV(Math.round(totCI*(1-descPacote/100)/parcPacote*100)/100)} c/ desconto</div>
            </div>
          </>) : (<>
            {/* Tabela etapas */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 70px 140px", paddingBottom:6, borderBottom:`1.5px solid ${C}` }}>
                <span style={{ fontSize:10, fontWeight:600, color:C, textTransform:"uppercase", letterSpacing:"0.06em" }}>Etapa</span>
                <span style={{ fontSize:10, fontWeight:600, color:C, textTransform:"uppercase", letterSpacing:"0.06em", textAlign:"center" }}>%</span>
                <span style={{ fontSize:10, fontWeight:600, color:C, textTransform:"uppercase", letterSpacing:"0.06em", textAlign:"right" }}>Valor</span>
              </div>
              {etapasPct.map((et,i) => (
                <div key={et.id} style={{ display:"grid", gridTemplateColumns:"1fr 70px 140px", padding:"7px 0", borderBottom:`0.5px solid ${LN}` }}>
                  <span style={{ color:C }}>{et.nome}</span>
                  <span style={{ color:LT, textAlign:"center" }}>{et.pct}%</span>
                  <span style={{ fontWeight:500, textAlign:"right" }}>{fmtV(Math.round(totCI*et.pct/100*100)/100)}</span>
                </div>
              ))}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 70px 140px", padding:"7px 0", borderBottom:`0.5px solid ${LN}` }}>
                <div>
                  <div style={{ color:C }}>Projetos de Engenharia</div>
                  <div style={{ fontSize:11, color:LT }}>Estrutural · Elétrico · Hidrossanitário</div>
                </div>
                <span style={{ color:LT, textAlign:"center" }}>—</span>
                <span style={{ fontWeight:500, textAlign:"right" }}>{fmtV(engCI)}</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 70px 140px", padding:"8px 0", borderTop:`1.5px solid ${C}`, marginTop:2 }}>
                <span style={{ fontWeight:600, color:C }}>Total</span>
                <span style={{ fontWeight:600, color:C, textAlign:"center" }}>{etapasPct.reduce((s,e)=>s+e.pct,0)}%</span>
                <span style={{ fontSize:15, fontWeight:700, color:C, textAlign:"right" }}>{fmtV(totCI)}</span>
              </div>
            </div>
            <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:10, marginBottom:10 }}>
              <div style={secH(0)}>
                <span style={secL}>Forma de Pagamento</span>
                <div style={secLn} />
              </div>
              <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between" }}>
                <div style={{ fontSize:12, fontWeight:600, color:C }}>Etapa a Etapa</div>
                <span style={{ fontSize:10, color:LT }}>{"Obs.: Nesta opção valores de etapas futuras podem ser reajustados."}</span>
              </div>
              <div style={{ fontSize:13, color:MD, marginBottom:5 }}>Opção 1: Antecipado por etapa ({descEtCtrt}% de desconto)</div>
              <div style={{ fontSize:13, color:MD }}>Opção 2: Parcelado {parcEtCtrt}× por etapa</div>
            </div>
            <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:10, marginBottom:10 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:5 }}>Pacote Completo (Arq. + Eng.)</div>
              <div style={{ fontSize:13, color:MD, marginBottom:3 }}>De {fmtV(totCI)} por apenas: <strong style={{ color:C }}>{fmtV(Math.round(totCI*(1-descPacCtrt/100)*100)/100)}</strong></div>
              <div style={{ fontSize:11, color:LT }}>Desconto de {fmtV(Math.round(totCI*descPacCtrt/100*100)/100)} ({descPacCtrt}%) · Parcelado {parcPacCtrt}× de {fmtV(Math.round(totCI*(1-descPacCtrt/100)/parcPacCtrt*100)/100)}</div>
            </div>
          </>)}
          <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:10, fontSize:11, color:LT }}>
            PIX · Chave CNPJ: 36.122.417/0001-74 — Leo Padovan Projetos e Construções · Banco Sicoob
          </div>
        </Sec>

        {/* Escopo */}
        <Sec title="Escopo dos serviços">
          {escopoDefault.map((bloco, i) => (
            <div key={i} style={{ marginBottom:18 }}>
              <div style={{ fontSize:13, fontWeight:600, color:C, marginBottom:6 }}>{bloco.titulo}</div>
              {bloco.objetivo && <>
                <div style={tag}>Objetivo</div>
                <p style={{ fontSize:13, color:MD, lineHeight:1.7, margin:"0 0 8px" }}>{bloco.objetivo}</p>
              </>}
              {bloco.itens.length > 0 && <>
                <div style={tag}>Serviços inclusos</div>
                {bloco.itens.map((it,j) => (
                  <div key={j} style={bl}><span style={dot}>•</span><span style={{ fontSize:13, color:MD, lineHeight:1.6 }}>{it}</span></div>
                ))}
              </>}
              {bloco.entregaveis.length > 0 && <>
                <div style={tag}>Entregáveis</div>
                {bloco.entregaveis.map((it,j) => (
                  <div key={j} style={bl}><span style={dot}>•</span><span style={{ fontSize:13, color:MD, lineHeight:1.6 }}>{it}</span></div>
                ))}
              </>}
              {bloco.obs && <div style={{ fontSize:12, color:LT, marginTop:8, lineHeight:1.6, fontStyle:"italic" }}>{bloco.obs}</div>}
              {i < escopoDefault.length-1 && <div style={{ borderBottom:`0.5px solid ${LN}`, marginTop:14 }} />}
            </div>
          ))}
        </Sec>

        {/* Não Inclusos */}
        <Sec title="Serviços não inclusos">
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"3px 32px", marginBottom:8 }}>
            {naoInclDefault.map((item, i) => (
              <div key={i} style={bl}><span style={dot}>•</span><span style={{ fontSize:13, color:MD }}>{item}</span></div>
            ))}
          </div>
          <div style={{ fontSize:12, color:LT, fontStyle:"italic" }}>Todos os serviços não inclusos podem ser contratados como serviços adicionais.</div>
        </Sec>

        {/* Prazo */}
        <Sec title="Prazo de execução">
          {prazoDefault.map((p, i) => (
            <div key={i} style={{ ...bl, marginBottom:6 }}><span style={dot}>•</span><span style={{ fontSize:13, color:MD, lineHeight:1.6 }}>{p}</span></div>
          ))}
        </Sec>

        {/* Aceite */}
        <Sec title="Aceite da proposta">
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:32, marginTop:8 }}>
            <div>
              <div style={{ fontSize:10, fontWeight:600, color:LT, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Cliente</div>
              <div style={{ fontSize:14, fontWeight:600, color:C, marginBottom:32 }}>{clienteNome || "—"}</div>
              <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:6, display:"flex", justifyContent:"space-between", fontSize:11, color:LT }}>
                <span>Assinatura</span><span>Data: _____ / _____ / _______</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:600, color:LT, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Responsável técnico</div>
              <div style={{ fontSize:14, fontWeight:600, color:C, marginBottom:4 }}>Arq. Leonardo Padovan</div>
              <div style={{ fontSize:12, color:LT, marginBottom:20 }}>CAU A30278-3 · Ourinhos</div>
              <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:6, display:"flex", justifyContent:"space-between", fontSize:11, color:LT }}>
                <span>Assinatura</span><span>{dataStr}</span>
              </div>
            </div>
          </div>
        </Sec>

        {/* Rodapé com QR */}
        <div style={{ borderTop:`0.5px solid ${LN}`, marginTop:48, paddingTop:14, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:11, color:LT }}>
            <span>Padovan Arquitetos</span><span>·</span>
            <span>leopadovan.arq@gmail.com</span><span>·</span>
            <span>(14) 99767-4200</span><span>·</span>
            <span>@padovan_arquitetos</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
            <div style={{ width:46, height:46, border:`0.5px solid ${LN}`, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", padding:3 }}>
              <svg width="36" height="36" viewBox="0 0 44 44" fill="none">
                <rect x="2" y="2" width="16" height="16" rx="1.5" stroke={C} strokeWidth="1.5" fill="none"/>
                <rect x="5.5" y="5.5" width="9" height="9" rx="0.5" fill={C}/>
                <rect x="26" y="2" width="16" height="16" rx="1.5" stroke={C} strokeWidth="1.5" fill="none"/>
                <rect x="29.5" y="5.5" width="9" height="9" rx="0.5" fill={C}/>
                <rect x="2" y="26" width="16" height="16" rx="1.5" stroke={C} strokeWidth="1.5" fill="none"/>
                <rect x="5.5" y="29.5" width="9" height="9" rx="0.5" fill={C}/>
                <rect x="26" y="26" width="5" height="5" fill={C}/>
                <rect x="33" y="26" width="5" height="5" fill={C}/>
                <rect x="26" y="33" width="5" height="5" fill={C}/>
                <rect x="33" y="33" width="5" height="5" fill={C}/>
                <rect x="40" y="26" width="2" height="2" fill={C}/>
                <rect x="40" y="33" width="2" height="2" fill={C}/>
                <rect x="26" y="40" width="5" height="2" fill={C}/>
                <rect x="40" y="40" width="2" height="2" fill={C}/>
              </svg>
            </div>
            <div style={{ fontSize:10, color:LT, lineHeight:1.5 }}>Instagram<br/>@padovan_arquitetos</div>
          </div>
        </div>

      </div>
    </div>
  );
}

function FormOrcamentoProjetoTeste({ onSalvar, orcBase, clienteNome, clienteWA, onVoltar }) {
  const [referencia,   setReferencia]   = useState(orcBase?.referencia  || "");
  const [tipoObra,     setTipoObra]     = useState(orcBase?.subtipo     || null);
  const [tipoProjeto,  setTipoProjeto]  = useState(orcBase?.tipo        || null);
  const [padrao,       setPadrao]       = useState(orcBase?.padrao      || null);
  const [tipologia,    setTipologia]    = useState(orcBase?.tipologia   || null);
  const [tamanho,      setTamanho]      = useState(orcBase?.tamanho     || null);
  const [aberto,       setAberto]       = useState(null);
  const [panelPos,     setPanelPos]     = useState({ top:0, left:0 });
  const [showModal,     setShowModal]     = useState(false);
  const [propostaData,  setPropostaData]  = useState(null); // quando definido, abre o preview
  const [tipoPgto,      setTipoPgto]      = useState("padrao"); // "padrao" | "etapas"
  const [temImposto,    setTemImposto]    = useState(false);
  const [aliqImp,       setAliqImp]       = useState(16);
  const [descArq,       setDescArq]       = useState(5);
  const [parcArq,       setParcArq]       = useState(3);
  const [descPacote,    setDescPacote]    = useState(10);
  const [parcPacote,    setParcPacote]    = useState(4);
  const [descEtCtrt,    setDescEtCtrt]    = useState(5);
  const [parcEtCtrt,    setParcEtCtrt]    = useState(2);
  const [descPacCtrt,   setDescPacCtrt]   = useState(15);
  const [parcPacCtrt,   setParcPacCtrt]   = useState(8);
  const [etapasPct, setEtapasPct] = useState([
    { id:1, nome:"Estudo de Viabilidade",  pct:10 },
    { id:2, nome:"Estudo Preliminar",      pct:30 },
    { id:3, nome:"Aprovação na Prefeitura",pct:12 },
    { id:4, nome:"Projeto Executivo",      pct:38 },
    { id:5, nome:"Engenharia",             pct:10 },
  ]);
  const [qtdRep, setQtdRep] = useState(orcBase?.repeticao ? (orcBase?.nUnidades || 2) : 0);

  // Parâmetros independentes por grupo comercial
  const GRUPOS_COMERCIAIS = ["Por Loja","Espaço Âncora","Áreas Comuns","Por Apartamento","Galpao"];
  const [grupoParams, setGrupoParams] = useState(() => {
    const init = {};
    const p  = orcBase?.padrao    || "Médio";
    const ti = orcBase?.tipologia || "Térreo";
    const ta = orcBase?.tamanho   || "Médio";
    GRUPOS_COMERCIAIS.forEach(g => { init[g] = { padrao:p, tipologia:ti, tamanho:ta }; });
    return init;
  });
  const [abertoGrupo, setAbertoGrupo] = useState(null); // { grupo, param, top, left }

  // Sincroniza grupoParams quando parâmetros globais mudam
  useEffect(() => {
    if (!padrao && !tipologia && !tamanho) return;
    setGrupoParams(prev => {
      const next = {};
      GRUPOS_COMERCIAIS.forEach(g => {
        next[g] = {
          padrao:   padrao   || prev[g]?.padrao   || "Médio",
          tipologia: tipologia || prev[g]?.tipologia || "Térreo",
          tamanho:  tamanho  || prev[g]?.tamanho  || "Médio",
        };
      });
      return next;
    });
  }, [padrao, tipologia, tamanho]);

  function setGrupoParam(grupo, key, val) {
    setGrupoParams(prev => ({ ...prev, [grupo]: { ...prev[grupo], [key]: val } }));
    setAbertoGrupo(null);
  }
  const isComercial = tipoProjeto === "Conj. Comercial";
  // Qtd de repetições por grupo (nLojas, nAncoras, etc.)
  const [grupoQtds, setGrupoQtds] = useState({
    "Por Loja": 0, "Espaço Âncora": 0, "Áreas Comuns": 0, "Por Apartamento": 0, "Galpao": 0,
  });

  function setGrupoQtd(grupo, delta) {
    setGrupoQtds(prev => ({ ...prev, [grupo]: Math.max(0, (prev[grupo] || 0) + delta) }));
  }

  // Mapeia tipoProjeto → chave getComodosConfig
  function tipoParaConfig(tp) {
    if (tp === "Clínica")          return "Clínica";
    if (tp === "Conj. Comercial")  return "Comercial";
    if (tp === "Galpão")           return "Galpao";
    return tp || "Residencial";
  }

  const configAtual = useMemo(() => {
    if (!tipoProjeto) return null;
    return getComodosConfig(tipoParaConfig(tipoProjeto));
  }, [tipoProjeto]);

  // qtds: { nomeCômodo: número }
  const [qtds, setQtds] = useState(() => {
    if (!orcBase?.comodos) return {};
    return Object.fromEntries(orcBase.comodos.map(c => [c.nome, c.qtd]));
  });

  // Reset qtds ao mudar tipo de projeto
  useEffect(() => { setQtds({}); }, [tipoProjeto]);

  // Fechar dropdown ao clicar fora
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!aberto && !abertoGrupo) return;
    const h = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setAberto(null);
        setAbertoGrupo(null);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [aberto, abertoGrupo]);

  const OPCOES = {
    tipoObra:    ["Construção nova", "Reforma"],
    tipoProjeto: ["Residencial", "Clínica", "Conj. Comercial", "Galpão", "Empreendimento"],
    padrao:      ["Alto", "Médio", "Baixo"],
    tipologia:   ["Térreo", "Sobrado"],
    tamanho:     ["Grande", "Médio", "Pequeno", "Compacta"],
  };

  const VALS   = { tipoObra, tipoProjeto, padrao, tipologia, tamanho };
  const LABELS = { tipoObra:"Tipo Obra", tipoProjeto:"Tipo Projeto", padrao:"Padrão", tipologia:"Tipologia", tamanho:"Tamanho" };
  const SETS   = { tipoObra:setTipoObra, tipoProjeto:setTipoProjeto, padrao:setPadrao, tipologia:setTipologia, tamanho:setTamanho };

  function selecionar(key, val) { SETS[key](val); setAberto(null); }

  // Mapa cômodo → grupo (recalculado quando configAtual muda)
  const grupoDeComodo = useMemo(() => {
    const map = {};
    if (configAtual?.grupos) {
      Object.entries(configAtual.grupos).forEach(([grupo, nomes]) => {
        nomes.forEach(nome => { map[nome] = grupo; });
      });
    }
    return map;
  }, [configAtual]);

  // ── Cálculo live ────────────────────────────────────────────
  const calculo = useMemo(() => {
    if (!configAtual || !tamanho || !padrao) return null;
    const { comodos: COMODOS_USE } = configAtual;
    const tcfg = getTipoConfig(tipoParaConfig(tipoProjeto));
    const pb = tcfg.precoBase;

    // ── COMERCIAL — lógica fiel ao FormOrcamentoProjeto ──────────
    if (isComercial) {
      const nomesLoja   = Object.keys(COMODOS_GALERIA_LOJA);
      const nomesAncora = Object.keys(COMODOS_GALERIA_ANCORA);
      const nomesComum  = Object.keys(COMODOS_GALERIA_COMUM);
      const nomesApto   = Object.keys(COMODOS_GALERIA_APTO);
      const nomesGalpao = Object.keys(COMODOS_GALPAO);

      const nLojas   = grupoQtds["Por Loja"]        || 0;
      const nAncoras = grupoQtds["Espaço Âncora"]   || 0;
      const nComum   = grupoQtds["Áreas Comuns"]    || 0;
      const nAptos   = grupoQtds["Por Apartamento"] || 0;
      const nGalpoes = grupoQtds["Galpao"]           || 0;

      const gpLoja   = grupoParams["Por Loja"]        || {};
      const gpAnc    = grupoParams["Espaço Âncora"]   || {};
      const gpComum  = grupoParams["Áreas Comuns"]    || {};
      const gpApto   = grupoParams["Por Apartamento"] || {};
      const gpGalpao = grupoParams["Galpao"]           || {};

      const tamLoja   = gpLoja.tamanho   || tamanho;
      const tamAnc    = gpAnc.tamanho    || tamanho;
      const tamComum  = gpComum.tamanho  || tamanho;
      const tamApto   = gpApto.tamanho   || tamanho;
      const tamGalpao = gpGalpao.tamanho || tamanho;

      const ipLoja   = INDICE_PADRAO[gpLoja.padrao   || padrao] || 0;
      const ipAnc    = INDICE_PADRAO[gpAnc.padrao    || padrao] || 0;
      const ipComum  = INDICE_PADRAO[gpComum.padrao  || padrao] || 0;
      const ipApto   = INDICE_PADRAO[gpApto.padrao   || padrao] || 0;
      const ipGalpao = INDICE_PADRAO[gpGalpao.padrao || padrao] || 0;

      // Área e índice de 1 unidade de cada tipo
      const calcBloco = (nomes, tam, ip) => {
        let ab = 0, ic = 0;
        nomes.forEach(nome => {
          const cfg2 = COMODOS_USE[nome]; if (!cfg2) return;
          const qtd2 = qtds[nome] || 0;
          if (qtd2 <= 0) return;
          const [L, W_] = cfg2.medidas[tam] || [0,0];
          ab += L * W_ * qtd2;
          ic += (cfg2.indice || 0) * qtd2;
        });
        return { ab, ic, fator: ic + ip + 1 };
      };

      const bLoja   = calcBloco(nomesLoja,   tamLoja,   ipLoja);
      const bAnc    = calcBloco(nomesAncora,  tamAnc,    ipAnc);
      const bComum  = calcBloco(nomesComum,   tamComum,  ipComum);
      const bApto   = calcBloco(nomesApto,    tamApto,   ipApto);
      const bGalpao = calcBloco(nomesGalpao,  tamGalpao, ipGalpao);

      const atLoja1   = bLoja.ab   * (1 + ACRESCIMO_AREA);
      const atAnc1    = bAnc.ab    * (1 + ACRESCIMO_AREA);
      const atComum   = bComum.ab  * (1 + ACRESCIMO_AREA);
      const atApto1   = bApto.ab   * (1 + ACRESCIMO_AREA);
      const atGalpao1 = bGalpao.ab * (1 + 0.10);

      const calcFaixas = (area, fator, isAnc=false) => {
        const faixasDef = isAnc
          ? [{ate:300,d:0},{ate:500,d:.30},{ate:700,d:.35},{ate:1000,d:.40},{ate:Infinity,d:.45}]
          : [{ate:200,d:0},{ate:300,d:.30},{ate:400,d:.35},{ate:500,d:.40},{ate:600,d:.45},{ate:Infinity,d:.50}];
        let total=0, rest=area, acum=0;
        for (const f of faixasDef) {
          if (rest<=0) break;
          const chunk = Math.min(rest, f.ate-acum);
          total += pb * chunk * fator * (1-f.d);
          rest -= chunk; acum = f.ate;
        }
        return Math.round(total*100)/100;
      };

      const calcRep = (precoUni, area1, n) => {
        let total=precoUni, acum=area1;
        for (let i=2; i<=n; i++) {
          acum += area1;
          const pct = acum<1000?0.25:acum<2000?0.20:0.15;
          total += precoUni*pct;
        }
        return Math.round(total*100)/100;
      };

      const p1Loja   = atLoja1  >0 ? calcFaixas(atLoja1,  bLoja.fator)       : 0;
      const p1Anc    = atAnc1   >0 ? calcFaixas(atAnc1,   bAnc.fator,  true) : 0;
      const p1Comum  =               calcFaixas(atComum,  bComum.fator);
      const p1Apto   = atApto1  >0 ? calcFaixas(atApto1,  bApto.fator)       : 0;
      const p1Galpao = atGalpao1>0 ? calcFaixas(atGalpao1,bGalpao.fator)     : 0;

      const pLojas   = nLojas  >0&&atLoja1  >0 ? calcRep(p1Loja,   atLoja1,   nLojas)   : 0;
      const pAncoras = nAncoras>0&&atAnc1   >0 ? calcRep(p1Anc,    atAnc1,    nAncoras) : 0;
      const pAptos   = nAptos  >0&&atApto1  >0 ? calcRep(p1Apto,   atApto1,   nAptos)   : 0;
      const pGalpoes = nGalpoes>0&&atGalpao1>0 ? calcRep(p1Galpao, atGalpao1, nGalpoes) : 0;

      const precoSemFach = pLojas+pAncoras+p1Comum+pAptos+pGalpoes;
      const precoArq1 = Math.round((precoSemFach*(1+INDICE_FACHADA_GALERIA))*100)/100;
      const areaTot   = atLoja1*nLojas + atAnc1*nAncoras + atComum + atApto1*nAptos + atGalpao1*nGalpoes;
      const engCalc   = calcularEngenharia(areaTot);
      const precoEng1 = Math.round(engCalc.totalEng*100)/100;
      const nRep=1, pctRep=0.25;
      const unidades=[{und:1,arq:precoArq1,eng:precoEng1}];
      const precoFachada = Math.round((pLojas+pAncoras+p1Comum+pAptos+pGalpoes)*INDICE_FACHADA_GALERIA*100)/100;
      const blocosCom = [
        nLojas   >0&&atLoja1  >0 ? {label:"Loja",         n:nLojas,   area1:atLoja1,   precoUni:p1Loja,   precoTot:pLojas}   : null,
        nAncoras >0&&atAnc1   >0 ? {label:"Âncora",       n:nAncoras, area1:atAnc1,    precoUni:p1Anc,    precoTot:pAncoras} : null,
        atComum  >0              ? {label:"Área Comum",    n:1,        area1:atComum,   precoUni:p1Comum,  precoTot:p1Comum}  : null,
        nAptos   >0&&atApto1  >0 ? {label:"Apartamento",  n:nAptos,   area1:atApto1,   precoUni:p1Apto,   precoTot:pAptos}   : null,
        nGalpoes >0&&atGalpao1>0 ? {label:"Galpão",  n:nGalpoes, area1:atGalpao1, precoUni:p1Galpao, precoTot:pGalpoes} : null,
      ].filter(Boolean);
      return {
        isComercial: true,
        areaBruta: bLoja.ab*nLojas+bAnc.ab*nAncoras+bComum.ab+bApto.ab*nAptos+bGalpao.ab*nGalpoes,
        areaPiscina:0, areaTotal:areaTot, areaTot,
        precoArq1, precoArq:precoArq1, precoEng1, precoEng:precoEng1,
        precoM2Arq: areaTot>0?Math.round(precoArq1/areaTot*100)/100:0,
        precoM2Eng: areaTot>0?Math.round(precoEng1/areaTot*100)/100:0,
        nRep, pctRep, unidades,
        indiceComodos:0, indicePadrao:0, fatorMult:1, precoBaseVal:pb, precoM2Ef:pb,
        faixasArqDet:[], faixasEng:engCalc.faixas, totalAmbientes:0, acrescimoCirk:ACRESCIMO_AREA,
        blocosCom, precoFachada,
      };
    }

    // ── NÃO COMERCIAL ─────────────────────────────────────────
    let areaBruta = 0, areaPiscina = 0;
    Object.entries(qtds).forEach(([nome, qtd]) => {
      if (!qtd || qtd <= 0) return;
      const cfg = COMODOS_USE[nome];
      if (!cfg) return;
      const [L, W_] = cfg.medidas[tamanho] || [0, 0];
      const area = L * W_ * qtd;
      if (nome === "Piscina") areaPiscina += area;
      else areaBruta += area;
    });

    const areaTotal = Math.round((areaBruta + areaPiscina) * (1 + tcfg.acrescimoCirk) * 100) / 100;
    if (areaTotal === 0) return null;

    // Memória de cálculo — índices
    const indiceComodos = (() => {
      let idx = 0;
      Object.entries(qtds).forEach(([nome, qtd]) => {
        if (!qtd || qtd <= 0) return;
        const cfg = COMODOS_USE[nome];
        if (cfg) idx += (cfg.indice || 0) * qtd;
      });
      return Math.round(idx * 1000) / 1000;
    })();
    const indicePadrao = INDICE_PADRAO[padrao] || 0;
    const fatorMult    = Math.round((1 + indiceComodos + indicePadrao) * 1000) / 1000;
    const precoBaseVal = pb;
    const precoM2Ef    = pb * fatorMult;

    function calcArqFaixas(area) {
      let acum = 0, total = 0, rest = area;
      for (const f of tcfg.faixasDesconto) {
        const chunk = Math.min(rest, f.ate - acum);
        if (chunk <= 0) break;
        total += chunk * precoM2Ef * (1 - f.desconto);
        rest -= chunk; acum += chunk;
        if (rest <= 0) break;
      }
      return Math.round(total * 100) / 100;
    }
    // Faixas de desconto Arq detalhadas
    const faixasArqDet = (() => {
      let acum = 0, rest = areaTotal;
      const det = [];
      for (const f of tcfg.faixasDesconto) {
        const chunk = Math.min(rest, f.ate - acum);
        if (chunk <= 0) break;
        const pm2 = precoM2Ef * (1 - f.desconto);
        det.push({ de: acum, ate: acum + chunk, area: chunk, desconto: f.desconto, precoM2: pm2, preco: Math.round(chunk * pm2 * 100) / 100 });
        rest -= chunk; acum += chunk;
        if (rest <= 0) break;
      }
      return det;
    })();
    const totalAmbientes = Object.entries(qtds).filter(([,q])=>q>0).reduce((s,[,q])=>s+q,0);

    const precoArq1 = calcArqFaixas(areaTotal);
    const engCalc   = calcularEngenharia(areaTotal);
    const precoEng1 = Math.round(engCalc.totalEng * 100) / 100;

    // Repetição: unidades 2+ = 25% da 1ª (fixo por ora)
    const nRep   = qtdRep > 1 ? qtdRep : 1;
    const pctRep = 0.25;
    // array de unidades: [{und, precoArq, precoEng}]
    const unidades = [{ und: 1, arq: precoArq1, eng: precoEng1 }];
    for (let i = 2; i <= nRep; i++) {
      unidades.push({
        und: i,
        arq: Math.round(precoArq1 * pctRep * 100) / 100,
        eng: Math.round(precoEng1 * pctRep * 100) / 100,
      });
    }
    const precoArq = Math.round(unidades.reduce((s, u) => s + u.arq, 0) * 100) / 100;
    const precoEng = Math.round(unidades.reduce((s, u) => s + u.eng, 0) * 100) / 100;
    const areaTot  = areaTotal * nRep;

    return {
      areaBruta: Math.round(areaBruta * 100) / 100,
      areaPiscina: Math.round(areaPiscina * 100) / 100,
      areaTotal,
      areaTot,
      precoArq1, precoArq,
      precoEng1, precoEng,
      precoM2Arq: areaTot > 0 ? Math.round(precoArq / areaTot * 100) / 100 : 0,
      precoM2Eng: areaTot > 0 ? Math.round(precoEng / areaTot * 100) / 100 : 0,
      nRep, pctRep, unidades,
      // memória de cálculo
      indiceComodos, indicePadrao, fatorMult,
      precoBaseVal, precoM2Ef,
      faixasArqDet, faixasEng: engCalc.faixas,
      totalAmbientes,
      // acrescimoCirk e labelCirk direto da config — derivado também da razão real
      acrescimoCirk: tcfg.acrescimoCirk,
      labelCirk: tcfg.labelCirk || String(Math.round(tcfg.acrescimoCirk*100)),
    };
  }, [qtds, tamanho, padrao, tipoProjeto, configAtual, qtdRep, grupoQtds, isComercial, grupoParams, grupoDeComodo]);

  const temComodos = isComercial
    ? Object.entries(grupoQtds).some(([g, gq]) => gq > 0 && Object.keys(qtds).some(nome => grupoDeComodo[nome] === g && (qtds[nome]||0) > 0))
    : Object.values(qtds).some(q => q > 0);

  // ── Estilos ─────────────────────────────────────────────────
  // Injeta keyframe slideUp uma vez
  useEffect(() => {
    if (document.getElementById("slide-up-style")) return;
    const s = document.createElement("style");
    s.id = "slide-up-style";
    s.textContent = `@keyframes slideUp { from { opacity:0; transform:translateY(32px); } to { opacity:1; transform:translateY(0); } }`;
    document.head.appendChild(s);
  }, []);

  const C = {
    wrap:       { fontFamily:"inherit", color:"#111", background:"#fff", minHeight:"100vh", padding:"24px 20px", position:"relative" },
    fieldBox:   { background:"#f5f5f5", border:"1px solid #d1d5db", borderRadius:10, padding:"12px 16px", fontSize:14, color:"#6b7280" },
    fieldLabel: { fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:6, display:"block" },
    input:      { width:"100%", border:"1px solid #d1d5db", borderRadius:10, padding:"12px 16px", fontSize:14, color:"#111", outline:"none", background:"#fff", boxSizing:"border-box", fontFamily:"inherit" },
    dropWrap:   { position:"relative", display:"flex", flexDirection:"column", alignItems:"center", gap:6 },
    dropLbl:    { fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1.2, textAlign:"center" },
    dropBtn:    (open) => ({ display:"flex", alignItems:"center", gap:6, background:"#fff", border:`1px solid ${open?"#111":"#d1d5db"}`, borderRadius:10, padding:"9px 14px", fontSize:11, color: null, cursor:"pointer", fontFamily:"inherit", minWidth:110, }),
    dropBtnTxt: (val) => ({ flex:1, textAlign:"center", color: val ? "#111" : "#9ca3af" }),
    chevron:    (open) => ({ transition:"transform 0.15s", transform: open ? "rotate(180deg)" : "none", display:"flex", alignItems:"center" }),
    dropPanel:  { position:"fixed", zIndex:9999, background:"#fff", border:"1px solid #d1d5db", borderRadius:10, boxShadow:"0 4px 16px rgba(0,0,0,0.12)", minWidth:160, overflow:"hidden" },
    dropItem:   (sel) => ({ padding:"10px 16px", fontSize:14, cursor:"pointer", color:"#374151", background: sel ? "#f5f5f5" : "#fff", fontWeight: sel ? 600 : 400, borderBottom:"1px solid #f3f4f6" }),
    groupHdr:   { fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1.2, textAlign:"center", marginBottom:12 },
    sep:        { width:1, background:"#e5e7eb", alignSelf:"stretch", marginTop:22 },
    btnDefinir: { width:"100%", maxWidth:380, background:"#fff", border:"1px solid #d1d5db", borderRadius:10, padding:"13px 0", fontSize:14, color:"#374151", cursor:"pointer", fontFamily:"inherit", textAlign:"center", display:"block", margin:"0 auto" },
    aviso:      { fontSize:12, color:"#ef4444", textAlign:"center", marginTop:8 },
    // Cômodos
    comodoGrupoHdr: { fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:8, marginTop:20, background:"#f9fafb", border:"1px solid #f3f4f6", borderRadius:6, padding:"6px 10px", display:"inline-block" },
    comodoRow:  (ativo) => ({ display:"flex", alignItems:"center", gap:4, padding:"3px 0", borderBottom:"1px solid #f3f4f6", opacity: ativo ? 1 : 0.55 }),
    comodoNome: { flex:1, fontSize:14, color:"#374151" },
    comodoM2:   { fontSize:12, color:"#9ca3af", width:70, textAlign:"right", whiteSpace:"nowrap" },
    qtdWrap:    { display:"flex", alignItems:"center", gap:8 },
    qtdBtn:     { width:26, height:26, borderRadius:6, border:"1px solid #d1d5db", background:"#fff", color:"#374151", fontSize:16, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 },
    qtdNum:     (q) => ({ width:24, textAlign:"center", fontSize:14, fontWeight: q > 0 ? 700 : 400, color: q > 0 ? "#111" : "#9ca3af" }),
    qtdM2Tot:   { fontSize:12, color:"#6b7280", width:72, textAlign:"right", whiteSpace:"nowrap" },
    // Resumo
    resumoBox:  { background:"#fff", border:"1px solid #d1d5db", borderRadius:12, padding:"20px 20px" },
    resumoHdr:  { fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1.2, textAlign:"center", marginBottom:16, paddingBottom:12, borderBottom:"1px solid #f3f4f6" },
    resumoSec:  { fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, marginBottom:6, marginTop:14 },
    resumoVal:  { fontSize:18, fontWeight:700, color:"#111" },
    resumoM2:   { fontSize:12, color:"#9ca3af", marginTop:2 },
    resumoLinha:{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginTop:4 },
    resumoArea: { background:"#f9fafb", border:"1px solid #f3f4f6", borderRadius:8, padding:"10px 14px", marginBottom:10, fontSize:13, color:"#374151" },
  };

  // renderiza um step do fluxo inline
  function renderStep(id) {
    const open = aberto === id;
    const val  = VALS[id];
    const lbl  = LABELS[id];
    const btnRef = { current: null };
    return (
      <div style={{ position:"relative" }} key={id}>
        <button
          ref={el => { btnRef.current = el; }}
          style={{ ...C.dropBtn(open), background: val ? "#f9fafb" : "#fff" }}
          onClick={(e) => {
            if (open) { setAberto(null); return; }
            const r = e.currentTarget.getBoundingClientRect();
            setPanelPos({ top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX });
            setAberto(id);
          }}>
          <span style={C.dropBtnTxt(val)}>
            {val
              ? <><span style={{ color:"#9ca3af", fontWeight:400 }}>{lbl}: </span><span style={{ fontWeight:600, color:"#111" }}>{val}</span></>
              : <span style={{ color:"#9ca3af" }}>{lbl}</span>
            }
          </span>
          <span style={C.chevron(open)}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </button>
      </div>
    );
  }

  // Nomes de exibição dos grupos de Conj. Comercial
  const GRUPO_DISPLAY = {
    "Por Loja":        "Loja",
    "Espaço Âncora":   "Espaço Âncora",
    "Áreas Comuns":    "Área Comum",
    "Por Apartamento": "Apartamento",
    "Galpao":          "Galpão",
  };


  const [gruposAbertos, setGruposAbertos] = useState({});
  function toggleGrupo(grupo) {
    setGruposAbertos(prev => ({ ...prev, [grupo]: prev[grupo] === false ? true : false }));
  }
  function isGrupoAberto(grupo) { return gruposAbertos[grupo] !== false; }


  function setQtd(nome, delta) {
    setQtds(prev => ({ ...prev, [nome]: Math.max(0, (prev[nome] || 0) + delta) }));
  }

  function getArea(nome) {
    if (!configAtual) return 0;
    const cfg = configAtual.comodos[nome];
    if (!cfg) return 0;
    const grupo = grupoDeComodo[nome];
    const tam = isComercial && grupo && grupoParams[grupo] ? grupoParams[grupo].tamanho : tamanho;
    if (!tam) return 0;
    const [L, W] = cfg.medidas[tam] || [0, 0];
    return L * W;
  }

  const fmtNum = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });

  // Valores derivados do modal — sempre sincronizados com os estados
  const modalTotSI   = calculo ? Math.round((calculo.precoArq + calculo.precoEng)*100)/100 : 0;
  const modalTotCI   = temImposto && modalTotSI > 0 ? Math.round(modalTotSI/(1-aliqImp/100)*100)/100 : modalTotSI;
  const modalImposto = temImposto ? Math.round((modalTotCI - modalTotSI)*100)/100 : 0;

  if (propostaData) {
    // Mescla propostaData com estados atuais de pagamento — sempre sincronizado
    const liveData = {
      ...propostaData,
      tipoPgto, temImposto, aliqImp,
      resumoDescritivo: propostaData.resumoDescritivo || "",
      descArq, parcArq, descPacote, parcPacote,
      descEtCtrt, parcEtCtrt, descPacCtrt, parcPacCtrt,
      etapasPct,
      totSI: modalTotSI, totCI: modalTotCI, impostoV: modalImposto,
    };
    return <PropostaPreview data={liveData} onVoltar={() => {
      setPropostaData(null);
      if (onVoltar) onVoltar();
    }} />;
  }

  return (
    <div style={C.wrap} ref={wrapRef}>

      {/* ── Identificação ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:32 }}>
        <div>
          <span style={C.fieldLabel}>Cliente</span>
          <div style={C.fieldBox}>{clienteNome || "—"}</div>
        </div>
        <div>
          <span style={C.fieldLabel}>Referência</span>
          <input style={C.input} placeholder="Nome do projeto, endereço ou bairro"
            value={referencia} onChange={e => setReferencia(e.target.value)} />
        </div>
      </div>

      {/* ── Fluxo sequencial de parâmetros ── */}
      {!tamanho ? (
        /* Modo vertical — ainda definindo */
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start" }}>

          {/* Passo 1 — Tipo Obra */}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {renderStep("tipoObra")}
            {tipoObra && <span onClick={() => { setAberto(null); setTipoObra(null); setTipoProjeto(null); setPadrao(null); setTipologia(null); setTamanho(null); }} style={{ fontSize:11, color:"#d1d5db", cursor:"pointer", padding:"0 4px" }}>✕</span>}
          </div>

          {/* Passo 2 — Tipo Projeto */}
          {tipoObra && <>
            <div style={{ width:1, background:"#d1d5db", height:24, marginLeft:20, transition:"height 0.45s ease" }} />
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              {renderStep("tipoProjeto")}
              {tipoProjeto && <span onClick={() => { setAberto(null); setTipoProjeto(null); setPadrao(null); setTipologia(null); setTamanho(null); }} style={{ fontSize:11, color:"#d1d5db", cursor:"pointer", padding:"0 4px" }}>✕</span>}
            </div>
          </>}

          {/* Passo 3 — Padrão */}
          {tipoProjeto && <>
            <div style={{ width:1, background:"#d1d5db", height:24, marginLeft:20, transition:"height 0.45s ease" }} />
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              {renderStep("padrao")}
              {padrao && <span onClick={() => { setAberto(null); setPadrao(null); setTipologia(null); setTamanho(null); }} style={{ fontSize:11, color:"#d1d5db", cursor:"pointer", padding:"0 4px" }}>✕</span>}
            </div>
          </>}

          {/* Passo 4 — Tipologia */}
          {padrao && <>
            <div style={{ width:1, background:"#d1d5db", height:24, marginLeft:20, transition:"height 0.45s ease" }} />
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              {renderStep("tipologia")}
              {tipologia && <span onClick={() => { setAberto(null); setTipologia(null); setTamanho(null); }} style={{ fontSize:11, color:"#d1d5db", cursor:"pointer", padding:"0 4px" }}>✕</span>}
            </div>
          </>}

          {/* Passo 5 — Tamanho */}
          {tipologia && <>
            <div style={{ width:1, background:"#d1d5db", height:24, marginLeft:20, transition:"height 0.45s ease" }} />
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              {renderStep("tamanho")}
              {tamanho && <span onClick={() => { setAberto(null); setTamanho(null); }} style={{ fontSize:11, color:"#d1d5db", cursor:"pointer", padding:"0 4px" }}>✕</span>}
            </div>
          </>}

        </div>
      ) : (
        /* Modo horizontal — todos definidos, na mesma linha, clique só abre dropdown */
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center", animation:"slideUp 0.4s ease forwards" }}>
          {renderStep("tipoObra")}
          {renderStep("tipoProjeto")}
          {renderStep("padrao")}
          {renderStep("tipologia")}
          {renderStep("tamanho")}
        </div>
      )}



      {/* ── Cômodos + Resumo ── */}
      {!!tamanho && !!configAtual && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 400px", gap:32, alignItems:"start",
          animation:"slideUp 0.5s ease forwards",
          marginTop:32,
        }}>

          {/* Cômodos */}
          <div>
            {/* Repetição de unidades — oculto só para Conj. Comercial */}
            {tipoProjeto !== "Conj. Comercial" && (
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:"#f9fafb", border:"1px solid #d1d5db", borderRadius:8, marginBottom:12 }}>
                <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", flex:1 }}>
                  <input type="checkbox" checked={!!qtdRep} onChange={e => setQtdRep(e.target.checked ? 2 : 0)} />
                  <span style={{ fontSize:13, color:"#374151", fontWeight:600 }}>Repetição de unidades</span>
                  {!!qtdRep && <span style={{ fontSize:12, color:"#7c3aed", marginLeft:4 }}>{qtdRep}×</span>}
                </label>
                {!!qtdRep && (
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <button style={{ width:28, height:28, borderRadius:6, border:"1px solid #d1d5db", background:"#fff", color:"#374151", fontSize:18, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}
                      onClick={() => setQtdRep(n => Math.max(2, n - 1))}>−</button>
                    <span style={{ minWidth:28, textAlign:"center", fontSize:14, fontWeight:700, color:"#111" }}>{qtdRep}</span>
                    <button style={{ width:28, height:28, borderRadius:6, border:"1px solid #d1d5db", background:"#fff", color:"#374151", fontSize:18, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}
                      onClick={() => setQtdRep(n => n + 1)}>+</button>
                  </div>
                )}
              </div>
            )}

            {Object.entries(configAtual.grupos).filter(([grupo]) => {
                const isTerrea = tipologia === "Térreo" || tipologia === "Térrea";
                if (isTerrea && grupo === "Outros") return false;
                return true;
              }).map(([grupo, nomes]) => (
              <div key={grupo}>
                {/* Cabeçalho do grupo — mesma estrutura de colunas que a linha de cômodo */}
                <div style={{
                  display:"flex", alignItems:"center", gap:12,
                  background: "#f9fafb",
                  border: "1px solid #f3f4f6",
                  borderRadius: 8,
                  padding: "8px 12px",
                  marginTop: 20, marginBottom: 10,
                }}>
                  {/* Nome — flex:1, igual ao comodoNome */}
                  <span onClick={() => toggleGrupo(grupo)} style={{ flex:1, fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, fontWeight:600, cursor:"pointer" }}>
                    {isComercial ? (GRUPO_DISPLAY[grupo] || grupo) : grupo}
                  </span>
                  <span onClick={() => toggleGrupo(grupo)} style={{ fontSize:10, color:"#9ca3af", cursor:"pointer", userSelect:"none" }}>
                    {isGrupoAberto(grupo) ? "▲" : "▼"}
                  </span>
                  {isComercial ? (
                    <>
                      {/* Botões de parâmetro por grupo */}
                      {["padrao","tipologia","tamanho"].map(key => {
                        const labels = { padrao:"Padrão", tipologia:"Tipologia", tamanho:"Tamanho" };
                        const opcoes = {
                          padrao:    ["Alto","Médio","Baixo"],
                          tipologia: ["Térreo","Sobrado"],
                          tamanho:   ["Grande","Médio","Pequeno","Compacta"],
                        };
                        const gp = grupoParams[grupo] || {};
                        const val = gp[key] || "";
                        const aKey = `${grupo}__${key}`;
                        const open = abertoGrupo?.key === aKey;
                        return (
                          <div key={key} style={{ position:"relative" }}>
                            <button
                              style={{ ...C.dropBtn(open), minWidth:80, background: val ? "#f9fafb" : "#fff", padding:"5px 10px" }}
                              onClick={e => {
                                e.stopPropagation();
                                if (open) { setAbertoGrupo(null); return; }
                                const r = e.currentTarget.getBoundingClientRect();
                                setAbertoGrupo({ key: aKey, grupo, param: key, top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX });
                              }}>
                              <span style={{ ...C.dropBtnTxt(val), fontSize:10 }}>
                                {val
                                  ? <><span style={{ color:"#9ca3af", fontWeight:400 }}>{labels[key]}: </span><span style={{ fontWeight:600, color:"#111" }}>{val}</span></>
                                  : <span style={{ color:"#9ca3af" }}>{labels[key]}</span>}
                              </span>
                              <span style={C.chevron(open)}>
                                <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </span>
                            </button>
                          </div>
                        );
                      })}
                      {/* Qtd do grupo */}
                      <div style={C.qtdWrap}>
                        <button style={C.qtdBtn} onClick={() => setGrupoQtd(grupo, -1)}>−</button>
                        <span style={C.qtdNum(grupoQtds[grupo]||0)}>{grupoQtds[grupo]||0}</span>
                        <button style={C.qtdBtn} onClick={() => setGrupoQtd(grupo, +1)}>+</button>
                      </div>
                      <span style={{ width:52 }} />
                    </>
                  ) : null}
                </div>
                {isGrupoAberto(grupo) && nomes.map(nome => {
                  const q    = qtds[nome] || 0;
                  const area = getArea(nome);
                  const tot  = area * q;
                  return (
                    <div key={nome} style={C.comodoRow(q > 0)}>
                      <span style={C.comodoNome}>{nome}</span>
                      <span style={C.comodoM2}>{area > 0 ? fmtNum(area)+" m²" : "—"}</span>
                      <div style={C.qtdWrap}>
                        <button style={C.qtdBtn} onClick={() => setQtd(nome, -1)}>−</button>
                        <span style={C.qtdNum(q)}>{q}</span>
                        <button style={C.qtdBtn} onClick={() => setQtd(nome, +1)}>+</button>
                      </div>
                      <span style={C.qtdM2Tot}>{tot > 0 ? fmtNum(tot)+" m²" : ""}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Resumo Cálculo — aparece ao preencher primeiro cômodo */}
          <div style={{ position:"sticky", top:24 }}>
            {temComodos && calculo ? (
              <div>
                <div style={C.resumoBox}>
                  <div style={C.resumoHdr}>Resumo Cálculo</div>

                  {/* Áreas — expansível */}
                  <AreaDetalhe calculo={calculo} fmtNum={fmtNum} />

                  <ResumoDetalhes calculo={calculo} fmtNum={fmtNum} C={C} />
                </div>
                <button
                  style={{ width:"100%", marginTop:12, background:"#f3f4f6", color:"#111", border:"1px solid #e5e7eb", borderRadius:10, padding:"13px 0", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", letterSpacing:0.2, transition:"background 0.15s, border-color 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background="#e5e7eb"; e.currentTarget.style.borderColor="#d1d5db"; }}
                  onMouseLeave={e => { e.currentTarget.style.background="#f3f4f6"; e.currentTarget.style.borderColor="#e5e7eb"; }}
                  onClick={() => setShowModal(true)}>
                  Gerar Orçamento
                </button>
              </div>
            ) : (
              <div style={{ ...C.resumoBox, textAlign:"center", padding:"32px 20px" }}>
                <div style={{ fontSize:12, color:"#d1d5db" }}>Resumo Cálculo</div>
                <div style={{ fontSize:11, color:"#e5e7eb", marginTop:8 }}>Preencha os ambientes</div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Valores derivados para o modal e propostaData — sempre atualizados */}
      {(() => {
        if (calculo) {
          const _arqV = calculo.precoArq;
          const _engV = calculo.precoEng;
          const _totSI = _arqV + _engV;
          const _totCI = temImposto ? Math.round(_totSI/(1-aliqImp/100)*100)/100 : _totSI;
          const _impostoV = temImposto ? Math.round((_totCI-_totSI)*100)/100 : 0;
          // Injeta no escopo externo via ref para uso no setPropostaData
          window.__obraModalVals = { totSI: _totSI, totCI: _totCI, impostoV: _impostoV };
        }
        return null;
      })()}

      {/* Modal Gerar Orçamento */}
      {showModal && calculo && (() => {
        const fmtV = (v) => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
        const arqV  = calculo.precoArq;
        const engV  = calculo.precoEng;
        const totSI = arqV + engV;
        const semImpFator = 1 - aliqImp/100;
        const totCI = temImposto ? Math.round(totSI/semImpFator*100)/100 : totSI;
        const impostoV = temImposto ? Math.round((totCI-totSI)*100)/100 : 0;
        const isPadrao = tipoPgto === "padrao";
        const arqComDesc  = Math.round(arqV*(1-descArq/100)*100)/100;
        const totComDesc  = Math.round(totCI*(1-descPacote/100)*100)/100;
        const inpS = { width:44, textAlign:"center", border:"1px solid #e5e7eb", borderRadius:6, padding:"3px 4px", fontSize:12, fontWeight:600, outline:"none", fontFamily:"inherit", background:"#fff", color:"#111" };
        const cardSty = (sel) => ({ border:`1.5px solid ${sel?"#111":"#e5e7eb"}`, borderRadius:12, padding:"14px 16px", marginBottom:10, cursor:"pointer", background:"#fff", transition:"border-color 0.15s" });
        const radioCircle = (sel) => ({ width:18, height:18, borderRadius:9, border:`1.5px solid ${sel?"#111":"#d1d5db"}`, background:sel?"#111":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 });
        return (
          <>
            <style>{`
              @keyframes fadeInOvr { from{opacity:0} to{opacity:1} }
              @keyframes slideUpSht { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
            `}</style>
            <div onClick={() => setShowModal(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:9000, animation:"fadeInOvr 0.25s ease" }}>
              <div onClick={e=>e.stopPropagation()} style={{
                position:"fixed", bottom:0, left:0, right:0, maxHeight:"90vh", overflowY:"auto",
                background:"#fff", borderRadius:"20px 20px 0 0", padding:"24px 20px 36px",
                animation:"slideUpSht 0.35s cubic-bezier(0.32,0.72,0,1)", zIndex:9001,
              }}>
                <div style={{ width:36, height:4, background:"#e5e7eb", borderRadius:2, margin:"0 auto 18px" }} />
                <div style={{ fontSize:17, fontWeight:700, color:"#111", marginBottom:4 }}>Gerar Orçamento</div>
                <div style={{ fontSize:12, color:"#9ca3af", marginBottom:20 }}>
                  {tipoProjeto} · {tipoObra} · Padrão {padrao} · {tipologia} · Ambientes {tamanho}s
                </div>

                {/* Resumo valores */}
                <div style={{ background:"#f9fafb", borderRadius:12, padding:"14px 16px", marginBottom:20 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontSize:12, color:"#6b7280" }}>Arquitetura</span>
                    <span style={{ fontSize:13, fontWeight:600, color:"#111" }}>{fmtV(arqV)}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontSize:12, color:"#6b7280" }}>Engenharia</span>
                    <span style={{ fontSize:13, fontWeight:600, color:"#111" }}>{fmtV(engV)}</span>
                  </div>
                  {temImposto && <>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <span style={{ fontSize:12, color:"#6b7280" }}>Subtotal sem impostos</span>
                      <span style={{ fontSize:12, color:"#6b7280" }}>{fmtV(totSI)}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <span style={{ fontSize:12, color:"#ef4444" }}>+ Impostos ({aliqImp}%)</span>
                      <span style={{ fontSize:12, color:"#ef4444" }}>+{fmtV(impostoV)}</span>
                    </div>
                  </>}
                  <div style={{ display:"flex", justifyContent:"space-between", paddingTop:10, borderTop:"1px solid #e5e7eb" }}>
                    <span style={{ fontSize:14, fontWeight:700, color:"#111" }}>Total Geral</span>
                    <span style={{ fontSize:16, fontWeight:800, color:"#111" }}>{fmtV(totCI)}</span>
                  </div>
                </div>

                {/* Imposto */}
                <div style={{ background:"#fafafa", border:"1px solid #f0f0f0", borderRadius:12, padding:"12px 14px", marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
                  <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", flex:1 }}>
                    <input type="checkbox" checked={temImposto} onChange={e=>setTemImposto(e.target.checked)} />
                    <span style={{ fontSize:13, color:"#374151", fontWeight:500 }}>Incluir Impostos</span>
                  </label>
                  {temImposto && (
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <input type="number" min="0" max="50" step="0.5" style={inpS} value={aliqImp} onChange={e=>setAliqImp(parseFloat(e.target.value)||0)} />
                      <span style={{ fontSize:12, color:"#9ca3af" }}>%</span>
                    </div>
                  )}
                </div>

                {/* Forma de Pagamento */}
                <div style={{ fontSize:11, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:10, fontWeight:600 }}>Forma de pagamento</div>

                {/* Dois cards lado a lado */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, alignItems:"start" }}>

                  {/* Card Padrão */}
                  <div style={cardSty(isPadrao)} onClick={()=>setTipoPgto("padrao")}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: isPadrao ? 12 : 0 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:"#111" }}>Pagamento Padrão</div>
                        <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>Antecipado ou parcelado</div>
                      </div>
                      <div style={radioCircle(isPadrao)}>{isPadrao && <span style={{ color:"#fff", fontSize:10, fontWeight:900 }}>✓</span>}</div>
                    </div>
                    {isPadrao && (
                      <div style={{ paddingTop:12, borderTop:"1px solid #f0f0f0" }} onClick={e=>e.stopPropagation()}>
                        <div style={{ background:"#fafafa", borderRadius:8, padding:"8px 10px", marginBottom:8 }}>
                          <div style={{ fontSize:11, color:"#374151", fontWeight:700, marginBottom:6 }}>Apenas Arquitetura</div>
                          <div style={{ marginBottom:5, paddingBottom:5, borderBottom:"1px solid #f0f0f0" }}>
                            <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Antecipado</div>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <input type="number" min="0" max="50" style={inpS} value={descArq} onChange={e=>setDescArq(parseFloat(e.target.value)||0)} />
                              <span style={{ fontSize:10, color:"#8e8e93" }}>% OFF → {fmtV(arqComDesc)}</span>
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Parcelado</div>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <input type="number" min="1" max="24" style={inpS} value={parcArq} onChange={e=>setParcArq(parseInt(e.target.value)||3)} />
                              <span style={{ fontSize:10, color:"#8e8e93" }}>× → {fmtV(arqV/(parcArq||3))}/mês</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ background:"#fafafa", borderRadius:8, padding:"8px 10px" }}>
                          <div style={{ fontSize:11, color:"#374151", fontWeight:700, marginBottom:6 }}>Pacote (Arq. + Eng.)</div>
                          <div style={{ marginBottom:5, paddingBottom:5, borderBottom:"1px solid #f0f0f0" }}>
                            <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Antecipado</div>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <input type="number" min="0" max="50" style={inpS} value={descPacote} onChange={e=>setDescPacote(parseFloat(e.target.value)||0)} />
                              <span style={{ fontSize:10, color:"#8e8e93" }}>% OFF → {fmtV(totComDesc)}</span>
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Parcelado</div>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <input type="number" min="1" max="24" style={inpS} value={parcPacote} onChange={e=>setParcPacote(parseInt(e.target.value)||4)} />
                              <span style={{ fontSize:10, color:"#8e8e93" }}>× → {fmtV(totCI/(parcPacote||4))}/mês</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Por Etapas */}
                  <div style={cardSty(!isPadrao)} onClick={()=>setTipoPgto("etapas")}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: !isPadrao ? 12 : 0 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:"#111" }}>Pagamento por Etapas</div>
                        <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>Desconto por etapa</div>
                      </div>
                      <div style={radioCircle(!isPadrao)}>{!isPadrao && <span style={{ color:"#fff", fontSize:10, fontWeight:900 }}>✓</span>}</div>
                    </div>
                    {!isPadrao && (
                      <div style={{ paddingTop:12, borderTop:"1px solid #f0f0f0", display:"grid", gridTemplateColumns:"1fr 1.5fr", gap:8 }} onClick={e=>e.stopPropagation()}>

                        {/* Esquerda — condições */}
                        <div>
                          <div style={{ background:"#fafafa", borderRadius:8, padding:"8px 10px", marginBottom:8 }}>
                            <div style={{ fontSize:11, color:"#374151", fontWeight:700, marginBottom:6 }}>Etapa a Etapa</div>
                            <div style={{ marginBottom:5, paddingBottom:5, borderBottom:"1px solid #f0f0f0" }}>
                              <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Antecipado</div>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <input type="number" min="0" max="50" style={inpS} value={descEtCtrt} onChange={e=>setDescEtCtrt(parseFloat(e.target.value)||0)} />
                                <span style={{ fontSize:10, color:"#8e8e93" }}>% OFF/etapa</span>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Parcelado</div>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <input type="number" min="1" max="12" style={inpS} value={parcEtCtrt} onChange={e=>setParcEtCtrt(parseInt(e.target.value)||2)} />
                                <span style={{ fontSize:10, color:"#8e8e93" }}>×/etapa</span>
                              </div>
                            </div>
                          </div>
                          <div style={{ background:"#fafafa", borderRadius:8, padding:"8px 10px" }}>
                            <div style={{ fontSize:11, color:"#374151", fontWeight:700, marginBottom:6 }}>Pacote Completo</div>
                            <div style={{ marginBottom:5, paddingBottom:5, borderBottom:"1px solid #f0f0f0" }}>
                              <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Antecipado</div>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <input type="number" min="0" max="50" style={inpS} value={descPacCtrt} onChange={e=>setDescPacCtrt(parseFloat(e.target.value)||0)} />
                                <span style={{ fontSize:10, color:"#8e8e93" }}>% OFF → {fmtV(Math.round(totCI*(1-descPacCtrt/100)*100)/100)}</span>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Parcelado</div>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <input type="number" min="1" max="24" style={inpS} value={parcPacCtrt} onChange={e=>setParcPacCtrt(parseInt(e.target.value)||8)} />
                                <span style={{ fontSize:10, color:"#8e8e93" }}>× → {fmtV(Math.round(totCI*(1-descPacCtrt/100)/parcPacCtrt*100)/100)}/mês</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Direita — etapas */}
                        <div style={{ background:"#fafafa", borderRadius:8, padding:"8px 10px" }}>
                          <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:8, fontWeight:600 }}>Etapas</div>
                          {(() => {
                            const totalPct = etapasPct.reduce((s,e)=>s+e.pct,0);
                            return (<>
                              {etapasPct.map((et, i) => {
                                const val = Math.round(totCI * et.pct/100 * 100)/100;
                                return (
                                  <div key={et.id} style={{ display:"flex", alignItems:"center", gap:5, marginBottom:5 }}>
                                    <input
                                      style={{ flex:1, border:"none", borderBottom:"1px solid #e5e7eb", background:"transparent", fontSize:11, color:"#374151", outline:"none", fontFamily:"inherit", padding:"1px 0", minWidth:0 }}
                                      value={et.nome}
                                      onChange={e=>setEtapasPct(prev=>prev.map((p,j)=>j===i?{...p,nome:e.target.value}:p))}
                                    />
                                    <div style={{ display:"flex", alignItems:"center", gap:2, flexShrink:0 }}>
                                      <input type="number" min="0" max="100"
                                        style={{ width:40, textAlign:"center", border:"1px solid #e5e7eb", borderRadius:5, padding:"1px 4px", fontSize:11, fontWeight:600, outline:"none", fontFamily:"inherit", background:"#fff" }}
                                        value={et.pct}
                                        onChange={e=>setEtapasPct(prev=>prev.map((p,j)=>j===i?{...p,pct:parseFloat(e.target.value)||0}:p))}
                                      />
                                      <span style={{ color:"#9ca3af", fontSize:10 }}>%</span>
                                    </div>
                                    <span style={{ color:"#374151", fontWeight:600, fontSize:10, whiteSpace:"nowrap", minWidth:72, textAlign:"right" }}>{fmtV(val)}</span>
                                    {etapasPct.length > 1 && (
                                      <span onClick={()=>setEtapasPct(prev=>prev.filter((_,j)=>j!==i))} style={{ color:"#d1d5db", cursor:"pointer", fontSize:11, flexShrink:0 }}>✕</span>
                                    )}
                                  </div>
                                );
                              })}
                              <div style={{ display:"flex", justifyContent:"space-between", paddingTop:5, borderTop:"1px solid #e5e7eb", marginTop:2 }}>
                                <span style={{ fontSize:10, color: totalPct===100?"#9ca3af":"#ef4444", fontWeight:600 }}>{totalPct}%</span>
                                <span style={{ fontSize:10, fontWeight:700, color:"#111" }}>{fmtV(Math.round(totCI*totalPct/100*100)/100)}</span>
                              </div>
                              <button onClick={()=>setEtapasPct(prev=>[...prev,{id:Date.now(),nome:`Etapa ${prev.length+1}`,pct:0}])}
                                style={{ marginTop:5, fontSize:10, color:"#374151", background:"#fff", border:"1px solid #e5e7eb", borderRadius:5, padding:"2px 6px", cursor:"pointer", fontFamily:"inherit", width:"100%" }}>
                                + Etapa
                              </button>
                            </>);
                          })()}
                        </div>

                      </div>
                    )}
                  </div>

                </div>

                {/* Confirmar */}
                <button
                  style={{ width:"100%", marginTop:8, background:"#111", color:"#fff", border:"none", borderRadius:12, padding:"15px 0", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}
                  onClick={() => {
                    setPropostaData({
                      tipoProjeto, tipoObra, padrao, tipologia, tamanho,
                      clienteNome, referencia,
                      comodos: Object.entries(qtds).filter(([,q])=>q>0).map(([nome,qtd])=>({nome,qtd})),
                      resumoDescritivo: (() => {
                        const fmtN2 = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
                        const fmtArea = v => v > 0 ? fmtN2(v)+"m²" : null;
                        // Conj. Comercial
                        if (isComercial && calculo?.isComercial) {
                          const c = calculo;
                          const partes = [];
                          const nL = grupoQtds["Por Loja"]||0, nA = grupoQtds["Espaço Âncora"]||0;
                          const nAp = grupoQtds["Por Apartamento"]||0, nG = grupoQtds["Galpao"]||0;
                          if (nL>0 && c.blocosCom) { const b=c.blocosCom.find(x=>x.label==="Loja"); if(b) partes.push(`${nL} loja${nL!==1?"s":""} (${fmtArea(b.area1*nL)})`); }
                          if (nA>0 && c.blocosCom) { const b=c.blocosCom.find(x=>x.label==="Âncora"); if(b) partes.push(`${nA} ${nA===1?"Espaço Âncora":"Espaços Âncoras"} (${fmtArea(b.area1*nA)})`); }
                          if (nAp>0 && c.blocosCom) { const b=c.blocosCom.find(x=>x.label==="Apartamento"); if(b) partes.push(`${nAp} apartamento${nAp!==1?"s":""} (${fmtArea(b.area1*nAp)})`); }
                          if (nG>0 && c.blocosCom) { const b=c.blocosCom.find(x=>x.label==="Galpão"); if(b) partes.push(`${nG} ${nG!==1?"galpões":"galpão"} (${fmtArea(b.area1*nG)})`); }
                          if (c.blocosCom) { const bc=c.blocosCom.find(x=>x.label==="Área Comum"); if(bc) partes.push(`Área Comum (${fmtArea(bc.area1)})`); }
                          const lista = partes.length>1 ? partes.slice(0,-1).join(", ")+" e "+partes[partes.length-1] : partes[0]||"";
                          return `Conjunto comercial, contendo ${lista}, totalizando ${fmtArea(c.areaTot||c.areaTotal)}.`;
                        }
                        // Residencial
                        const nUnid = calculo?.nRep || 1;
                        const areaUni = calculo?.areaTotal || calculo?.areaTot || 0;
                        const areaTotR = Math.round(areaUni * nUnid * 100)/100;
                        const comAtivos = Object.entries(qtds).filter(([,q])=>q>0).map(([n])=>n.toLowerCase());
                        const totalAmb = Object.entries(qtds).filter(([,q])=>q>0).reduce((s,[,q])=>s+q,0);
                        const listaStr = comAtivos.length>1 ? comAtivos.slice(0,-1).join(", ")+" e "+comAtivos[comAtivos.length-1] : comAtivos[0]||"";
                        const tipDesc = (tipologia||"").toLowerCase().includes("sobrado") ? "com dois pavimentos" : "térrea";
                        const numFem = ["","uma","duas","três","quatro","cinco","seis","sete","oito","nove","dez"];
                        if (nUnid>1) {
                          const nExt = nUnid>=1&&nUnid<=10 ? numFem[nUnid] : String(nUnid);
                          return `${nExt.charAt(0).toUpperCase()+nExt.slice(1)} residências ${tipDesc} idênticas, com ${fmtN2(areaUni)}m² por unidade, totalizando ${fmtN2(areaTotR)}m² de área construída. Cada unidade composta por ${totalAmb} ambientes: ${listaStr}.`;
                        }
                        return `Uma residência ${tipDesc}, com ${fmtN2(areaUni)}m² de área construída, composta por ${totalAmb} ambientes: ${listaStr}.`;
                      })(),
                      grupoQtds: isComercial ? grupoQtds : null,
                      calculo,
                      // pagamento
                      tipoPgto, temImposto, aliqImp,
                      descArq, parcArq, descPacote, parcPacote,
                      descEtCtrt, parcEtCtrt, descPacCtrt, parcPacCtrt,
                      etapasPct,
                      // valores finais
                      totSI: modalTotSI, totCI: modalTotCI, impostoV: modalImposto,
                    });
                    // Salvar no card do cliente
                    if (onSalvar) onSalvar({
                      ...(orcBase || {}),
                      tipo: tipoProjeto, subtipo: tipologia, tamanho, padrao,
                      cliente: clienteNome, referencia,
                      resultado: calculo,
                      tipoPgto, temImposto, aliqImp,
                      etapasPct,
                      totSI: modalTotSI, totCI: modalTotCI, impostoV: modalImposto,
                    });
                    setShowModal(false);
                  }}>
                  Confirmar e Gerar Orçamento
                </button>
                <button
                  style={{ width:"100%", marginTop:8, background:"transparent", color:"#9ca3af", border:"none", padding:"12px 0", fontSize:14, cursor:"pointer", fontFamily:"inherit" }}
                  onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {aberto && (
        <div style={{
          position:"fixed",
          top: panelPos.top, left: panelPos.left,
          zIndex:9999,
          background:"#fff", border:"1px solid #d1d5db", borderRadius:10,
          boxShadow:"0 4px 20px rgba(0,0,0,0.12)", minWidth:160, overflow:"hidden",
        }}>
          {(OPCOES[aberto] || []).map(op => {
            const val = VALS[aberto];
            return (
              <div key={op}
                style={C.dropItem(val === op)}
                onMouseEnter={e => { if (val !== op) e.currentTarget.style.background = "#f9fafb"; }}
                onMouseLeave={e => { if (val !== op) e.currentTarget.style.background = val === op ? "#f5f5f5" : "#fff"; }}
                onClick={() => selecionar(aberto, op)}>
                {op}
              </div>
            );
          })}
        </div>
      )}

      {/* Painel dropdown — parâmetros por grupo comercial */}
      {abertoGrupo && (
        <div style={{
          position:"fixed",
          top: abertoGrupo.top, left: abertoGrupo.left,
          zIndex:9999,
          background:"#fff", border:"1px solid #d1d5db", borderRadius:10,
          boxShadow:"0 4px 20px rgba(0,0,0,0.12)", minWidth:130, overflow:"hidden",
        }}>
          {({ padrao:["Alto","Médio","Baixo"], tipologia:["Térreo","Sobrado"], tamanho:["Grande","Médio","Pequeno","Compacta"] }[abertoGrupo.param] || []).map(op => {
            const cur = (grupoParams[abertoGrupo.grupo] || {})[abertoGrupo.param];
            return (
              <div key={op}
                style={C.dropItem(cur === op)}
                onMouseEnter={e => { if (cur !== op) e.currentTarget.style.background = "#f9fafb"; }}
                onMouseLeave={e => { if (cur !== op) e.currentTarget.style.background = cur === op ? "#f5f5f5" : "#fff"; }}
                onClick={() => setGrupoParam(abertoGrupo.grupo, abertoGrupo.param, op)}>
                {op}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}




// ════════════════════════════════════════════════════════════
// escritorio.jsx
// ════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// ESCRITÓRIO — Módulo reformulado
// Visual minimalista, fundo branco, estilo Claude.ai
// ═══════════════════════════════════════════════════════════════

function Escritorio({ data, save }) {
  const cfg = data.escritorio || {};
  const [aba, setAba] = useState("dados");
  const [form, setForm] = useState({
    nome:        cfg.nome        || "",
    cnpj:        cfg.cnpj        || "",
    email:       cfg.email       || "",
    telefone:    cfg.telefone    || "",
    endereco:    cfg.endereco    || "",
    cidade:      cfg.cidade      || "",
    estado:      cfg.estado      || "SP",
    site:        cfg.site        || "",
    instagram:   cfg.instagram   || "",
    banco:       cfg.banco       || "",
    agencia:     cfg.agencia     || "",
    conta:       cfg.conta       || "",
    tipoConta:   cfg.tipoConta   || "Corrente",
    pixTipo:     cfg.pixTipo     || "CNPJ",
    pixChave:    cfg.pixChave    || "",
  });
  const [responsaveis, setResponsaveis] = useState(
    cfg.responsaveis?.length ? cfg.responsaveis
    : cfg.responsavel ? [{ id:"r1", nome:cfg.responsavel, cau:cfg.cau||"", cpf:cfg.cpfResponsavel||"" }]
    : []
  );
  const [equipe, setEquipe] = useState(cfg.equipe || []);
  const [saved, setSaved] = useState(false);
  const [novoMembro, setNovoMembro] = useState(null);

  const emptyMembro = { id:"", nome:"", cargo:"", email:"", telefone:"", cau:"", cpf:"" };

  function handleSave() {
    save({ ...data, escritorio: { ...form, equipe, responsaveis } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function setF(key, val) {
    setForm(f => {
      const novo = { ...f, [key]: val };
      if (key === "cnpj" && (f.pixTipo === "CNPJ" || f.pixTipo === "CPF")) novo.pixChave = val;
      if (key === "email" && f.pixTipo === "E-mail") novo.pixChave = val;
      if (key === "telefone" && f.pixTipo === "Telefone") novo.pixChave = val;
      return novo;
    });
  }

  const E = {
    wrap: { fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", background:"#fff", minHeight:"100vh", color:"#111" },
    header: { borderBottom:"1px solid #e5e7eb", padding:"24px 32px", display:"flex", justifyContent:"space-between", alignItems:"center" },
    titulo: { fontSize:18, fontWeight:700, color:"#111", margin:0 },
    sub: { fontSize:13, color:"#9ca3af", marginTop:3 },
    abas: { display:"flex", gap:0, borderBottom:"1px solid #e5e7eb", padding:"0 32px" },
    aba: (ativa) => ({ background:"none", border:"none", borderBottom: ativa ? "2px solid #111" : "2px solid transparent", color: ativa ? "#111" : "#9ca3af", padding:"12px 16px", fontSize:13, fontWeight: ativa ? 600 : 400, cursor:"pointer", fontFamily:"inherit", marginBottom:-1 }),
    body: { padding:"32px", maxWidth:760 },
    secao: { marginBottom:32 },
    secTitulo: { fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:16 },
    grid2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 },
    grid3: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 },
    campo: { display:"flex", flexDirection:"column", gap:5 },
    label: { fontSize:12, color:"#6b7280", fontWeight:500 },
    input: { border:"1px solid #d1d5db", borderRadius:8, padding:"10px 12px", fontSize:13, color:"#111", outline:"none", background:"#fff", fontFamily:"inherit", width:"100%", boxSizing:"border-box" },
    select: { border:"1px solid #d1d5db", borderRadius:8, padding:"10px 12px", fontSize:13, color:"#111", outline:"none", background:"#fff", fontFamily:"inherit", width:"100%", boxSizing:"border-box", cursor:"pointer" },
    divisor: { border:"none", borderTop:"1px solid #f3f4f6", margin:"24px 0" },
    btn: { background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
    btnSec: { background:"#fff", color:"#374151", border:"1px solid #d1d5db", borderRadius:8, padding:"10px 18px", fontSize:13, cursor:"pointer", fontFamily:"inherit" },
    btnAdd: { background:"#fff", color:"#374151", border:"1px solid #d1d5db", borderRadius:7, padding:"7px 14px", fontSize:12, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 },
    btnSalvo: { background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", opacity:0.7 },
    // Equipe
    membroCard: { border:"1px solid #e5e7eb", borderRadius:10, padding:"16px", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"flex-start" },
    membroNome: { fontSize:14, fontWeight:600, color:"#111", marginBottom:2 },
    membroCargo: { fontSize:12, color:"#9ca3af" },
    membroInfo: { fontSize:12, color:"#6b7280", marginTop:6, display:"flex", gap:16 },
    // Modal
    overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 },
    modal: { background:"#fff", borderRadius:14, padding:"28px", width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 20px 40px rgba(0,0,0,0.15)" },
    modalTitulo: { fontSize:16, fontWeight:700, color:"#111", marginBottom:20 },
    // View
    viewVal: { fontSize:14, color:"#111", marginBottom:2 },
    viewLabel: { fontSize:11, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.5, marginBottom:4 },
    viewBloco: { display:"flex", flexDirection:"column", gap:3 },
  };

  // ── ABA DADOS ───────────────────────────────────────────────
  const renderDados = () => (
    <div style={E.body}>
      {/* Identificação */}
      <div style={E.secao}>
        <div style={E.secTitulo}>Identificação</div>
        <div style={{ ...E.grid2, marginBottom:16 }}>
          <div style={E.campo}>
            <label style={E.label}>Nome do escritório</label>
            <input style={E.input} value={form.nome} onChange={e => setF("nome", e.target.value)} placeholder="Ex: Padovan Arquitetos" />
          </div>
          <div style={E.campo}>
            <label style={E.label}>CNPJ / CPF</label>
            <input style={E.input} value={form.cnpj} onChange={e => setF("cnpj", e.target.value)} placeholder="00.000.000/0001-00" />
          </div>
        </div>

        {/* Responsáveis técnicos */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <span style={{ fontSize:12, color:"#6b7280", fontWeight:500 }}>Responsáveis técnicos</span>
          <button style={E.btnAdd} onClick={() => setResponsaveis(r => [...r, { id:uid(), nome:"", cau:"", cpf:"" }])}>
            + Adicionar
          </button>
        </div>
        {responsaveis.length === 0 && (
          <div style={{ fontSize:13, color:"#d1d5db", fontStyle:"italic", marginBottom:8 }}>Nenhum responsável cadastrado.</div>
        )}
        {responsaveis.map((r, idx) => (
          <div key={r.id} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr auto", gap:10, marginBottom:10, alignItems:"end" }}>
            {[["Nome","nome","Nome do responsável"],["CAU / CREA","cau","A000000-0"],["CPF","cpf","000.000.000-00"]].map(([lbl,fld,ph]) => (
              <div key={fld} style={E.campo}>
                <label style={E.label}>{lbl}</label>
                <input style={E.input} value={r[fld]||""} placeholder={ph}
                  onChange={e => setResponsaveis(rs => rs.map((x,i) => i===idx ? {...x,[fld]:e.target.value} : x))} />
              </div>
            ))}
            <button onClick={() => setResponsaveis(rs => rs.filter((_,i) => i!==idx))}
              style={{ background:"none", border:"none", color:"#d1d5db", fontSize:18, cursor:"pointer", padding:"8px", alignSelf:"flex-end" }}>×</button>
          </div>
        ))}
      </div>

      <hr style={E.divisor} />

      {/* Contato */}
      <div style={E.secao}>
        <div style={E.secTitulo}>Contato</div>
        <div style={{ ...E.grid2, marginBottom:12 }}>
          {[["E-mail","email","contato@escritorio.com"],["Telefone / WhatsApp","telefone","(14) 99999-0000"]].map(([lbl,key,ph]) => (
            <div key={key} style={E.campo}>
              <label style={E.label}>{lbl}</label>
              <input style={E.input} value={form[key]} onChange={e => setF(key, e.target.value)} placeholder={ph} />
            </div>
          ))}
        </div>
        <div style={E.grid2}>
          {[["Site","site","www.escritorio.com.br"],["Instagram","instagram","@escritorio"]].map(([lbl,key,ph]) => (
            <div key={key} style={E.campo}>
              <label style={E.label}>{lbl}</label>
              <input style={E.input} value={form[key]} onChange={e => setF(key, e.target.value)} placeholder={ph} />
            </div>
          ))}
        </div>
      </div>

      <hr style={E.divisor} />

      {/* Endereço */}
      <div style={E.secao}>
        <div style={E.secTitulo}>Endereço</div>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 0.5fr", gap:16 }}>
          {[["Endereço","endereco","Rua, número, bairro"],["Cidade","cidade","Ourinhos"],["Estado","estado","SP"]].map(([lbl,key,ph]) => (
            <div key={key} style={E.campo}>
              <label style={E.label}>{lbl}</label>
              <input style={E.input} value={form[key]} onChange={e => setF(key, e.target.value)} placeholder={ph} />
            </div>
          ))}
        </div>
      </div>

      <hr style={E.divisor} />

      {/* Dados bancários */}
      <div style={E.secao}>
        <div style={E.secTitulo}>Dados bancários</div>
        <div style={{ ...E.grid3, marginBottom:16 }}>
          {[["Banco","banco","Ex: Sicoob"],["Agência","agencia","0000"],["Conta","conta","00000-0"]].map(([lbl,key,ph]) => (
            <div key={key} style={E.campo}>
              <label style={E.label}>{lbl}</label>
              <input style={E.input} value={form[key]} onChange={e => setF(key, e.target.value)} placeholder={ph} />
            </div>
          ))}
        </div>
        <div style={E.grid3}>
          <div style={E.campo}>
            <label style={E.label}>Tipo de conta</label>
            <select style={E.select} value={form.tipoConta} onChange={e => setF("tipoConta", e.target.value)}>
              <option>Corrente</option><option>Poupança</option><option>Pagamento</option>
            </select>
          </div>
          <div style={E.campo}>
            <label style={E.label}>Tipo de chave PIX</label>
            <select style={E.select} value={form.pixTipo} onChange={e => {
              const tipo = e.target.value;
              let chave = form.pixChave;
              if (tipo==="CNPJ"||tipo==="CPF") chave = form.cnpj||chave;
              if (tipo==="E-mail") chave = form.email||chave;
              if (tipo==="Telefone") chave = form.telefone||chave;
              setForm(f => ({...f, pixTipo:tipo, pixChave:chave}));
            }}>
              <option>CNPJ</option><option>CPF</option><option>E-mail</option><option>Telefone</option><option>Chave Aleatória</option>
            </select>
          </div>
          <div style={E.campo}>
            <label style={E.label}>Chave PIX</label>
            <input style={E.input} value={form.pixChave} onChange={e => setF("pixChave", e.target.value)} placeholder="Chave PIX" />
          </div>
        </div>
      </div>

      {/* Salvar */}
      <div style={{ display:"flex", justifyContent:"flex-end", gap:10, paddingTop:8 }}>
        <button style={saved ? E.btnSalvo : E.btn} onClick={handleSave}>
          {saved ? "Salvo!" : "Salvar alterações"}
        </button>
      </div>
    </div>
  );

  // ── ABA EQUIPE ──────────────────────────────────────────────
  const renderEquipe = () => (
    <div style={E.body}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <div style={{ fontSize:14, color:"#111", fontWeight:600 }}>{equipe.length} membro{equipe.length !== 1 ? "s" : ""}</div>
          <div style={{ fontSize:12, color:"#9ca3af", marginTop:2 }}>Gerencie os membros da equipe</div>
        </div>
        <button style={E.btn} onClick={() => setNovoMembro({...emptyMembro, id:uid()})}>+ Adicionar membro</button>
      </div>

      {equipe.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 0", color:"#d1d5db", fontSize:14 }}>
          Nenhum membro cadastrado ainda.
        </div>
      ) : (
        equipe.map(m => (
          <div key={m.id} style={E.membroCard}>
            <div>
              <div style={E.membroNome}>{m.nome}</div>
              <div style={E.membroCargo}>{m.cargo || "—"}</div>
              <div style={E.membroInfo}>
                {m.email && <span>{m.email}</span>}
                {m.telefone && <span>{m.telefone}</span>}
                {m.cau && <span>{m.cau}</span>}
              </div>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={() => setNovoMembro(m)}
                style={{ background:"none", border:"1px solid #e5e7eb", borderRadius:6, color:"#6b7280", padding:"5px 10px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                Editar
              </button>
              <button onClick={() => { setEquipe(eq => eq.filter(x => x.id !== m.id)); save({ ...data, escritorio: { ...form, equipe: equipe.filter(x => x.id !== m.id), responsaveis } }); }}
                style={{ background:"none", border:"none", color:"#d1d5db", fontSize:18, cursor:"pointer", padding:"5px 8px" }}>×</button>
            </div>
          </div>
        ))
      )}

      {/* Modal membro */}
      {novoMembro && (
        <div style={E.overlay}>
          <div style={E.modal}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={E.modalTitulo}>{novoMembro.nome ? "Editar membro" : "Novo membro"}</div>
              <button onClick={() => setNovoMembro(null)} style={{ background:"none", border:"none", color:"#9ca3af", fontSize:20, cursor:"pointer" }}>×</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
              {[["Nome completo","nome"],["Cargo","cargo"],["E-mail","email"],["Telefone","telefone"],["CAU / CREA","cau"],["CPF","cpf"]].map(([lbl,key]) => (
                <div key={key} style={E.campo}>
                  <label style={E.label}>{lbl}</label>
                  <input style={E.input} value={novoMembro[key]||""} onChange={e => setNovoMembro(m => ({...m,[key]:e.target.value}))} />
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button style={E.btnSec} onClick={() => setNovoMembro(null)}>Cancelar</button>
              <button style={E.btn} onClick={() => {
                if (!novoMembro.nome?.trim()) return;
                const existe = equipe.find(m => m.id === novoMembro.id);
                const novaEquipe = existe
                  ? equipe.map(m => m.id === novoMembro.id ? novoMembro : m)
                  : [...equipe, novoMembro];
                setEquipe(novaEquipe);
                save({ ...data, escritorio: { ...form, equipe: novaEquipe, responsaveis } });
                setNovoMembro(null);
              }}>
                {equipe.find(m => m.id === novoMembro.id) ? "Salvar" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── ABA USUÁRIOS ────────────────────────────────────────────
  const renderUsuarios = () => (
    <div style={E.body}>
      <div style={{ fontSize:13, color:"#9ca3af", padding:"40px 0", textAlign:"center" }}>
        Gestão de usuários em breve — invite por e-mail, perfis e permissões.
      </div>
    </div>
  );

  return (
    <div style={E.wrap}>
      {/* Header */}
      <div style={E.header}>
        <div>
          <div style={E.titulo}>{form.nome || "Escritório"}</div>
          <div style={E.sub}>{form.cidade}{form.estado ? ` — ${form.estado}` : ""}</div>
        </div>
      </div>

      {/* Abas */}
      <div style={E.abas}>
        {[["dados","Dados gerais"],["equipe","Equipe"],["usuarios","Usuários"]].map(([key,lbl]) => (
          <button key={key} style={E.aba(aba===key)} onClick={() => setAba(key)}>{lbl}</button>
        ))}
      </div>

      {/* Conteúdo */}
      {aba === "dados"    && renderDados()}
      {aba === "equipe"   && renderEquipe()}
      {aba === "usuarios" && renderUsuarios()}
    </div>
  );
}


// ════════════════════════════════════════════════════════════
// login.jsx
// ════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// LOGIN — Vicke
// ═══════════════════════════════════════════════════════════════

const TOKEN_KEY = "vicke-token";
const USER_KEY  = "vicke-user";

function getToken()   { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } }
function getUser()    { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } }
function saveAuth(token, usuario) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(usuario));
}
function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function apiPost(path, body) {
  const res = await fetch("https://orbi-production-0c32.up.railway.app" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

function TelaLogin({ onLogin }) {
  const [email, setEmail]       = useState("");
  const [senha, setSenha]       = useState("");
  const [erro, setErro]         = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleLogin() {
    if (!email || !senha) { setErro("Preencha e-mail e senha."); return; }
    setErro("");
    setLoading(true);
    try {
      const res  = await apiPost("/auth/login", { email, senha });
      if (res.ok) {
        saveAuth(res.data.token, res.data.usuario);
        onLogin(res.data.usuario, res.data.token);
      } else {
        setErro(res.error || "E-mail ou senha inválidos.");
      }
    } catch {
      setErro("Não foi possível conectar ao servidor.");
    }
    setLoading(false);
  }

  function handleKey(e) { if (e.key === "Enter") handleLogin(); }

  const S = {
    wrap: {
      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#fff",
      padding: "20px",
    },
    box: {
      width: "100%",
      maxWidth: 360,
    },
    header: {
      textAlign: "center",
      marginBottom: 32,
    },
    titulo: {
      fontSize: 22,
      fontWeight: 700,
      color: "#111",
      letterSpacing: -0.5,
      margin: 0,
    },
    sub: {
      fontSize: 13,
      color: "#9ca3af",
      marginTop: 6,
    },
    card: {
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: "28px 24px",
    },
    label: {
      fontSize: 13,
      color: "#6b7280",
      display: "block",
      marginBottom: 6,
    },
    input: {
      width: "100%",
      border: "1px solid #d1d5db",
      borderRadius: 10,
      padding: "11px 14px",
      fontSize: 14,
      color: "#111",
      outline: "none",
      background: "#fff",
      boxSizing: "border-box",
      fontFamily: "inherit",
      transition: "border-color 0.15s",
    },
    grupo: { marginBottom: 16 },
    btn: {
      width: "100%",
      background: "#111",
      color: "#fff",
      border: "none",
      borderRadius: 10,
      padding: "12px 0",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "inherit",
      marginTop: 8,
      opacity: loading ? 0.6 : 1,
    },
    erro: {
      fontSize: 13,
      color: "#dc2626",
      textAlign: "center",
      marginTop: 12,
      minHeight: 20,
    },
    rodape: {
      textAlign: "center",
      marginTop: 24,
      fontSize: 12,
      color: "#d1d5db",
    },
  };

  return (
    <div style={S.wrap}>
      <div style={S.box}>
        <div style={S.header}>
          <div style={S.titulo}>Vicke</div>
          <div style={S.sub}>Entre na sua conta</div>
        </div>
        <div style={S.card}>
          <div style={S.grupo}>
            <label style={S.label}>E-mail</label>
            <input
              style={S.input}
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKey}
              autoFocus
            />
          </div>
          <div style={S.grupo}>
            <label style={S.label}>Senha</label>
            <input
              style={S.input}
              type="password"
              placeholder="••••••••"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              onKeyDown={handleKey}
            />
          </div>
          <button style={S.btn} onClick={handleLogin} disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
          {erro && <div style={S.erro}>{erro}</div>}
        </div>
        <div style={S.rodape}>Vicke — Conectando elos</div>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════
// app.jsx
// ════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// HOME MENU
// ═══════════════════════════════════════════════════════════════

function HomeMenu({ data, setAba }) {
  const nomeEscritorio = data?.escritorio?.nome || "";
  const [texto, setTexto] = useState("Bem-vindo");
  const [fase, setFase] = useState("bemvindo");

  useEffect(() => {
    if (!nomeEscritorio) return;
    const t1 = setTimeout(() => setFase("saindo"), 1600);
    const t2 = setTimeout(() => { setTexto(nomeEscritorio); setFase("entrando"); }, 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [nomeEscritorio]);

  const opacity = fase === "saindo" ? 0 : 1;
  const transform = fase === "saindo" ? "translateY(-8px)" : "translateY(0)";

  const modulos = [
    { k:"clientes",    label:"Clientes",     desc:"Cadastro e orçamentos",     count: data?.clientes?.length },
    { k:"projetos",    label:"Projetos",     desc:"Etapas e prazos" },
    { k:"obras",       label:"Obras",        desc:"Acompanhamento e execução" },
    { k:"financeiro",  label:"Financeiro",   desc:"Receitas e lançamentos" },
    { k:"fornecedores",label:"Fornecedores", desc:"Cadastro e histórico",      count: data?.fornecedores?.length },
    { k:"escritorio",  label:"Escritório",   desc:"Dados e equipe" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"calc(100vh - 53px)", padding:"40px 32px", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
      <div style={{ textAlign:"center", marginBottom:56 }}>
        <div style={{ fontSize:28, fontWeight:300, color:"#111", letterSpacing:-0.5, transition:"opacity 0.4s ease, transform 0.4s ease", opacity, transform }}>
          {texto}
        </div>
        <div style={{ fontSize:13, color:"#d1d5db", marginTop:8 }}>Selecione um módulo para começar</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:12, width:"100%", maxWidth:680 }}>
        {modulos.map(m => (
          <button key={m.k} onClick={() => setAba(m.k)}
            style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"20px", textAlign:"left", cursor:"pointer", fontFamily:"inherit", position:"relative" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor="#111"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor="#e5e7eb"; }}>
            <div style={{ fontSize:13, fontWeight:600, color:"#111", marginBottom:4 }}>{m.label}</div>
            <div style={{ fontSize:12, color:"#9ca3af" }}>{m.desc}</div>
            {m.count > 0 && <div style={{ position:"absolute", top:12, right:12, background:"#f3f4f6", color:"#6b7280", fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:10 }}>{m.count}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
export default function ModuloClientesFornecedores() {
  const [usuario, setUsuario]         = useState(null);
  const [token, setToken]             = useState(null);
  const [autenticado, setAutenticado] = useState(false);
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [aba, setAba]                 = useState("home");
  const [showBackup, setShowBackup]   = useState(false);
  const [backupJson, setBackupJson]   = useState("");
  const [clientesKey, setClientesKey]         = useState(0);
  const [fornecedoresKey, setFornecedoresKey] = useState(0);
  const [projetosKey, setProjetosKey]         = useState(0);
  const [obrasKey, setObrasKey]               = useState(0);
  const [financeiroKey, setFinanceiroKey]     = useState(0);
  const [escritorioKey, setEscritorioKey]     = useState(0);
  const [sidebarAberta, setSidebarAberta]     = useState(true);

  useEffect(() => { if (autenticado) loadData(); }, [autenticado]);

  useEffect(() => {
    const handler = e => { e.preventDefault(); e.returnValue = "Deseja sair?"; return e.returnValue; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  function handleLogin(usr, tok) { setUsuario(usr); setToken(tok); setAutenticado(true); }
  function handleLogout() { clearAuth(); setUsuario(null); setToken(null); setAutenticado(false); setData(null); }

  async function loadData() {
    try { const saved = await loadAllData(); setData(saved); }
    catch(e) { console.error("Erro:", e); setData(SEED); }
    setLoading(false);
  }

  async function save(newData) {
    const oldData = data; setData(newData);
    try { await saveAllData(newData, oldData); }
    catch(e) { console.error("Erro ao salvar:", e); }
  }

  function exportarDados() {
    const json = JSON.stringify(data, null, 2);
    try {
      const blob = new Blob([json], { type:"application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `vicke-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch {}
    setBackupJson(json); setShowBackup(true);
  }

  function importarDados(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try { const parsed = JSON.parse(ev.target.result); await save(parsed); alert("Dados importados!"); }
      catch { alert("Arquivo inválido."); }
    };
    reader.readAsText(file); e.target.value = "";
  }

  if (!autenticado) return <TelaLogin onLogin={handleLogin} />;

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#fff", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:20, height:20, border:"2px solid #e5e7eb", borderTop:"2px solid #111", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }} />
        <p style={{ color:"#9ca3af", fontSize:13, margin:0 }}>Carregando...</p>
      </div>
    </div>
  );

  const nomeEscritorio = data?.escritorio?.nome || "Vicke";

  const MENU = [
    { k:"home",        label:"Início" },
    { k:"clientes",    label:"Clientes",     count: data?.clientes?.length },
    { k:"projetos",    label:"Projetos" },
    { k:"obras",       label:"Obras" },
    { k:"financeiro",  label:"Financeiro" },
    { k:"fornecedores",label:"Fornecedores", count: data?.fornecedores?.length },
    { k:"nf",          label:"Notas Fiscais" },
    { k:"teste",       label:"Orçamento" },
  ];

  const itemStyle = (ativo) => ({
    display:"flex", alignItems:"center", justifyContent:"space-between",
    padding:"8px 12px", borderRadius:7, cursor:"pointer", fontSize:13,
    fontWeight: ativo ? 600 : 400, color: ativo ? "#111" : "#6b7280",
    background: ativo ? "#f3f4f6" : "transparent",
    border:"none", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",
    width:"100%", textAlign:"left",
  });

  return (
    <div style={{ display:"flex", height:"100vh", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", background:"#fff", overflow:"hidden" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {sidebarAberta && (
        <div style={{ width:220, minWidth:220, background:"#fff", borderRight:"1px solid #f3f4f6", display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"20px 16px 16px", borderBottom:"1px solid #f3f4f6" }}>
            <div style={{ fontSize:15, fontWeight:700, color:"#111", letterSpacing:-0.3 }}>{nomeEscritorio}</div>
            <div style={{ fontSize:11, color:"#d1d5db", marginTop:2 }}>Vicke</div>
          </div>
          <nav style={{ flex:1, padding:"12px 8px", display:"flex", flexDirection:"column", gap:2, overflowY:"auto" }}>
            {MENU.map(({k, label, count}) => (
              <button key={k} style={itemStyle(aba===k)}
                onMouseEnter={e => { if(aba!==k) e.currentTarget.style.background="#f9fafb"; }}
                onMouseLeave={e => { if(aba!==k) e.currentTarget.style.background="transparent"; }}
                onClick={() => {
                  setAba(k);
                  if(k==="clientes")    setClientesKey(n=>n+1);
                  if(k==="projetos")    setProjetosKey(n=>n+1);
                  if(k==="obras")       setObrasKey(n=>n+1);
                  if(k==="financeiro")  setFinanceiroKey(n=>n+1);
                  if(k==="fornecedores")setFornecedoresKey(n=>n+1);
                }}>
                <span>{label}</span>
                {count > 0 && <span style={{ background:"#f3f4f6", color:"#9ca3af", fontSize:11, padding:"1px 7px", borderRadius:8 }}>{count}</span>}
              </button>
            ))}
          </nav>
          <div style={{ padding:"8px 8px 12px", borderTop:"1px solid #f3f4f6", display:"flex", flexDirection:"column", gap:2 }}>
            <button style={itemStyle(aba==="escritorio")}
              onMouseEnter={e => { if(aba!=="escritorio") e.currentTarget.style.background="#f9fafb"; }}
              onMouseLeave={e => { if(aba!=="escritorio") e.currentTarget.style.background="transparent"; }}
              onClick={() => { setAba("escritorio"); setEscritorioKey(n=>n+1); }}>
              Escritório
            </button>
            <div style={{ padding:"8px 12px", marginTop:4, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:"#374151" }}>{usuario?.nome || "—"}</div>
                <div style={{ fontSize:11, color:"#d1d5db" }}>{usuario?.perfil || ""}</div>
              </div>
              <button onClick={handleLogout} style={{ background:"none", border:"none", color:"#d1d5db", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Sair</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ borderBottom:"1px solid #f3f4f6", padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"#fff" }}>
          <button onClick={() => setSidebarAberta(s => !s)}
            style={{ background:"none", border:"none", color:"#9ca3af", cursor:"pointer", padding:"4px 8px", fontSize:16, fontFamily:"inherit" }}>☰</button>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, color:"#9ca3af", cursor:"pointer", border:"1px solid #e5e7eb", borderRadius:6, padding:"5px 10px" }}>
              Importar
              <input type="file" accept=".json" style={{ display:"none" }} onChange={importarDados} />
            </label>
            <button onClick={exportarDados} style={{ fontSize:12, color:"#6b7280", cursor:"pointer", border:"1px solid #e5e7eb", borderRadius:6, padding:"5px 10px", background:"#fff", fontFamily:"inherit" }}>
              Exportar backup
            </button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto" }}>
          {aba === "home"         && <HomeMenu setAba={setAba} data={data} />}
          {aba === "clientes"     && <Clientes key={clientesKey} data={data} save={save} />}
          {aba === "projetos"     && <Projetos key={projetosKey} data={data} save={save} />}
          {aba === "obras"        && <Obras key={obrasKey} data={data} save={save} />}
          {aba === "financeiro"   && <Financeiro key={financeiroKey} data={data} save={save} />}
          {aba === "fornecedores" && <Fornecedores key={fornecedoresKey} data={data} save={save} />}
          {aba === "nf"           && <ImportarNF data={data} save={save} />}
          {aba === "escritorio"   && <Escritorio key={escritorioKey} data={data} save={save} />}
          {aba === "teste"        && <TesteOrcamento data={data} save={save} />}
        </div>
      </div>

      {showBackup && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:99999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:14, padding:24, width:"100%", maxWidth:600, maxHeight:"85vh", display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontWeight:700, fontSize:15, color:"#111" }}>Backup dos dados</div>
              <button onClick={() => setShowBackup(false)} style={{ background:"transparent", border:"none", color:"#9ca3af", fontSize:20, cursor:"pointer" }}>×</button>
            </div>
            <div style={{ color:"#6b7280", fontSize:13 }}>Selecione tudo (<b>Ctrl+A</b>), copie (<b>Ctrl+C</b>) e salve num arquivo <b>.json</b>.</div>
            <textarea readOnly value={backupJson} onClick={e => e.target.select()}
              style={{ flex:1, minHeight:320, background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:8, color:"#374151", fontSize:11, fontFamily:"monospace", padding:14, resize:"none", outline:"none" }} />
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={() => navigator.clipboard?.writeText(backupJson).catch(()=>{})}
                style={{ background:"#111", color:"#fff", border:"none", borderRadius:7, padding:"8px 18px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Copiar tudo</button>
              <button onClick={() => setShowBackup(false)}
                style={{ background:"#fff", color:"#6b7280", border:"1px solid #e5e7eb", borderRadius:7, padding:"8px 18px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CLIENTES
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// HOME — MENU PRINCIPAL
// ═══════════════════════════════════════════════════════════════