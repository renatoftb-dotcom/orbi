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
