// ════════════════════════════════════════════════════════════
// shared.jsx
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

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


// ════════════════════════════════════════════════════════════
// api.js
// ════════════════════════════════════════════════════════════

// v2 PostgreSQL
// ═══════════════════════════════════════════════════════════════
// ORBI — API Client
// Substitui o DB (localStorage/window.storage) pelo backend real
// ═══════════════════════════════════════════════════════════════

const API_URL = "https://orbi-production-5f5c.up.railway.app";

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
// MÓDULO ETAPAS (Kanban de Projetos)
// ═══════════════════════════════════════════════════════════════
// Kanban com 6 colunas fixas:
//   Briefing → Estudo Preliminar → Aprovação Cliente → Prefeitura → Executivo → Engenharia
//
// Colunas de ESPERA (dependem de terceiros): Briefing, Aprovação Cliente, Prefeitura
//   → visual com borda pontilhada + fundo levemente bege
// Colunas de TRABALHO (escritório): Estudo Preliminar, Executivo, Engenharia
//   → visual padrão
//
// Card: cliente · referência · tipo · área · valor · executor · revisor · prazo
// Projeto nasce automaticamente quando orçamento é marcado como "Ganho"
// ═══════════════════════════════════════════════════════════════

const ETAPAS_COLS = [
  { key:"briefing",     label:"Briefing",           wait:true  },
  { key:"preliminar",   label:"Estudo Preliminar",  wait:false },
  { key:"prefeitura",   label:"Prefeitura",         wait:true  },
  { key:"executivo",    label:"Executivo",          wait:false },
  { key:"engenharia",   label:"Engenharia",         wait:false },
];

const TIPO_TAGS = {
  "Residencial":     { label:"Residencial",     bg:"#eff6ff", color:"#2563eb" },
  "Clínica":         { label:"Clínica",         bg:"#f0fdf4", color:"#16a34a" },
  "Conj. Comercial": { label:"Conj. Comercial", bg:"#fef3c7", color:"#b45309" },
  "Galpão":          { label:"Galpão",          bg:"#f3e8ff", color:"#7c3aed" },
  "Empreendimento":  { label:"Empreendimento",  bg:"#fef3c7", color:"#b45309" },
};

// Funções utilitárias
function fmtDataBR(d) {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day:"2-digit", month:"short" }).replace(".", "");
}
function diasRestantes(dtAlvo) {
  if (!dtAlvo) return null;
  const alvo = new Date(dtAlvo);
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const diff = Math.ceil((alvo - hoje) / (1000*60*60*24));
  return diff;
}
function brlCurto(v) {
  if (v == null || v === 0) return "—";
  if (v >= 1000000) return (v/1000000).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1}) + "M";
  if (v >= 1000) return Math.round(v/1000) + "k";
  return Math.round(v).toString();
}

function Etapas({ data, save }) {
  // IMPORTANTE: hooks DEVEM ser chamados antes de qualquer return condicional
  // (regra do React: ordem dos hooks deve ser constante entre renders)
  const [filtro, setFiltro] = useState("todos"); // "todos" | "meus" | "atrasados"
  const [busca, setBusca] = useState("");

  // Defensive: guard pra quando data ainda não carregou
  if (!data) {
    return (
      <div style={{ padding:"24px 28px" }}>
        <h2 style={{ color:"#111", fontWeight:700, fontSize:22, margin:0, letterSpacing:-0.5 }}>Etapas</h2>
        <div style={{ color:"#9ca3af", fontSize:13, marginTop:4 }}>Carregando…</div>
      </div>
    );
  }

  const projetos = data.projetos || [];
  const clientes = data.clientes || [];

  // Filtra projetos conforme filtro + busca
  const projetosFiltrados = projetos.filter(p => {
    if (filtro === "atrasados") {
      const dias = diasRestantes(p.prazoEtapa);
      if (dias == null || dias >= 0) return false;
    }
    if (busca) {
      const cli = clientes.find(c => c.id === p.clienteId);
      const nomeCli = cli?.nome || "";
      const ref = p.referencia || "";
      const q = busca.toLowerCase();
      if (!nomeCli.toLowerCase().includes(q) && !ref.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const qtdAtrasados = projetos.filter(p => {
    const d = diasRestantes(p.prazoEtapa);
    return d != null && d < 0;
  }).length;

  function projetosDaColuna(colKey) {
    return projetosFiltrados.filter(p => (p.colunaEtapa || "briefing") === colKey);
  }

  return (
    <div style={{ padding:"24px 28px", display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom:16 }}>
        <h2 style={{ color:"#111", fontWeight:700, fontSize:22, margin:0, letterSpacing:-0.5 }}>Etapas</h2>
        <div style={{ color:"#9ca3af", fontSize:13, marginTop:4 }}>Acompanhamento dos projetos em andamento</div>
      </div>

      {/* Toolbar: filtros + busca */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, flexWrap:"wrap" }}>
        <FilterPill label="Todos" count={projetos.length} active={filtro==="todos"} onClick={()=>setFiltro("todos")} />
        <FilterPill label="Atrasados" count={qtdAtrasados} active={filtro==="atrasados"} onClick={()=>setFiltro("atrasados")} countColor="#dc2626" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar cliente ou referência…"
          style={{
            flex:1, maxWidth:240, padding:"6px 12px",
            border:"1px solid #e5e7eb", borderRadius:6,
            fontSize:12.5, color:"#111", background:"#fff",
            fontFamily:"inherit", outline:"none",
          }}
        />
      </div>

      {/* Kanban */}
      <div style={{ flex:1, display:"flex", gap:12, overflowX:"auto", overflowY:"hidden", paddingBottom:8 }}>
        {ETAPAS_COLS.map(col => {
          const cards = projetosDaColuna(col.key);
          return (
            <KanbanColumn key={col.key} col={col} cards={cards} clientes={clientes} />
          );
        })}
      </div>

      {/* Estado vazio global */}
      {projetos.length === 0 && (
        <div style={{
          position:"absolute", top:"50%", left:"50%", transform:"translate(-50%, -50%)",
          textAlign:"center", color:"#9ca3af", fontSize:13, pointerEvents:"none",
        }}>
          <div style={{ fontSize:14, color:"#6b7280", marginBottom:4 }}>Nenhum projeto em andamento</div>
          <div>Projetos são criados automaticamente quando um orçamento é marcado como <strong>Ganho</strong>.</div>
        </div>
      )}
    </div>
  );
}

// ─── Filter pill (botão de filtro) ──────────────────────────
function FilterPill({ label, count, active, onClick, countColor }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize:12, color: active ? "#111" : "#6b7280",
        border:"1px solid " + (active ? "#111" : "#e5e7eb"),
        borderRadius:20, padding:"5px 12px",
        background: active ? "#f9fafb" : "#fff",
        cursor:"pointer", fontFamily:"inherit",
        display:"flex", alignItems:"center", gap:5,
      }}>
      {label}
      {count != null && count > 0 && (
        <strong style={{ marginLeft:4, color: countColor || "#111" }}>{count}</strong>
      )}
    </button>
  );
}

// ─── Coluna do Kanban ──────────────────────────────────────
function KanbanColumn({ col, cards, clientes }) {
  const wait = col.wait;
  return (
    <div style={{
      flex:"0 0 280px", display:"flex", flexDirection:"column",
      background: wait ? "#fbfaf6" : "#fafafa",
      border: wait ? "1px dashed #e5e7eb" : "1px solid #f0f0f0",
      borderRadius:10, maxHeight:"100%",
    }}>
      <div style={{
        padding:"14px 14px 10px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        borderBottom: wait ? "1px dashed #e5e7eb" : "1px solid #f3f4f6",
      }}>
        <span style={{
          fontSize:11, fontWeight:600, color:"#374151",
          textTransform:"uppercase", letterSpacing:0.8,
        }}>{col.label}</span>
        <span style={{
          background: wait ? "#f3efe0" : "#f3f4f6",
          color: wait ? "#a88a3f" : "#9ca3af",
          fontSize:10, fontWeight:600, padding:"2px 7px", borderRadius:10,
          minWidth:20, textAlign:"center",
        }}>{cards.length}</span>
      </div>
      <div style={{ flex:1, padding:10, display:"flex", flexDirection:"column", gap:8, overflowY:"auto" }}>
        {cards.length === 0 ? (
          <div style={{ fontSize:11, color:"#d1d5db", textAlign:"center", padding:"20px 0", fontStyle:"italic" }}>
            Nenhum projeto
          </div>
        ) : cards.map(card => (
          <ProjetoCard key={card.id} projeto={card} clientes={clientes} col={col} />
        ))}
      </div>
    </div>
  );
}

// ─── Card de projeto ───────────────────────────────────────
function ProjetoCard({ projeto, clientes, col }) {
  const cliente = clientes.find(c => c.id === projeto.clienteId);
  const nomeCli = cliente?.nome || projeto.clienteNome || "—";
  const ref = projeto.referencia || "";
  const tipo = projeto.tipo || "Residencial";
  const tag = TIPO_TAGS[tipo] || TIPO_TAGS["Residencial"];
  const area = projeto.area || 0;
  const valor = projeto.valor || 0;

  const dias = diasRestantes(projeto.prazoEtapa);
  const atrasado = dias != null && dias < 0;

  return (
    <div style={{
      background:"#fff",
      border: atrasado ? "1px solid #fecaca" : "1px solid #e5e7eb",
      borderRadius:8, padding:12,
      cursor:"pointer", transition:"all 0.15s",
      display:"flex", flexDirection:"column", gap:8,
      ...(atrasado ? { background:"#fffbfb" } : {}),
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = atrasado ? "#fca5a5" : "#d1d5db"; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = atrasado ? "#fecaca" : "#e5e7eb"; }}>
      {/* Tag de tipo */}
      <span style={{
        display:"inline-flex", alignItems:"center",
        fontSize:9.5, fontWeight:600, textTransform:"uppercase", letterSpacing:0.6,
        padding:"2px 7px", borderRadius:4,
        width:"fit-content",
        background: tag.bg, color: tag.color,
      }}>{tag.label}</span>

      {/* Nome cliente */}
      <div style={{ fontSize:13.5, fontWeight:600, color:"#111", lineHeight:1.3 }}>{nomeCli}</div>
      {ref && (
        <div style={{ fontSize:11.5, color:"#9ca3af", lineHeight:1.3 }}>{ref}</div>
      )}

      {/* Meta: área + valor */}
      {(area > 0 || valor > 0) && (
        <div style={{ display:"flex", gap:10, fontSize:11, color:"#6b7280", marginTop:2 }}>
          {area > 0 && <span><strong style={{ color:"#111", fontWeight:600 }}>{area}</strong> m²</span>}
          {valor > 0 && <span>R$ <strong style={{ color:"#111", fontWeight:600 }}>{brlCurto(valor)}</strong></span>}
        </div>
      )}

      {/* Footer: responsável(is) + prazo */}
      <CardFooter projeto={projeto} col={col} dias={dias} atrasado={atrasado} />
    </div>
  );
}

// ─── Footer do card (responsável + prazo) ──────────────────
function CardFooter({ projeto, col, dias, atrasado }) {
  // Estado transversal "aguardando aprovação do cliente" se sobrepõe ao layout normal
  const aguardandoAprovacao = projeto.aprovacaoStatus === "pendente";

  if (col.wait || aguardandoAprovacao) {
    // Layout de espera: motivo do bloqueio + responsável do escritório
    let motivo;
    if (aguardandoAprovacao) {
      motivo = "Aguardando aprovação do cliente";
    } else {
      motivo = projeto.motivoBloqueio || motivoPadrao(col.key);
    }
    return (
      <div style={{ paddingTop:8, borderTop:"1px solid #f3f4f6", marginTop:2, display:"flex", flexDirection:"column", gap:4 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
          <div style={{
            fontSize:11.5, fontWeight:600, lineHeight:1.3,
            color: atrasado ? "#991b1b" : "#92400e",
          }}>{motivo}</div>
          <span style={{
            fontSize:11, whiteSpace:"nowrap",
            color: atrasado ? "#dc2626" : (dias != null && dias <= 3 ? "#d97706" : "#6b7280"),
            fontWeight: (atrasado || (dias != null && dias <= 3)) ? 600 : 400,
          }}>
            {dias == null ? "" : atrasado ? `atrasado ${Math.abs(dias)} dias` : dias === 0 ? "vence hoje" : `faltam ${dias} dias`}
          </span>
        </div>
        {projeto.responsavelAcompanha && (
          <div style={{ fontSize:11.5, color:"#374151", lineHeight:1.3 }}>
            <strong style={{ fontWeight:600, color:"#111" }}>{projeto.responsavelAcompanha}</strong>
            <span style={{ color:"#9ca3af", fontWeight:400 }}> — Acompanhamento</span>
          </div>
        )}
      </div>
    );
  }

  // Colunas de trabalho: executor + revisor
  const executor = projeto.executor || "—";
  const revisor = projeto.revisor || "—";
  const mesmapessoa = executor === revisor;
  const estado = projeto.estadoTrabalho || "execucao"; // "execucao" | "revisao" | "ajustes"

  return (
    <div style={{ paddingTop:8, borderTop:"1px solid #f3f4f6", marginTop:2 }}>
      {mesmapessoa ? (
        // Executor = Revisor → linha única
        <PessoaRow
          icon={estado === "revisao" ? "🔍" : "✏️"}
          nome={executor}
          funcao={estado === "revisao" ? "Revisão" : "Execução"}
          prazo={projeto.prazoEtapa}
          ativa
          dias={dias}
          atrasado={atrasado}
        />
      ) : (<>
        {/* Executor */}
        <PessoaRow
          icon={estado === "execucao" ? "✏️" : estado === "ajustes" ? "⚠️" : "✓"}
          nome={executor}
          funcao={estado === "ajustes" ? "Ajustes" : "Execução"}
          prazo={projeto.prazoExecutor}
          ativa={estado === "execucao" || estado === "ajustes"}
          concluida={estado === "revisao"}
          rejeitada={estado === "ajustes"}
          dias={diasRestantes(projeto.prazoExecutor)}
        />
        {/* Revisor */}
        <PessoaRow
          icon={estado === "revisao" ? "🔍" : "·"}
          nome={revisor}
          funcao={estado === "ajustes" ? "Aguardando correção" : "Revisão"}
          prazo={estado !== "ajustes" ? projeto.prazoRevisor : null}
          ativa={estado === "revisao"}
          inativa={estado !== "revisao"}
          topBorder
          dias={diasRestantes(projeto.prazoRevisor)}
        />
      </>)}
    </div>
  );
}

// ─── Linha de pessoa (executor ou revisor) ─────────────────
function PessoaRow({ icon, nome, funcao, prazo, ativa, concluida, inativa, rejeitada, topBorder, dias }) {
  let corNome = "#111", corFuncao = "#6b7280", corPrazo = "#6b7280", fontWeightPrazo = 400;
  if (concluida || inativa) { corNome = "#6b7280"; corFuncao = "#9ca3af"; corPrazo = "#9ca3af"; }
  if (rejeitada) { corNome = "#92400e"; corFuncao = "#b45309"; corPrazo = "#b45309"; fontWeightPrazo = 600; }
  if (ativa && dias != null) {
    if (dias < 0) { corPrazo = "#dc2626"; fontWeightPrazo = 600; }
    else if (dias <= 3) { corPrazo = "#d97706"; fontWeightPrazo = 600; }
  }

  const prazoTxt = (() => {
    if (!prazo) return "";
    if (dias == null) return "prazo " + fmtDataBR(prazo);
    if (dias < 0) return `atrasado ${Math.abs(dias)} dias`;
    if (dias === 0) return "vence hoje";
    if (dias <= 5) return `faltam ${dias} dias`;
    return "prazo " + fmtDataBR(prazo);
  })();

  return (
    <div style={{
      display:"flex", flexDirection:"column", gap:1,
      ...(topBorder ? { marginTop:6, paddingTop:6, borderTop:"1px dashed #f3f4f6" } : {}),
    }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
        <span style={{ fontSize:11.5, lineHeight:1.3, color: corNome }}>
          <span style={{ display:"inline-block", width:14, fontSize:10, textAlign:"center", marginRight:4 }}>{icon}</span>
          <strong style={{ fontWeight:600 }}>{nome}</strong>
          <span style={{ color: corFuncao, fontWeight:400 }}> — {funcao}</span>
        </span>
        {prazoTxt && (
          <span style={{ fontSize:10.5, whiteSpace:"nowrap", color: corPrazo, fontWeight: fontWeightPrazo }}>
            {prazoTxt}
          </span>
        )}
      </div>
    </div>
  );
}

function motivoPadrao(colKey) {
  switch (colKey) {
    case "briefing":      return "Aguardando cliente preencher";
    case "prefeitura":    return "Aguardando análise da prefeitura";
    default: return "Aguardando";
  }
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO OBRAS (stub — será desenvolvido em fase posterior)
// ═══════════════════════════════════════════════════════════════
function Obras({ data, save }) {
  return (
    <PageContainer>
      <h2 style={{ color:"#111", fontWeight:700, fontSize:22, margin:0, letterSpacing:-0.5 }}>Obras</h2>
      <div style={{ color:"#9ca3af", fontSize:13, marginTop:4 }}>Gestão de obras em execução</div>
      <div style={{
        marginTop:32, padding:"48px 24px", textAlign:"center",
        border:"1px dashed #e5e7eb", borderRadius:10, background:"#fafafa",
      }}>
        <div style={{ color:"#6b7280", fontSize:14, marginBottom:6, fontWeight:600 }}>Módulo em desenvolvimento</div>
        <div style={{ color:"#9ca3af", fontSize:12.5, maxWidth:420, margin:"0 auto" }}>
          Este módulo será ativado em breve. Projetos que concluírem a etapa <strong style={{ color:"#374151" }}>Engenharia</strong> aparecerão aqui automaticamente.
        </div>
      </div>
    </PageContainer>
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
    <PageContainer>
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
    </PageContainer>
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
  moduleWrap: { display:"flex", flexDirection:"column", gap:20, maxWidth:1200, margin:"0 auto", padding:"24px 28px", width:"100%" },
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

function ClienteExpandivel({ cliente, data, waLink, isMobile }) {
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
          <div style={{ padding:"16px 0", display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 20, borderBottom:"1px solid #f3f4f6" }}>
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
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap:10 }}>
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

function Clientes({ data, save, onAbrirOrcamento, abrirClienteDetail, onClienteDetailAberto }) {
  // IMPORTANTE: Todos os hooks devem ser declarados ANTES de qualquer return condicional.
  // Ordem dos hooks deve ser constante entre renders (regra do React).
  const [abrindoOrcamento, setAbrindoOrcamento] = useState(false);
  const [view, setView]               = useState("kanban");
  const [sel, setSel]                 = useState(null);
  const [busca, setBusca]             = useState("");
  const [dragId, setDragId]           = useState(null);
  const [dragOver, setDragOver]       = useState(null);
  const [isMobile, setIsMobile]       = useState(typeof window !== "undefined" && window.innerWidth < 768);
  const [abaKanban, setAbaKanban]     = useState("");

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Ao retornar do orçamento, re-abre o detail do cliente que estava aberto
  useEffect(() => {
    if (abrirClienteDetail) {
      // Pega a versão mais recente do cliente (em data) para não usar objeto stale
      const atualizado = data.clientes.find(c => c.id === abrirClienteDetail.id) || abrirClienteDetail;
      setSel(atualizado);
      setView("detail");
      if (onClienteDetailAberto) onClienteDetailAberto();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirClienteDetail]);

  const emptyCliente = {
    tipo:"PF", nome:"", cpfCnpj:"", email:"", cep:"", logradouro:"", numero:"",
    complemento:"", bairro:"", cidade:"", estado:"SP",
    contatos:[{ id:uid(), nome:"", telefone:"", cargo:"", whatsapp:false }],
    observacoes:"", ativo:true, desde: new Date().toISOString().slice(0,10),
    status:"",
    servicos:{ projeto:false, acompanhamentoObra:false, gestaoObra:false, empreendimento:false }
  };
  const [form, setForm] = useState(emptyCliente);

  // Early return: só DEPOIS de todos os hooks serem declarados (regra do React)
  if (abrindoOrcamento) return null;

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

  // ── Card de cliente — reutilizado em mobile e desktop ────────
  function ClienteCard({ c, mobile }) {
    const iniciais = c.nome.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase();
    const corAv = c.tipo==="PJ" ? "#7c3aed" : "#2563eb";
    const tel = c.contatos?.find(ct=>ct.whatsapp)?.telefone || c.contatos?.[0]?.telefone || "";
    return (
      <div
        onClick={() => openDetail(c)}
        style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, padding:"12px", marginBottom:8, cursor:"pointer", transition:"box-shadow 0.15s" }}
        onMouseEnter={e=>e.currentTarget.style.borderColor="#111"}
        onMouseLeave={e=>e.currentTarget.style.borderColor="#e5e7eb"}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
          <div style={{ width:36, height:36, borderRadius:9, background:corAv+"15", color:corAv, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0 }}>
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
            {tel && <a href={waLink(tel)} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:"#16a34a", textDecoration:"none", border:"1px solid #e5e7eb", borderRadius:5, padding:"4px 8px" }}>WA</a>}
            {mobile ? (
              /* Mobile: botão mover coluna */
              <select
                value={c.status||""}
                onChange={e => { e.stopPropagation(); moverCliente(c.id, e.target.value); }}
                onClick={e => e.stopPropagation()}
                style={{ fontSize:11, color:"#6b7280", background:"#fff", border:"1px solid #e5e7eb", borderRadius:5, padding:"4px 6px", cursor:"pointer", fontFamily:"inherit" }}>
                {COLUNAS.map(col => <option key={col.key} value={col.key}>{col.label||"Leads"}</option>)}
              </select>
            ) : (
              <button onClick={e=>{e.stopPropagation();openEdit(c);}} style={{ fontSize:11, color:"#6b7280", background:"none", border:"1px solid #e5e7eb", borderRadius:5, padding:"2px 7px", cursor:"pointer", fontFamily:"inherit" }}>Editar</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── KANBAN ───────────────────────────────────────────────────
  if (view === "kanban") {
    const filtrados = data.clientes.filter(c => {
      if (!busca) return true;
      const b = busca.toLowerCase();
      return c.nome.toLowerCase().includes(b) || (c.cpfCnpj||"").includes(b) || (c.cidade||"").toLowerCase().includes(b);
    });

    // ── MOBILE: abas por coluna ──────────────────────────────
    if (isMobile) {
      const colAtual = COLUNAS.find(x => x.key === abaKanban) || COLUNAS[0];
      const cardsAba = filtrados.filter(c => (c.status||"") === abaKanban);
      return (
        <div style={{ fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", minHeight:"calc(100vh - 53px)", display:"flex", flexDirection:"column" }}>
          {/* Header mobile */}
          <div style={{ padding:"16px 16px 0", display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:17, fontWeight:700, color:"#111" }}>Clientes</div>
                <div style={{ fontSize:12, color:"#9ca3af" }}>{data.clientes.length} cadastrado{data.clientes.length!==1?"s":""}</div>
              </div>
              <button style={C.btn} onClick={openNew}>+ Novo</button>
            </div>
            <input style={{ ...C.input }} placeholder="Buscar cliente..." value={busca} onChange={e=>setBusca(e.target.value)} />
          </div>

          {/* Abas */}
          <div style={{ display:"flex", overflowX:"auto", padding:"12px 16px 0", gap:0, borderBottom:"1px solid #f3f4f6" }}>
            {COLUNAS.map(col => {
              const count = filtrados.filter(c => (c.status||"") === col.key).length;
              const ativa = abaKanban === col.key;
              return (
                <button key={col.key} onClick={() => setAbaKanban(col.key)}
                  style={{ flexShrink:0, padding:"10px 16px", fontSize:13, fontWeight: ativa ? 700 : 400,
                    color: ativa ? col.cor : "#6b7280",
                    background:"transparent", border:"none", borderBottom: ativa ? `2px solid ${col.cor}` : "2px solid transparent",
                    cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ width:7, height:7, borderRadius:"50%", background: ativa ? col.cor : "#d1d5db", display:"inline-block", flexShrink:0 }} />
                  {col.label||"Leads"}
                  <span style={{ fontSize:11, background: ativa ? col.cor+"18" : "#f3f4f6", color: ativa ? col.cor : "#9ca3af", borderRadius:10, padding:"1px 7px", fontWeight:600 }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Cards da aba ativa */}
          <div style={{ flex:1, overflowY:"auto", padding:"12px 16px" }}>
            {cardsAba.length === 0 ? (
              <div style={{ textAlign:"center", padding:"48px 0", color:"#d1d5db", fontSize:13 }}>
                <div style={{ fontSize:28, marginBottom:8 }}>—</div>
                Nenhum cliente em {colAtual.label||"Leads"}
              </div>
            ) : (
              cardsAba.map(c => <ClienteCard key={c.id} c={c} mobile={true} />)
            )}
          </div>
        </div>
      );
    }

    // ── DESKTOP: kanban 4 colunas ────────────────────────────
    return (
      <div style={{ padding:"24px 28px", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", minHeight:"calc(100vh - 53px)", display:"flex", flexDirection:"column" }}>
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

        {/* Kanban 4 colunas */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12, flex:1, overflowY:"auto" }}>
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
      <div style={{ padding: isMobile ? "16px" : "28px 32px", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
          <div style={{ fontSize:18, fontWeight:700, color:"#111" }}>Clientes</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <input style={{ ...C.input, width: isMobile ? "100%" : 220 }} placeholder="Buscar..." value={busca} onChange={e=>setBusca(e.target.value)} />
            {!isMobile && <button style={C.btnSec} onClick={()=>setView("kanban")}>Kanban</button>}
            <button style={C.btn} onClick={openNew}>+ Novo</button>
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
  if (view === "detail" && sel) {
    const cliente = data.clientes.find(c => c.id === sel.id) || sel;
    const iniciais = cliente.nome.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase();
    const corAv = cliente.tipo==="PJ"?"#7c3aed":"#2563eb";
    const col = COLUNAS.find(x=>x.key===(cliente.status||""))||COLUNAS[0];
    return (
      <div style={{ padding: isMobile ? "16px" : "28px 32px", maxWidth:780, fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20, flexWrap:"wrap" }}>
          <button style={C.btnGhost} onClick={()=>setView("kanban")}>← Voltar</button>
          <div style={{ flex:1 }} />
          <select value={cliente.status||""} onChange={e=>moverCliente(cliente.id, e.target.value)}
            style={{ ...C.input, width:"auto", fontSize:12, padding:"6px 10px", cursor:"pointer" }}>
            {COLUNAS.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
          <button style={C.btnSec} onClick={()=>openEdit(cliente)}>Editar</button>
          {!isMobile && <button style={{...C.btnGhost,color:"#dc2626"}} onClick={()=>removeCliente(cliente.id)}>Remover</button>}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:24 }}>
          <div style={{ width: isMobile ? 44 : 56, height: isMobile ? 44 : 56, borderRadius:14, background:corAv+"15", color:corAv, display:"flex", alignItems:"center", justifyContent:"center", fontSize: isMobile ? 15 : 18, fontWeight:700, flexShrink:0 }}>{iniciais}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize: isMobile ? 16 : 20, fontWeight:700, color:"#111", overflow:"hidden", textOverflow:"ellipsis" }}>{cliente.nome}</div>
            <div style={{ fontSize:12, color:"#9ca3af", marginTop:3, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
              {!isMobile && cliente.cpfCnpj}
              <span style={C.tag(corAv)}>{cliente.tipo}</span>
              <span style={C.tag(col.cor)}>{col.label||"Sem status"}</span>
            </div>
          </div>
          {isMobile && <button style={{...C.btnGhost,color:"#dc2626",fontSize:12}} onClick={()=>removeCliente(cliente.id)}>Remover</button>}
        </div>
        <ClienteExpandivel cliente={cliente} data={data} waLink={waLink} isMobile={isMobile} />
        <hr style={C.divider} />
        <ServicosPanel cliente={cliente} data={data} save={save} onAbrirOrcamento={(c, orc, modo) => { setAbrindoOrcamento(true); onAbrirOrcamento(c, orc, modo); }} />
      </div>
    );
  }

  // ── FORMULÁRIO ───────────────────────────────────────────────
  return (
    <div style={{ padding: isMobile ? "16px" : "28px 32px", maxWidth:680, fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        <button style={C.btnGhost} onClick={()=>setView("kanban")}>← Voltar</button>
        <div style={{ fontSize:17, fontWeight:700, color:"#111" }}>{form.id?"Editar cliente":"Novo cliente"}</div>
      </div>
      <div style={{ marginBottom:16 }}>
        <div style={C.secTit}>Tipo de pessoa</div>
        <div style={{ display:"flex", gap:8 }}>
          {[["PF","Pessoa física"],["PJ","Pessoa jurídica"]].map(([v,l])=>(
            <button key={v} onClick={()=>setForm({...form,tipo:v})}
              style={{ border:"1px solid #e5e7eb", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:form.tipo===v?600:400, background:form.tipo===v?"#111":"#fff", color:form.tipo===v?"#fff":"#6b7280", cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom:16 }}>
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
      <div style={{ marginBottom:16 }}>
        <div style={C.secTit}>Dados principais</div>
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:12, marginBottom:12 }}>
          <div><label style={C.label}>{form.tipo==="PJ"?"Razão social":"Nome completo"} *</label><input style={C.input} value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} /></div>
          <div><label style={C.label}>{form.tipo==="PJ"?"CNPJ":"CPF"}</label><input style={C.input} value={form.cpfCnpj} onChange={e=>setForm({...form,cpfCnpj:e.target.value})} /></div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:12, marginBottom:12 }}>
          <div><label style={C.label}>E-mail</label><input style={C.input} type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
          <div><label style={C.label}>Cliente desde</label><input style={C.input} type="date" value={form.desde} onChange={e=>setForm({...form,desde:e.target.value})} /></div>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:"#374151"}}>
          <input type="checkbox" checked={form.ativo} onChange={e=>setForm({...form,ativo:e.target.checked})} /> Cliente ativo
        </label>
      </div>
      <hr style={C.divider} />
      <div style={{ marginBottom:16 }}>
        <div style={C.secTit}>Endereço</div>
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap:10, marginBottom:10 }}>
          <div><label style={C.label}>CEP</label><input style={C.input} value={form.cep} onChange={e=>{setForm({...form,cep:e.target.value});buscarCEP(e.target.value);}} placeholder="00000-000" /></div>
          <div><label style={C.label}>Número</label><input style={C.input} value={form.numero} onChange={e=>setForm({...form,numero:e.target.value})} /></div>
          {!isMobile && <div><label style={C.label}>Complemento</label><input style={C.input} value={form.complemento} onChange={e=>setForm({...form,complemento:e.target.value})} /></div>}
        </div>
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap:10, marginBottom:10 }}>
          <div><label style={C.label}>Logradouro</label><input style={C.input} value={form.logradouro} onChange={e=>setForm({...form,logradouro:e.target.value})} /></div>
          {isMobile && <div><label style={C.label}>Complemento</label><input style={C.input} value={form.complemento} onChange={e=>setForm({...form,complemento:e.target.value})} /></div>}
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
            <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap:10, marginBottom:10 }}>
              <div style={isMobile ? { gridColumn:"1 / -1" } : {}}><label style={C.label}>Nome</label><input style={C.input} value={ct.nome} onChange={e=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,nome:e.target.value}:x)})} /></div>
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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!openMenu) return;
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu]);

  const cliente = data.clientes.find(c => c.id === clienteProp.id) || clienteProp;

  const [orcamentos, setOrcamentos] = useState((data.orcamentosProjeto||[]).filter(o=>o.clienteId===cliente.id));

  useEffect(() => {
    fetch(`${API_URL}/api/orcamentos?clienteId=${cliente.id}`)
      .then(r=>r.json())
      .then(d=>{ if(d.ok) setOrcamentos(d.data||[]); })
      .catch(()=>setOrcamentos((data.orcamentosProjeto||[]).filter(o=>o.clienteId===cliente.id)));
  }, [cliente.id, data.orcamentosProjeto?.length]);



  // ── Subview: módulo orçamento-teste ─────────────────────────
  // ── Card principal ───────────────────────────────────────────
  const temProjeto = cliente.servicos?.projeto;
  const fmt = v => "R$ " + (v||0).toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });

  const STATUS_ORC = {
    rascunho:{ label:"Rascunho",cor:"#6b7280", bg:"#f9fafb" },
    ganho:   { label:"Ganho",   cor:"#16a34a", bg:"#f0fdf4" },
    perdido: { label:"Perdido", cor:"#dc2626", bg:"#fef2f2" },
  };

  async function setStatusOrc(orcId, novoStatus) {
    const todos = data.orcamentosProjeto || [];
    const orc = todos.find(o => o.id === orcId);
    let novosLanc = data.receitasFinanceiro || [];
    if (orc?.status === "ganho" && novoStatus === "perdido") {
      novosLanc = novosLanc.filter(r => r.orcId !== orcId);
    }
    const novosOrc = todos.map(o => o.id===orcId ? {...o, status:novoStatus} : o);
    setOrcamentos(novosOrc.filter(o=>o.clienteId===cliente.id));
    await save({ ...data, orcamentosProjeto: novosOrc, receitasFinanceiro: novosLanc });
  }

  async function excluirOrcamento(orcId) {
    const novos = (data.orcamentosProjeto||[]).filter(x => x.id !== orcId);
    setOrcamentos(novos.filter(o=>o.clienteId===cliente.id));
    setConfirmDelete(null);
    save({ ...data, orcamentosProjeto: novos }).catch(console.error);
  }

  function ativarProjeto() {
    const novosServicos = { ...cliente.servicos, projeto: true };
    const novosClientes = data.clientes.map(c => c.id===cliente.id ? { ...c, servicos:novosServicos } : c);
    save({ ...data, clientes: novosClientes });
  }

  return (
    <div style={{ fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>

      {/* ── Header serviços ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1 }}>Serviços</div>
        {!temProjeto && (
          <button
            onClick={ativarProjeto}
            style={{ background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            + Adicionar Serviço
          </button>
        )}
      </div>

      {/* ── Sem serviço ── */}
      {!temProjeto && (
        <div style={{ border:"1px dashed #e5e7eb", borderRadius:12, padding:"32px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>
          Nenhum serviço cadastrado. Clique em "+ Adicionar Serviço" para começar.
        </div>
      )}

      {/* ── Serviço Projeto ── */}
      {temProjeto && (
        <div style={{ border:"1px solid #e5e7eb", borderRadius:12, padding:"16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: orcamentos.length > 0 ? 14 : 0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#3b82f6" }} />
              <span style={{ fontSize:14, fontWeight:600, color:"#111" }}>Projeto</span>
            </div>
            <button
              onClick={() => onAbrirOrcamento(cliente, null)}
              style={{ background:"#fff", color:"#111", border:"1px solid #e5e7eb", borderRadius:8, padding:"7px 16px", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
              Orçar projeto
            </button>
          </div>

          {/* Lista de orçamentos */}
          {orcamentos.length > 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.5, marginBottom:4 }}>Orçamentos</div>
              {orcamentos.map(o => {
                const r = o.resultado || {};
                const arqTotal = Math.round((r.precoArq || r.precoTotal || r.precoFinal || 0) * 100) / 100;
                const engTotal = Math.round((r.precoEng || r.engTotal || 0) * 100) / 100;
                const grandTotal = Math.round((arqTotal + engTotal) * 100) / 100;
                const isRascunho = o.rascunho || o.status === "rascunho";
                const stKey = isRascunho ? "rascunho" : o.status;
                const st = stKey ? STATUS_ORC[stKey] : null;
                const enviado = o.criadoEm ? new Date(o.criadoEm).toLocaleDateString("pt-BR") : "—";
                const fetchOrc = async (modo) => {
                  const res = await fetch(`https://orbi-production-5f5c.up.railway.app/api/orcamentos/${o.id}`).then(r=>r.json()).catch(()=>null);
                  const orcCompleto = res?.ok ? res.data : o;
                  onAbrirOrcamento(cliente, orcCompleto, modo);
                };
                return (
                  <div key={o.id} style={{
                    border: isRascunho ? "1px dashed #d1d5db" : "1px solid #e5e7eb",
                    borderRadius:10,
                    padding:"12px 14px",
                    background: isRascunho ? "#fcfcfc" : "#fafafa",
                    borderLeft: st ? `3px ${isRascunho ? "dashed" : "solid"} ${st.cor}` : "1px solid #e5e7eb"
                  }}>

                    {/* Linha 1: título + botões */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:6 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:2 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:"#111" }}>{o.tipo} — {o.subtipo}</span>
                          {st && <span style={{ fontSize:11, fontWeight:600, color:st.cor, background:st.bg, borderRadius:4, padding:"1px 7px" }}>{st.label}</span>}
                        </div>
                        <div style={{ fontSize:11, color:"#9ca3af", fontFamily:"monospace" }}>{o.id} · {enviado}</div>
                      </div>
                      {/* Botões sempre à direita, compactos */}
                      <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                        <button onClick={() => fetchOrc("ver")}
                          style={{ fontSize:12, color:"#374151", background:"#fff", border:"1px solid #e5e7eb", borderRadius:6, padding:"5px 10px", cursor:"pointer", fontFamily:"inherit" }}>
                          Ver
                        </button>
                        <button onClick={() => fetchOrc("editar")}
                          style={{ fontSize:12, color:"#374151", background:"#fff", border:"1px solid #e5e7eb", borderRadius:6, padding:"5px 10px", cursor:"pointer", fontFamily:"inherit" }}>
                          Editar
                        </button>
                        <div style={{ position:"relative" }}>
                          <button onClick={() => setOpenMenu(openMenu===o.id ? null : o.id)}
                            style={{ fontSize:12, color:"#374151", background:"#fff", border:"1px solid #e5e7eb", borderRadius:6, padding:"5px 10px", cursor:"pointer", fontFamily:"inherit", fontWeight:500 }}>
                            Ações
                          </button>
                          {openMenu === o.id && (
                            <div ref={menuRef} style={{ position:"absolute", right:0, top:"calc(100% + 4px)", zIndex:999, background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, boxShadow:"0 4px 16px rgba(0,0,0,0.1)", minWidth:180, overflow:"hidden" }}>
                              <button disabled={o.status==="ganho"} onClick={() => { setStatusOrc(o.id, "ganho"); setOpenMenu(null); }}
                                style={{ display:"block", width:"100%", textAlign:"left", background: o.status==="ganho"?"#f0fdf4":"transparent", border:"none", borderBottom:"1px solid #f3f4f6", color: o.status==="ganho"?"#16a34a":"#374151", padding:"10px 14px", fontSize:13, cursor: o.status==="ganho"?"not-allowed":"pointer", fontFamily:"inherit", fontWeight: o.status==="ganho"?600:400, whiteSpace:"nowrap" }}>
                                {o.status==="ganho" ? "✓ Ganho" : "Marcar como Ganho"}
                              </button>
                              <button onClick={() => { setStatusOrc(o.id, o.status==="perdido" ? null : "perdido"); setOpenMenu(null); }}
                                style={{ display:"block", width:"100%", textAlign:"left", background: o.status==="perdido"?"#fef2f2":"transparent", border:"none", borderBottom:"1px solid #f3f4f6", color: o.status==="perdido"?"#dc2626":"#374151", padding:"10px 14px", fontSize:13, cursor:"pointer", fontFamily:"inherit", fontWeight: o.status==="perdido"?600:400, whiteSpace:"nowrap" }}>
                                {o.status==="perdido" ? "✓ Perdido" : "Marcar como Perdido"}
                              </button>
                              <button onClick={() => { setConfirmDelete(o.id); setOpenMenu(null); }}
                                style={{ display:"block", width:"100%", textAlign:"left", background:"transparent", border:"none", color:"#dc2626", padding:"10px 14px", fontSize:13, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                                Excluir
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Linha 2: padrão · tamanho · área */}
                    <div style={{ fontSize:12, color:"#6b7280", marginBottom:8 }}>
                      {o.padrao} · {o.tamanho} · {r.areaTotal ? Math.round(r.areaTotal) : 0}m²
                    </div>

                    {/* Linha 3: valores em grid 3 colunas no mobile */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:7, padding:"7px 8px" }}>
                        <div style={{ fontSize:10, color:"#9ca3af", marginBottom:2 }}>Arq.</div>
                        <div style={{ fontSize:12, fontWeight:700, color:"#2563eb" }}>{fmt(arqTotal)}</div>
                      </div>
                      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:7, padding:"7px 8px" }}>
                        <div style={{ fontSize:10, color:"#9ca3af", marginBottom:2 }}>Eng.</div>
                        <div style={{ fontSize:12, fontWeight:700, color:"#7c3aed" }}>{fmt(engTotal)}</div>
                      </div>
                      <div style={{ background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:7, padding:"7px 8px" }}>
                        <div style={{ fontSize:10, color:"#9ca3af", marginBottom:2 }}>Total</div>
                        <div style={{ fontSize:12, fontWeight:800, color:"#111" }}>{fmt(grandTotal)}</div>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal confirmar exclusão */}
      {confirmDelete && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"28px 32px", maxWidth:380, width:"90%", boxShadow:"0 8px 32px rgba(0,0,0,0.12)" }}>
            <div style={{ fontSize:16, fontWeight:700, color:"#111", marginBottom:10 }}>Excluir orçamento?</div>
            <div style={{ fontSize:13, color:"#6b7280", marginBottom:24, lineHeight:1.6 }}>Esta ação não pode ser desfeita.</div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={{ background:"#fff", color:"#374151", border:"1px solid #e5e7eb", borderRadius:7, padding:"8px 18px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
              <button onClick={() => excluirOrcamento(confirmDelete)} style={{ background:"#dc2626", color:"#fff", border:"none", borderRadius:7, padding:"8px 18px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Sim, excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}





// ════════════════════════════════════════════════════════════
// resultado-pdf.jsx
// ════════════════════════════════════════════════════════════

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
  const temImp  = !!(orc.temImposto ?? r.impostoAplicado);
  const aliqImp = orc.aliqImp ?? r.aliquotaImposto ?? 0;
  const semFat  = temImp ? (1 - aliqImp/100) : 1;

  // ESPELHO do preview: quando orc._preview existe, usa valores exatos pré-calculados
  const P = orc._preview || null;

  // Arq e Eng SEM imposto — usa valores editados passados pelo handlePdf
  const arqCI   = P ? P.arqSI : Math.round((r.precoArq||r.precoTotal||r.precoFinal||0)*100)/100;
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
  const engCI   = P ? P.engSI : Math.round((r.precoEng||engBase)*100)/100;
  const totSI   = P ? P.totalSI : Math.round((arqCI + (incluiEng?engCI:0))*100)/100;
  const totCI   = P ? P.totalCI : (temImp ? Math.round(totSI/(1-aliqImp/100)*100)/100 : totSI);
  const impostoV= P ? P.impostoV : (temImp ? Math.round((totCI - totSI)*100)/100 : 0);
  // Engenharia com imposto (usado na linha da tabela)
  const engCIcom = P ? P.engCI : (temImp && engCI>0 ? Math.round(engCI/(1-aliqImp/100)*100)/100 : engCI);
  // Arquitetura com imposto (usado em formas de pagamento "Apenas Arquitetura")
  const arqCIcom = P ? P.arqCI : (temImp && arqCI>0 ? Math.round(arqCI/(1-aliqImp/100)*100)/100 : arqCI);
  // Etapas isoladas
  const idsIsoladosPdf = new Set(orc.etapasIsoladas || []);
  const temIsoladasPdf = idsIsoladosPdf.size > 0;
  // pctTotalIsoladoPdf: soma dos pcts das etapas selecionadas (usado para proporção entre etapas)
  const pctTotalIsoladoPdf = (orc.etapasPct||[]).filter(e=>e.id!==5).reduce((s,e)=>s+Number(e.pct),0);
  // Quando isolado, arqCI já é o valor correto — totCI já reflete o total do orçamento isolado
  const totCIBasePdf = totCI;

  // Escopo (igual preview)
  const escopoDefault = [
    { titulo:"1. Estudo de Viabilidade", objetivo:"Analisar o potencial construtivo do terreno e verificar a viabilidade de implantação do empreendimento, considerando as condicionantes físicas, urbanísticas, legais e funcionais aplicáveis ao lote.", itens:["Levantamento inicial e consolidação das informações técnicas do terreno","Análise documental e física do lote, incluindo matrícula, dimensões, topografia e características existentes","Consulta e interpretação dos parâmetros urbanísticos e restrições legais aplicáveis","Verificação da viabilidade construtiva, considerando taxa de ocupação, coeficiente de aproveitamento, recuos obrigatórios, gabarito de altura e demais condicionantes normativas","Estimativa preliminar da área edificável e do potencial de aproveitamento do terreno","Avaliação da melhor ocupação do lote, alinhada ao programa de necessidades do cliente","Definição preliminar da implantação, organização dos acessos, fluxos, circulação, áreas livres e áreas construídas","Estudo de volumetria, análise de inserção no entorno e definição de pontos focais que contribuam para a valorização do empreendimento","Dimensionamento preliminar de estacionamentos, fluxos operacionais e viabilidade de circulação para veículos leves e pesados"], entregaveis:["Estudo técnico de ocupação do terreno, com planta de implantação e setorização preliminar","Esquema conceitual de implantação, incluindo diagramas de organização espacial, acessos e condicionantes do entorno","Representações gráficas, estudo volumétrico em 3D e imagens conceituais","Relatório sintético de viabilidade construtiva, contemplando memorial descritivo, quadro de áreas e síntese dos parâmetros urbanísticos aplicáveis"], obs:"Esta etapa tem como objetivo reduzir riscos e antecipar decisões estratégicas antes do desenvolvimento do projeto, permitindo validar a compatibilidade da proposta com o terreno, com a legislação municipal e com os objetivos do empreendimento." },
    { titulo:"2. Estudo Preliminar", objetivo:"Desenvolver o conceito arquitetônico inicial, organizando os ambientes, a implantação e a linguagem estética do projeto.", itens:["Reunião de briefing e entendimento das necessidades do cliente","Definição do programa de necessidades","Estudo de implantação da edificação no terreno","Desenvolvimento da concepção arquitetônica inicial","Definição preliminar de: layout, fluxos, volumetria, setorização e linguagem estética","Compatibilização entre funcionalidade, conforto, estética e viabilidade construtiva","Ajustes conforme alinhamento com o cliente"], entregaveis:["Planta baixa preliminar","Estudo volumétrico / fachada conceitual","Implantação inicial","Imagens, croquis ou perspectivas conceituais","Apresentação para validação do conceito arquitetônico"], obs:"É nesta etapa que o projeto ganha forma. O estudo preliminar define a essência da proposta e orienta todas as fases seguintes." },
    { titulo:"3. Aprovação na Prefeitura", objetivo:"Adequar e preparar o projeto arquitetônico para protocolo e aprovação junto aos órgãos públicos competentes.", itens:["Adequação do projeto às exigências legais e urbanísticas do município","Elaboração dos desenhos técnicos exigidos para aprovação","Montagem da documentação técnica necessária ao processo","Inserção de informações obrigatórias conforme normas municipais","Preparação de pranchas, quadros de áreas e demais peças gráficas","Apoio técnico durante o processo de aprovação","Atendimento a eventuais comunique-se ou exigências técnicas da prefeitura"], entregaveis:["Projeto legal para aprovação","Plantas, cortes, fachadas e implantação conforme exigência municipal","Quadros de áreas","Arquivos e documentação técnica para protocolo"], obs:"Não inclusos nesta etapa: taxas municipais, emolumentos, ART/RRT, levantamentos complementares, certidões e exigências extraordinárias de órgãos externos, salvo se expressamente previsto." },
    { titulo:"4. Projeto Executivo", objetivo:"Desenvolver o projeto arquitetônico em nível detalhado para execução da obra, fornecendo todas as informações necessárias para construção com precisão.", itens:["Desenvolvimento técnico completo do projeto aprovado","Detalhamento arquitetônico para obra","Definição precisa de: dimensões, níveis, cotas, eixos, paginações, esquadrias, acabamentos e elementos construtivos","Elaboração de desenhos técnicos executivos","Compatibilização arquitetônica com premissas de obra","Apoio técnico para leitura e entendimento do projeto pela equipe executora"], entregaveis:["Planta baixa executiva","Planta de locação e implantação","Planta de cobertura","Cortes e fachadas executivos","Planta de layout e pontos arquitetônicos","Planta de esquadrias e pisos","Detalhamentos construtivos","Quadro de esquadrias e quadro de áreas final"], obs:"É a etapa que transforma a ideia em construção real. Um bom projeto executivo reduz improvisos, retrabalhos e falhas de execução na obra." },
    { titulo:"5. Projetos Complementares de Engenharia", objetivo:"", itens:["Estrutural: lançamento, dimensionamento de vigas, pilares, lajes e fundações","Elétrico: dimensionamento de cargas, circuitos, quadros e pontos","Hidrossanitário: distribuição de pontos de água fria/quente, esgoto e dimensionamento","Compatibilização entre projetos arquitetônico e de engenharia para verificar possíveis interferências"], entregaveis:[], obs:"Obs.: Este item poderá ser contratado diretamente pelo cliente junto a engenheiros terceiros, ficando a compatibilização sob responsabilidade dos profissionais contratados." },
  ];

  const naoInclDefault = [
    // Etapas não selecionadas no isolamento (do preview) entram primeiro
    ...(P && P.etapasNaoIncluidas ? P.etapasNaoIncluidas : []),
    // "Projetos de Engenharia" — só quando não está em etapasNaoIncluidas
    ...(!incluiEng && !(P && P.etapasNaoIncluidas && P.etapasNaoIncluidas.some(n => n.includes("Engenharia"))) ? ["Projetos de Engenharia (Estrutural/Elétrico/Hidrossanitário)"] : []),
    // Grupo: Projetos (todos agrupados em sequência)
    "Projetos de climatização",
    "Projeto de prevenção de incêndio",
    "Projeto de automação",
    "Projeto de paisagismo",
    "Projeto de interiores",
    "Projeto de Marcenaria (Móveis internos)",
    "Projeto estrutural de estruturas metálicas",
    "Projeto estrutural de muros de contenção (>1m)",
    // Grupo: Serviços
    "Sondagem e Planialtimétrico do terreno",
    "Acompanhamento semanal de obra",
    "Gestão e execução de obra",
    "Vistoria para Caixa Econômica Federal",
    "RRT de Execução de obra",
    // Outros
    "Taxas municipais e emolumentos (CAU/Prefeitura)",
    ...(!temImp ? ["Impostos"] : []),
  ];

  const isPadrao = (orc.tipoPagamento || "padrao") !== "etapas";
  // engAtiva: considera toggle + isolamento (quando há isolamento, eng só se ela estiver isolada)
  const mostrarPrazoEng = P ? P.engAtiva : (incluiEng && (!temIsoladasPdf || idsIsoladosPdf.has(5)));
  const prazoDefault = isPadrao
    ? [...(incluiArq ? ["Prazo estimado para entrega do Projeto Arquitetônico: 30 dias úteis após contratação."] : []),
       ...(mostrarPrazoEng ? ["Prazo estimado para entrega dos Projetos de Engenharia: 30 dias úteis após aprovação na prefeitura."] : [])]
    : [...(incluiArq || mostrarPrazoEng ? ["Prazo de 30 dias úteis por etapa, contados após conclusão e aprovação de cada etapa pelo cliente."] : []),
       ...(incluiArq || mostrarPrazoEng ? ["Concluída e aprovada cada etapa, inicia-se automaticamente o prazo da etapa seguinte."] : []),
       ...(mostrarPrazoEng ? ["Projetos de Engenharia: 30 dias úteis após aprovação do projeto na Prefeitura."] : [])];

  const etapasPdf = orc.etapasPct || [];

  // IDs das etapas ativas (1-4 = arq, 5 = eng)
  const etapasAtivas = new Set(etapasPdf.map(e => e.id));
  // Mapa etapaId -> nome personalizado (para etapas customizadas)
  const etapaNomeMap = Object.fromEntries(etapasPdf.map(e => [e.id, e.nome]));

  // Engenharia ativa? (preview manda via _preview.engAtiva; senão calcula)
  const engAtivaEscopo = P ? P.engAtiva : (incluiEng && (!temIsoladasPdf || idsIsoladosPdf.has(5)));
  // Filtra e renumera escopo — usa editado da preview se disponível
  const escopoBase = (orc.escopoEditado && orc.escopoEditado.length > 0) ? orc.escopoEditado : escopoDefault;
  const escopoFiltradoPdf = (() => {
    const blocos = escopoBase.filter((bloco, i) => {
      const etId = bloco.etapaId || (i + 1);
      const isEng = bloco.isEng || (i === 4 && !orc.escopoEditado);
      // Eng só aparece se ativa (incluiEng && [sem isolamento OU eng isolada])
      if (isEng) return engAtivaEscopo;
      if (!incluiArq) return false;
      if (temIsoladasPdf && !idsIsoladosPdf.has(etId) && !bloco.custom) return false;
      if (!etapasAtivas.has(etId) && !bloco.custom) return false;
      if (etId === 1 && isPadrao) return false;
      return true;
    });
    // Blocos customizados já vêm no escopoBase quando usa escopoEditado
    if (!orc.escopoEditado) {
      etapasPdf.forEach(et => {
        if (et.id > 5) {
          blocos.splice(blocos.length - (engAtivaEscopo ? 1 : 0), 0, {
            titulo: et.nome, objetivo:"", itens:[], entregaveis:[], obs:""
          });
        }
      });
    }
    // Renumera
    let n = 0;
    return blocos.map(b => {
      const isEng = b.isEng || (b.titulo && b.titulo.includes("Engenharia") && !b.titulo.includes("Viabilidade"));
      const tituloBase = (b.titulo||"").replace(/^\d+\.\s*/,"");
      if (!isEng) { n++; return { ...b, titulo: `${n}. ${tituloBase}` }; }
      return { ...b, titulo: `${n+1}. ${tituloBase}` };
    });
  })();

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
  // minContent: altura mínima do conteúdo que DEVE acompanhar o título (se não couber, quebra antes)
  const secTitle = (txt, mt=8, minContent=20) => {
    const yAntes = y;
    nv(10 + mt + minContent);
    // Se nv quebrou a página, y foi resetado pra 22 (topo).
    // Nesse caso, reduzir o margin-top pra evitar espaço vazio excessivo no topo.
    const quebrou = y < yAntes;
    y += quebrou ? 2 : mt;
    sf("bold",7); stc(INK_LT);
    // Calcular largura SEM charSpace primeiro, depois aplicar charSpace ao desenhar
    const tw = doc.getTextWidth(txt.toUpperCase()) + txt.length * 0.6 + 4;
    doc.setCharSpace(0.6);
    tx(txt.toUpperCase(),M,y);
    doc.setCharSpace(0);
    sc(LINE,"draw"); doc.setLineWidth(0.25); doc.line(M+tw,y-1.5,W-M,y-1.5);
    y += 6;
  };

  // Bullet item
  const bullet = (txt, x=M+3, maxW=TW-7) => {
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
  let logoData = logo || null;
  if (!logoData) {
    try { const lr = await window.storage.get("escritorio-logo"); if (lr?.value) logoData = lr.value; } catch {}
  }
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
      y = qY + 3; // sem logo — só avança o y minimamente
    }
  }

  // Data + validade direita
  sf("normal",7.5); stc(INK_LT);
  tx(`${orc.cidade||"Ourinhos"}, ${dataStr}  ·  Válido até ${orc.validadeStr||validade}`, W-M, y, {align:"right"});
  hr(y+3);

  // Nome cliente + Arq à direita (label inline + valor)
  y += 10;
  sf("bold",18); stc(INK); tx(orc.cliente||"—", M, y);
  // Valor "Apenas Arquitetura" no canto superior direito só aparece quando eng está ATIVA
  // (senão é redundante — o valor arq já aparece logo abaixo em "ARQUITETURA")
  const engAtivaHeaderCalc = P ? P.engAtiva : (incluiEng && (!temIsoladasPdf || idsIsoladosPdf.has(5)));
  if (incluiArq && engAtivaHeaderCalc) {
    sf("bold",12); stc(INK); tx(fmtB(arqCI), W-M, y+1, {align:"right"});
    const wArqVal = doc.getTextWidth(fmtB(arqCI));
    const labelApenas = P && P.labelApenas ? P.labelApenas : "Apenas Arquitetura";
    sf("normal",6.5); stc(INK_LT); tx(labelApenas, W-M-wArqVal-3, y+1, {align:"right"});
  }

  // "Proposta Comercial..." abaixo do nome
  y += 7;
  sf("normal",7); stc(INK_LT);
  // Subtítulo: vem do preview ou calcula dinamicamente baseado em incluiArq/engAtiva
  // (engAtivaHeaderCalc já calculado acima respeita toggle + isolamento)
  const subTit = (P && P.subTitulo)
    ? P.subTitulo
    : (incluiArq && engAtivaHeaderCalc)
      ? "Proposta Comercial de Projetos de Arquitetura e Engenharia"
      : (incluiArq && !engAtivaHeaderCalc)
        ? "Proposta Comercial de Projetos de Arquitetura"
        : (!incluiArq && engAtivaHeaderCalc)
          ? "Proposta Comercial de Projetos de Engenharia"
          : "Proposta Comercial";
  tx(subTit, M, y);

  // Linha dupla separadora
  y += 6;
  sc(INK); doc.rect(M,y,TW,0.5,"F");
  y += 5;

  // Aviso de isolamento parcial — só quando tem arq isolada e nem todas estão (ANTES do resumo)
  if (P && P.avisoIsolado) {
    sf("bold",8.5); stc(INK);
    const ls = doc.splitTextToSize(P.avisoIsolado, TW);
    ls.forEach(ln => { nv(5); tx(ln,M,y); y+=4.5; }); y+=3;
  }
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
  // Altura dinâmica: com eng precisa de mais espaço (subtítulo "Estrutural · Elétrico · Hidrossanitário")
  // Sem eng, compacta pra não deixar gap vazio acima do "Total sem impostos"
  // engAtiva: considera toggle + isolamento
  const engAtivaPdfVal = P ? P.engAtiva : (incluiEng && (!temIsoladasPdf || idsIsoladosPdf.has(5)));
  const colH = engAtivaPdfVal ? 22 : 14;
  nv(colH+4);

  // Coluna ARQ — sempre mostra valor total de arquitetura
  sf("bold",6.5); stc(INK_LT); tx("ARQUITETURA", M, y);
  sf("bold",12); stc(INK); tx(fmtB(arqCI), M, y+8);

  // Divisor vertical e coluna Engenharia — só quando engenharia está ATIVA (toggle + isolamento)
  if (engAtivaPdfVal) {
    sc(LINE,"draw"); doc.setLineWidth(0.3); doc.line(midX, y-1, midX, y+colH);
    sf("bold",6.5); stc(INK_LT); tx("ENGENHARIA", midX+4, y);
    const wEng = doc.getTextWidth("ENGENHARIA");
    sf("normal",6); stc(INK_LT); tx("(Opcional)", midX+4+wEng+2, y);
    sf("bold",12); stc(INK); tx(fmtB(engCI), midX+4, y+8);
    sf("normal",6.5); stc(INK_LT);
    tx("Estrutural · Elétrico · Hidrossanitário", midX+4, y+14);
  }

  y += colH+2;

  // Quadro cinza — sempre visível
  nv(12);
  sc(BG); doc.roundedRect(M,y,TW,8,2,2,"F");
  sf("normal",7); stc(INK_LT);
  const totCIExib = totCI;
  const impostoVExib = impostoV;
  if (temImp) {
    const itxt = `+ Impostos — ${fmtB(impostoVExib)}   ·   Total com impostos — `;
    tx(itxt, M+4, y+5.5);
    const itw = doc.getTextWidth(itxt);
    sf("bold",7.5); stc(INK); tx(fmtB(totCIExib), M+4+itw, y+5.5);
  } else {
    tx("Total sem impostos — ", M+4, y+5.5);
    const itw2 = doc.getTextWidth("Total sem impostos — ");
    sf("bold",7.5); stc(INK); tx(fmtB(totCIExib), M+4+itw2, y+5.5);
  }
  y += 12;

  // ── CONTRATAÇÃO / FORMAS DE PAGAMENTO ─────────────────────
  // Determina se vai mostrar a tabela de etapas (para decidir o título)
  const _mostrarTabela = P ? P.mostrarTabelaEtapas !== false : (orc.mostrarTabelaEtapas !== false);
  // Se padrão, sempre "Formas de pagamento"
  // Se etapas + tabela ligada: "Contratação por etapa" (depois outro "Forma de Pagamento" abaixo)
  // Se etapas + tabela desligada: "Forma de Pagamento" direto (sem título de "Contratação por etapa")
  if (isPadrao) {
    secTitle("Formas de pagamento", 8, 40);
  } else if (_mostrarTabela) {
    secTitle("Contratação por etapa", 8, 40);
  }
  // Se !isPadrao && !_mostrarTabela, o título "Forma de Pagamento" virá abaixo (em outro secTitle)

  if (!isPadrao && etapasPdf.length > 0) {
    // Engenharia ativa? (preview manda via _preview.engAtiva; senão recalcula com isolamento)
    const engAtiva = P ? P.engAtiva : (incluiEng && (!temIsoladasPdf || idsIsoladosPdf.has(5)));
    const mostrarTabela = _mostrarTabela;

    if (mostrarTabela) {
      // Tabela de etapas
      nv(14);
      const cE=M, cP=W-M-45, cV=W-M, rH=8;
      sf("bold",7.5); stc(INK);
      tx("ETAPA",cE,y); tx("%",cP,y,{align:"right"}); tx("VALOR",cV,y,{align:"right"});
      y+=2; sc(INK); doc.rect(M,y,TW,0.5,"F"); y+=rH-1;

      etapasPdf
        .filter(e => e.id !== 5)
        .filter(e => !temIsoladasPdf || idsIsoladosPdf.has(e.id))
        .forEach(et => {
          nv(rH+3);
          sf("normal",8.5); stc(INK_MD); tx(et.nome||"",cE,y);
          const arqCIBase = temImp && arqCI>0 ? Math.round(arqCI/(1-aliqImp/100)*100)/100 : arqCI;
          // Valor: se preview mandou pré-calculado, usa; senão calcula
          const valEtapa = (et.valorCalculado !== undefined)
            ? et.valorCalculado
            : Math.round(arqCIBase*(et.pct/100)*100)/100;
          sf("normal",8.5); stc(INK_LT); tx(`${et.pct}%`,cP,y,{align:"right"});
          sf("normal",8.5); stc(INK); tx(fmtB(valEtapa),cV,y,{align:"right"});
          y+=1.5; sc(LINE); doc.rect(M,y,TW,0.3,"F"); y+=rH-1;
        });

      // Linha Engenharia — só quando eng ativa (engAtiva = incluiEng && [sem isolamento OU eng isolada])
      if (engAtiva) {
        nv(rH+2);
        sf("normal",8.5); stc(INK_MD); tx("Projetos de Engenharia",cE,y);
        const wEngTxt = doc.getTextWidth("Projetos de Engenharia");
        sf("normal",6.5); stc(INK_LT); tx("— Estrutural · Elétrico · Hidrossanitário", cE+wEngTxt+2, y);
        sf("normal",8.5); stc(INK_LT); tx("—",cP,y,{align:"right"});
        sf("normal",8.5); stc(INK); tx(fmtB(engCIcom),cV,y,{align:"right"});
        y+=1.5; sc(LINE); doc.rect(M,y,TW,0.3,"F"); y+=rH-1;
      }

      // Total — ESPELHO do preview
      nv(10);
      y+=1; sc(INK); doc.rect(M,y-1,TW,0.5,"F"); y+=3;
      sf("bold",8.5); stc(INK);
      tx("Total",cE,y);
      const etapasAtivasPdf = etapasPdf.filter(e => e.id !== 5 && (!temIsoladasPdf || idsIsoladosPdf.has(e.id)));
      const pctArqAtivo = etapasAtivasPdf.reduce((s,e) => s + Number(e.pct), 0);
      // Total: preview já calcula tudo - usa totalCI direto
      let totalPdfBase;
      if (P) {
        totalPdfBase = P.totalCI;
      } else if (etapasAtivasPdf.length > 0 && etapasAtivasPdf[0].valorCalculado !== undefined) {
        const somaEtapas = etapasAtivasPdf.reduce((s,e) => s + Number(e.valorCalculado || 0), 0);
        totalPdfBase = Math.round((somaEtapas + (engAtiva ? engCIcom : 0)) * 100) / 100;
      } else {
        const arqCIBasePdf2 = temImp && arqCI>0 ? Math.round(arqCI/(1-aliqImp/100)*100)/100 : arqCI;
        totalPdfBase = Math.round((arqCIBasePdf2*(pctArqAtivo/100) + (engAtiva?engCIcom:0))*100)/100;
      }
      tx(`${pctArqAtivo}%`, cP, y, {align:"right"});
      tx(fmtB(totalPdfBase),cV,y,{align:"right"});
      y+=6;
    }

    // Condições etapa a etapa
    const dEt = orc.descontoEtapaCtrt??5, pEt = orc.parcelasEtapaCtrt??2;
    y+=2;
    // Calcula altura TOTAL da seção (Etapa a Etapa/Apenas Arq + Pacote Completo) para manter tudo junto
    const etArqAtivasPre = (orc.etapasPct || []).filter(e => e.id !== 5 && (!temIsoladasPdf || idsIsoladosPdf.has(e.id)));
    const engAtivaPre = P ? P.engAtiva : (incluiEng && (!temIsoladasPdf || idsIsoladosPdf.has(5)));
    const mostrarTabelaPdf = P ? P.mostrarTabelaEtapas !== false : (orc.mostrarTabelaEtapas !== false);
    // Pacote: toggle ligado → (multi OU arq+eng); toggle desligado → só arq+eng
    const multiPre = etArqAtivasPre.length > 1;
    const arqEngPre = incluiArq && engAtivaPre && etArqAtivasPre.length > 0;
    const mostraPacotePre = mostrarTabelaPdf ? (multiPre || arqEngPre) : arqEngPre;
    // Etapa a Etapa: título(7) + op1(5+4) + op2(5) + hr(11) = 29 (COMPACTO com respiro antes do Pacote)
    // Apenas Arq (toggle off): título(8) + op1 arejado(5+6+4) + op2(5+5) + hr(8) = 36 (AREJADO)
    const alturaPrimeiro = mostrarTabelaPdf ? 29 : 36;
    // Pacote Completo: compacto(28) quando tem tabela, arejado(36) quando não
    const alturaPacote = mostraPacotePre ? (mostrarTabelaPdf ? 28 : 36) : 0;
    const alturaTotalFormaPgto = alturaPrimeiro + alturaPacote + 6;
    secTitle("Forma de Pagamento", 8, alturaTotalFormaPgto);

    if (mostrarTabelaPdf) {
      // Bloco "Etapa a Etapa" (toggle LIGADO)
      sf("bold",8.5); stc(INK); tx("Etapa a Etapa",M,y);
      sf("normal",6.5); stc(INK_LT); tx("Obs.: Nesta opção valores de etapas futuras podem ser reajustados.",W-M,y,{align:"right"});
      y+=7;
      // Opção 1 — Antecipado por etapa (uma linha)
      const op1LabelEt = `Opção 1: `;
      sf("bold",8.5); stc(INK_MD); tx(op1LabelEt, M+2, y);
      const wOp1Et = doc.getTextWidth(op1LabelEt);
      sf("normal",8.5); stc(INK_MD); tx(`Cada etapa paga antecipadamente com ${dEt}% de desconto.`, M+2+wOp1Et, y);
      y+=5; sc(LINE); doc.rect(M+2, y-2, TW-4, 0.3, "F"); y+=4;
      // Opção 2 — Parcelado por etapa (uma linha)
      const op2LabelEt = `Opção 2: `;
      sf("bold",8.5); stc(INK_MD); tx(op2LabelEt, M+2, y);
      const wOp2Et = doc.getTextWidth(op2LabelEt);
      sf("normal",8.5); stc(INK_MD);
      if (pEt > 1) {
        const fraseOp2 = `Cada etapa parcelada em ${pEt}× (entrada + ${pEt-1}× ao longo da etapa).`;
        tx(fraseOp2, M+2+wOp2Et, y);
        const wFraseOp2 = doc.getTextWidth(fraseOp2);
        sf("normal",6.5); stc(INK_LT); tx("sem desconto", M+2+wOp2Et+wFraseOp2+3, y);
      } else {
        tx(`Cada etapa paga à vista no início.`, M+2+wOp2Et, y);
      }
      hr(y+3); y+=11;
    } else {
      // Toggle DESLIGADO: renderiza "Apenas Arquitetura" igual Pagamento Padrão
      // Valor: subTotalArqEtapas (só arq selecionada, sem eng)
      const valorApenasArq = P && P.subTotalArqEtapas !== undefined ? P.subTotalArqEtapas : arqCIcom;
      const dArq = orc.descontoEtapa??5, pArq = orc.parcelasEtapa??3;
      const tDescArq = Math.round(valorApenasArq*(1-dArq/100)*100)/100;
      const labelApenasPgto = P && P.labelApenas ? P.labelApenas : "Apenas Arquitetura";
      sf("bold",8.5); stc(INK); tx(labelApenasPgto,M,y); y+=8;
      // Opção 1 — subtítulo cinza pequeno + valor destacado embaixo
      sf("bold",8); stc(INK_MD); tx("Opção 1", M+2, y);
      const wOp1LabApA = doc.getTextWidth("Opção 1");
      sf("normal",7); stc(INK_LT); tx(` · Pagamento antecipado com ${dArq}% de desconto`, M+2+wOp1LabApA, y); y+=5;
      const yOp1ApA = y;
      const labelOp1ApA = `De ${fmtB(valorApenasArq)} por apenas:`;
      sf("normal",8.5); stc(INK_MD); tx(labelOp1ApA, M+2, yOp1ApA);
      const wLabelOp1ApA = doc.getTextWidth(labelOp1ApA);
      sf("bold",10); stc(INK); tx(fmtB(tDescArq), M+2+wLabelOp1ApA+4, yOp1ApA);
      y = yOp1ApA + 6;
      sc(LINE); doc.rect(M+2, y-2, TW-4, 0.3, "F"); y+=4;
      // Opção 2
      sf("bold",8); stc(INK_MD); tx("Opção 2", M+2, y);
      const wOp2LabApA = doc.getTextWidth("Opção 2");
      sf("normal",7); stc(INK_LT);
      if (pArq > 1) {
        tx(` · Parcelado em ${pArq}× sem desconto`, M+2+wOp2LabApA, y);
      } else {
        tx(` · À vista`, M+2+wOp2LabApA, y);
      }
      y+=5;
      sf("normal",8.5); stc(INK_MD);
      if (pArq > 1) {
        const parcValArq = Math.round(valorApenasArq/pArq*100)/100;
        tx(`Entrada de ${fmtB(parcValArq)} + ${pArq-1}× de ${fmtB(parcValArq)}`, M+2, y);
      } else {
        tx(`${fmtB(valorApenasArq)}`, M+2, y);
      }
      hr(y+3); y+=8;
    }

    // Pacote completo etapas — mesma lógica do preview:
    // Toggle LIGADO: pacote aparece se (multiEtapas OU arq+eng)
    // Toggle DESLIGADO: pacote aparece SÓ se arq+eng (senão fica só o bloco "Apenas Arq")
    const etArqAtivas = (orc.etapasPct || []).filter(e => e.id !== 5 && (!temIsoladasPdf || idsIsoladosPdf.has(e.id)));
    const engAtivaPdf = P ? P.engAtiva : (incluiEng && (!temIsoladasPdf || idsIsoladosPdf.has(5)));
    const multiEtapasPdf = etArqAtivas.length > 1;
    const temArqEEngPdf = incluiArq && engAtivaPdf && etArqAtivas.length > 0;
    const mostraPacote = mostrarTabelaPdf
      ? (multiEtapasPdf || temArqEEngPdf)
      : temArqEEngPdf;
    if (mostraPacote) {
      // Valor do pacote vem do preview (espelho) ou recalcula
      const totalPacote = P && P.totalPacoteEtapas !== undefined ? P.totalPacoteEtapas : totCI;
      const dPac=orc.descontoPacoteCtrt??15, pPac=orc.parcelasPacoteCtrt??8;
      const tDescP=Math.round(totalPacote*(1-dPac/100)*100)/100;
      // Label dinâmico igual preview
      const labelPacotePdf = (incluiArq && engAtivaPdf)
        ? "Pacote Completo (Arq. + Eng.)"
        : "Pacote Completo";

      if (mostrarTabelaPdf) {
        // COMPACTO: quando há tabela acima, poupa espaço na página
        sf("bold",8.5); stc(INK); tx(labelPacotePdf,M,y); y+=7;
        // Opção 1 em uma linha
        const op1LabelPac = `Opção 1: `;
        sf("bold",8.5); stc(INK_MD); tx(op1LabelPac, M+2, y);
        const wOp1LabPac = doc.getTextWidth(op1LabelPac);
        const fraseOp1Pac = `Pagamento antecipado com ${dPac}% de desconto — de ${fmtB(totalPacote)} por`;
        sf("normal",8.5); stc(INK_MD); tx(fraseOp1Pac, M+2+wOp1LabPac, y);
        const wFraseOp1Pac = doc.getTextWidth(fraseOp1Pac);
        sf("bold",9.5); stc(INK); tx(fmtB(tDescP), M+2+wOp1LabPac+wFraseOp1Pac+2, y);
        y+=5; sc(LINE); doc.rect(M+2, y-2, TW-4, 0.3, "F"); y+=4;
        // Opção 2 em uma linha
        const op2LabelPac = `Opção 2: `;
        sf("bold",8.5); stc(INK_MD); tx(op2LabelPac, M+2, y);
        const wOp2LabPac = doc.getTextWidth(op2LabelPac);
        sf("normal",8.5); stc(INK_MD);
        if (pPac > 1) {
          const parcValPac = Math.round(totalPacote/pPac*100)/100;
          const fraseOp2Pac = `Parcelado em ${pPac}× — entrada de ${fmtB(parcValPac)} + ${pPac-1}× de ${fmtB(parcValPac)}.`;
          tx(fraseOp2Pac, M+2+wOp2LabPac, y);
          const wFraseOp2Pac = doc.getTextWidth(fraseOp2Pac);
          sf("normal",6.5); stc(INK_LT); tx("sem desconto", M+2+wOp2LabPac+wFraseOp2Pac+3, y);
        } else {
          tx(`À vista — ${fmtB(totalPacote)}`, M+2+wOp2LabPac, y);
        }
        hr(y+3); y+=7;
      } else {
        // AREJADO: sem tabela acima, pode ser mais espaçoso e destacar o valor
        sf("bold",8.5); stc(INK); tx(labelPacotePdf,M,y); y+=8;
        // Opção 1 — subtítulo + valor destacado
        sf("bold",8); stc(INK_MD); tx("Opção 1", M+2, y);
        const wOp1LabPac = doc.getTextWidth("Opção 1");
        sf("normal",7); stc(INK_LT); tx(` · Pagamento antecipado com ${dPac}% de desconto`, M+2+wOp1LabPac, y); y+=5;
        const yOp1Pac = y;
        const labelOp1Pac = `De ${fmtB(totalPacote)} por apenas:`;
        sf("normal",8.5); stc(INK_MD); tx(labelOp1Pac, M+2, yOp1Pac);
        const wLabelOp1Pac = doc.getTextWidth(labelOp1Pac);
        sf("bold",10); stc(INK); tx(fmtB(tDescP), M+2+wLabelOp1Pac+4, yOp1Pac);
        y = yOp1Pac + 6;
        sc(LINE); doc.rect(M+2, y-2, TW-4, 0.3, "F"); y+=4;
        // Opção 2
        sf("bold",8); stc(INK_MD); tx("Opção 2", M+2, y);
        const wOp2LabPac = doc.getTextWidth("Opção 2");
        sf("normal",7); stc(INK_LT);
        if (pPac > 1) {
          tx(` · Parcelado em ${pPac}× sem desconto`, M+2+wOp2LabPac, y);
        } else {
          tx(` · À vista`, M+2+wOp2LabPac, y);
        }
        y+=5;
        sf("normal",8.5); stc(INK_MD);
        if (pPac > 1) {
          const parcValPac = Math.round(totalPacote/pPac*100)/100;
          tx(`Entrada de ${fmtB(parcValPac)} + ${pPac-1}× de ${fmtB(parcValPac)}`, M+2, y);
        } else {
          tx(`${fmtB(totalPacote)}`, M+2, y);
        }
        hr(y+3); y+=8;
      }
    }

  } else {
    const dA=orc.descontoEtapa??5, pA=orc.parcelasEtapa??3;
    const tDescA=Math.round(arqCIcom*(1-dA/100)*100)/100;
    nv(25);
    const labelApenasPgto = P && P.labelApenas ? P.labelApenas : "Apenas Arquitetura";
    sf("bold",8.5); stc(INK); tx(labelApenasPgto,M,y); y+=8;

    // Opção 1 — antecipado com desconto
    sf("bold",8); stc(INK_MD); tx("Opção 1", M+2, y);
    const wOp1LabPad = doc.getTextWidth("Opção 1");
    sf("normal",7); stc(INK_LT); tx(` · Pagamento antecipado com ${dA}% de desconto`, M+2+wOp1LabPad, y); y+=5;
    const yOp1A = y;
    const labelOp1A = `De ${fmtB(arqCIcom)} por apenas:`;
    sf("normal",8.5); stc(INK_MD); tx(labelOp1A, M+2, yOp1A);
    const wLabelOp1A = doc.getTextWidth(labelOp1A);
    sf("bold",10); stc(INK); tx(fmtB(tDescA), M+2+wLabelOp1A+4, yOp1A);
    y = yOp1A + 6;

    // Divisória fina
    sc(LINE); doc.rect(M+2, y-2, TW-4, 0.3, "F");
    y += 4;

    // Opção 2
    sf("bold",8); stc(INK_MD); tx("Opção 2", M+2, y);
    const wOp2LabPad = doc.getTextWidth("Opção 2");
    sf("normal",7); stc(INK_LT);
    if (pA > 1) {
      tx(` · Parcelado em ${pA}× sem desconto`, M+2+wOp2LabPad, y);
    } else {
      tx(` · À vista`, M+2+wOp2LabPad, y);
    }
    y+=5;
    sf("normal",8.5); stc(INK_MD);
    if (pA > 1) {
      const parcValA = Math.round(arqCIcom/pA*100)/100;
      tx(`Entrada de ${fmtB(parcValA)} + ${pA-1}× de ${fmtB(parcValA)}`, M+2, y);
    } else {
      tx(`${fmtB(arqCIcom)}`, M+2, y);
    }
    hr(y+3); y+=8;

    if (incluiArq && incluiEng) {
      const dP=orc.descontoPacote??10, pP=orc.parcelasPacote??4;
      const tDescPad=Math.round(totCI*(1-dP/100)*100)/100;
      sf("bold",8.5); stc(INK); tx("Pacote Completo (Arq. + Eng.)",M,y); y+=8;

      // Opção 1
      sf("bold",8); stc(INK_MD); tx("Opção 1", M+2, y);
      const wOp1LabPP = doc.getTextWidth("Opção 1");
      sf("normal",7); stc(INK_LT); tx(` · Pagamento antecipado com ${dP}% de desconto`, M+2+wOp1LabPP, y); y+=5;
      const yOp1P = y;
      const labelOp1P = `De ${fmtB(totCI)} por apenas:`;
      sf("normal",8.5); stc(INK_MD); tx(labelOp1P, M+2, yOp1P);
      const wLabelOp1P = doc.getTextWidth(labelOp1P);
      sf("bold",10); stc(INK); tx(fmtB(tDescPad), M+2+wLabelOp1P+4, yOp1P);
      y = yOp1P + 6;

      // Divisória fina
      sc(LINE); doc.rect(M+2, y-2, TW-4, 0.3, "F");
      y += 4;

      // Opção 2
      sf("bold",8); stc(INK_MD); tx("Opção 2", M+2, y);
      const wOp2LabPP = doc.getTextWidth("Opção 2");
      sf("normal",7); stc(INK_LT);
      if (pP > 1) {
        tx(` · Parcelado em ${pP}× sem desconto`, M+2+wOp2LabPP, y);
      } else {
        tx(` · À vista`, M+2+wOp2LabPP, y);
      }
      y+=5;
      sf("normal",8.5); stc(INK_MD);
      if (pP > 1) {
        const parcValP = Math.round(totCI/pP*100)/100;
        tx(`Entrada de ${fmtB(parcValP)} + ${pP-1}× de ${fmtB(parcValP)}`, M+2, y);
      } else {
        tx(`${fmtB(totCI)}`, M+2, y);
      }
      hr(y+3); y+=8;
    }
  }

  // PIX
  sf("normal",8); stc(INK_LT);
  tx(orc.pixTexto || "PIX  ·  Chave CNPJ: 36.122.417/0001-74 — Leo Padovan Projetos e Construções  ·  Banco Sicoob",M,y);
  y+=8;

  // ── ESCOPO DOS SERVIÇOS ───────────────────────────────────
  secTitle("Escopo dos serviços", 8, 30);

  escopoFiltradoPdf.forEach((bloco,bi) => {
    nv(16);
    sf("bold",9.5); stc(INK); tx(bloco.titulo,M,y); y+=6;

    const tagPdf = (txt) => {
      doc.setCharSpace(0.5);
      sf("bold",7); stc(INK_LT); tx(txt.toUpperCase(),M,y);
      doc.setCharSpace(0);
      y+=5;
    };

    if (bloco.objetivo) {
      tagPdf("Objetivo");
      sf("normal",8.5); stc(INK_MD);
      const ls = doc.splitTextToSize(bloco.objetivo, TW);
      ls.forEach(ln => { nv(5); tx(ln,M,y); y+=4.5; }); y+=2;
    }

    if (bloco.itens && bloco.itens.length) {
      tagPdf("Serviços inclusos");
      bloco.itens.forEach(it => bullet(it));
      y+=2;
    }

    if (bloco.entregaveis && bloco.entregaveis.length) {
      tagPdf("Entregáveis");
      bloco.entregaveis.forEach(it => bullet(it));
      y+=2;
    }

    if (bloco.obs) {
      sf("normal",7.5); stc(INK_LT);
      const ls = doc.splitTextToSize(bloco.obs, TW);
      ls.forEach(ln => { nv(5); tx(ln,M,y); y+=4; }); y+=2;
    }

    if (bi < escopoFiltradoPdf.length-1) { nv(4); sc(LINE,"draw"); doc.setLineWidth(0.2); doc.line(M,y,W-M,y); y+=5; }
  });

  // ── SERVIÇOS NÃO INCLUSOS — 2 colunas independentes ──────
  const halfW = TW/2-8;
  // Se preview mandou custom, usa ele (converte {label,sub} → string); senão usa default do PDF
  const naoInclFinal = (P && P.naoInclCustom && P.naoInclCustom.length > 0)
    ? P.naoInclCustom.map(it => it.sub ? `${it.label} ${it.sub}` : it.label)
    : naoInclDefault;
  const col1 = naoInclFinal.filter((_,i) => i%2===0);
  const col2 = naoInclFinal.filter((_,i) => i%2===1);
  // IMPORTANTE: setar fonte normal ANTES do splitTextToSize pra cálculo de altura bater com renderização
  // Fonte reduzida (7.5) pra caber itens longos em 1 linha
  sf("normal",7.5);
  const heights1 = col1.map(t => doc.splitTextToSize(t, halfW-6).length * 4 + 2);
  const heights2 = col2.map(t => doc.splitTextToSize(t, halfW-6).length * 4 + 2);
  // Altura TOTAL de toda a lista — passa ao secTitle pra garantir que título + lista completa
  // fiquem na MESMA PÁGINA. Se não couber, quebra página ANTES do título.
  const alturaListaTotal = Math.max(
    heights1.reduce((s,h)=>s+h,0),
    heights2.reduce((s,h)=>s+h,0)
  );
  // +10 pra margem/obs final
  secTitle("Serviços não inclusos", 8, alturaListaTotal + 10);
  // Re-aplica fonte normal (secTitle usou bold)
  sf("normal",7.5);
  const totalH = alturaListaTotal;
  nv(totalH);
  const yStart = y;
  let y1 = yStart, y2 = yStart;
  stc(INK_MD);
  col1.forEach((txt, i) => {
    sf("normal",7.5); // garante normal antes de splitar e desenhar
    const ls = doc.splitTextToSize(txt, halfW-6);
    nv(heights1[i]);
    sf("normal",7.5); // re-seta após possível nova página
    tx("•", M+1, y1);
    ls.forEach((ln, li) => tx(ln, M+5, y1+li*4));
    y1 += heights1[i];
  });
  col2.forEach((txt, i) => {
    sf("normal",7.5); // garante normal
    const ls = doc.splitTextToSize(txt, halfW-6);
    tx("•", midX+1, y2);
    ls.forEach((ln, li) => tx(ln, midX+5, y2+li*4));
    y2 += heights2[i];
  });
  y = Math.max(y1, y2);
  nv(6);
  sf("normal",7.5); stc(INK_LT);
  tx("Obs: Todos os serviços não inclusos podem ser contratados como serviços adicionais.",M,y); y+=8;

  // ── PRAZO DE EXECUÇÃO ─────────────────────────────────────
  secTitle("Prazo de execução", 8, 20);
  const prazoFinal = ((P && P.prazoCustom && P.prazoCustom.length > 0) ? P.prazoCustom : prazoDefault)
    .filter(p => {
      // Remove linhas que mencionam engenharia quando engenharia não está ativa
      if (p.toLowerCase().includes("engenharia") && !mostrarPrazoEng) return false;
      return true;
    });
  prazoFinal.forEach(p => bullet(p));
  y+=4;

  // ── ACEITE DA PROPOSTA ────────────────────────────────────
  nv(55);
  secTitle("Aceite da proposta", 8, 40);

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
    prazo: ["Prazo estimado para entrega do Projeto Arquitetônico: 30 dias úteis após contratação.", "Prazo estimado para entrega dos Projetos de Engenharia: 30 dias úteis após aprovação na prefeitura."],
    aceite: { responsavel:"Arq. Leonardo Padovan", registro:"CAU A30278-3", cidade:"Ourinhos" },
    logoPos: { x:0, y:0 },
  };
}


// ════════════════════════════════════════════════════════════
// orcamento-teste.jsx
// ════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// MÓDULO ORÇAMENTO VICKE
// ═══════════════════════════════════════════════════════════════
// Fluxo de componentes:
//   TesteOrcamento           (aba de testes do app)
//   └─ FormOrcamentoProjetoTeste   (form principal: define params, etapas, pagamento)
//      └─ PropostaPreview          (preview interativo da proposta)
//         └─ buildPdf() [resultado-pdf.jsx]  (gera PDF com _preview como espelho)
//
// Convenções importantes:
//  - engAtiva = incluiEng && (!temIsoladas || idsIsolados.has(5))
//    ↳ reflete toggle de engenharia + isolamento de etapas
//  - _preview: objeto passado do preview pro PDF com valores já calculados
//    ↳ PDF sempre prioriza P.xxx antes de recalcular (evita divergências)
//  - Cascata circular de %: ao editar uma etapa isolada, ajusta a PRÓXIMA
//    na ordem circular; se é a última, ajusta a primeira.
//  - Inputs numéricos usam o helper NumInput (estado local, commit no blur)
//    para evitar perda de foco durante redistribuição de percentuais.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Helpers top-level de pluralização de cômodos (usados em múltiplos lugares)
// Constantes fora dos componentes: não recriam a cada render
// ═══════════════════════════════════════════════════════════════
const PLURAIS_IRREG = {
  "Sala TV": "salas TV",
  "Sala de jantar": "salas de jantar",
  "Hall de entrada": "halls de entrada",
  "Área de lazer": "áreas de lazer",
  "Lavabo Lazer": "lavabos lazer",
  "Closet Suíte": "closets suíte",
  "Suíte Master": "suítes master",
  "Suíte": "suítes",
  "WC": "WCs",
  "Dormitório": "dormitórios",
  "Escritório": "escritórios",
  "Depósito": "depósitos",
  "Lavabo": "lavabos",
  "Garagem": "garagens",
  "Cozinha": "cozinhas",
  "Lavanderia": "lavanderias",
  "Piscina": "piscinas",
  "Sauna": "saunas",
  "Academia": "academias",
  "Brinquedoteca": "brinquedotecas",
  "Louceiro": "louceiros",
  "Living": "livings",
  "Closet": "closets",
  "Escada": "escadas",
};
const GENERO_AMB = {
  "Garagem":"f","Hall de entrada":"m","Sala TV":"f","Sala de jantar":"f","Living":"m",
  "Cozinha":"f","Lavanderia":"f","Depósito":"m","Lavabo":"m","Escritório":"m",
  "Área de lazer":"f","Piscina":"f","Lavabo Lazer":"m","Sauna":"f","Academia":"f",
  "Brinquedoteca":"f","Louceiro":"m","Dormitório":"m","Closet":"m","WC":"m",
  "Suíte":"f","Closet Suíte":"m","Suíte Master":"f","Escada":"f",
};
const NUM_EXT_MASC = ["","um","dois","três","quatro","cinco","seis","sete","oito","nove","dez"];
const NUM_EXT_FEM  = ["","uma","duas","três","quatro","cinco","seis","sete","oito","nove","dez"];

// Formata "N nome" — número por extenso até 10, algarismo acima; pluraliza nome
// Casos especiais: "Garagem" vira "vaga de garagem" / "vagas de garagem"
function formatComodo(nome, qtd) {
  const plural = qtd > 1;
  if (nome === "Garagem") {
    const ext = qtd <= 10 ? NUM_EXT_FEM[qtd] : String(qtd);
    return `${ext} ${plural ? "vagas de garagem" : "vaga de garagem"}`;
  }
  const nomeStr = plural ? (PLURAIS_IRREG[nome] || (nome.toLowerCase() + "s")) : nome.toLowerCase();
  const genero = GENERO_AMB[nome] || "m";
  const ext = genero === "f" ? NUM_EXT_FEM : NUM_EXT_MASC;
  const qtdStr = qtd <= 10 ? ext[qtd] : String(qtd);
  return `${qtdStr} ${nomeStr}`;
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO ORÇAMENTOS (lista centralizada de todos os orçamentos)
// ═══════════════════════════════════════════════════════════════
// Tela inicial: lista com filtros (Ativos/Todos/Rascunho/Em aberto/Ganhos/Perdidos)
// + Novo Orçamento (abre modal pra escolher cliente antes de abrir formulário)
// Status de orçamento: "rascunho" | "aberto" | "ganho" | "perdido"
//
// Quando clica em Ver/Editar ou Novo (após escolher cliente), abre o FormOrcamentoProjetoTeste
// já existente passando os dados do cliente selecionado.
// ═══════════════════════════════════════════════════════════════
function TesteOrcamento({ data, save }) {
  const [orcBase, setOrcBase] = useState(null);
  const [clienteAtivo, setClienteAtivo] = useState(null); // cliente do orçamento aberto
  const [filtro, setFiltro] = useState("ativos");
  const [busca, setBusca] = useState("");
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState("");

  const orcamentos = data?.orcamentosProjeto || [];
  const clientes = data?.clientes || [];

  async function salvarOrcamento(orc) {
    const todos = data.orcamentosProjeto || [];
    const nextId = () => {
      const max = todos.reduce((mx, o) => {
        const m = (o.id || "").match(/^ORC-(\d+)$/);
        return m ? Math.max(mx, parseInt(m[1])) : mx;
      }, 0);
      return "ORC-" + String(max + 1).padStart(4, "0");
    };
    const novo = {
      ...orc,
      id: orc.id || nextId(),
      criadoEm: orc.criadoEm || new Date().toISOString(),
      clienteId: orc.clienteId || clienteAtivo?.id || null,
      status: orc.status || "rascunho",
    };
    setOrcBase(novo);
    const novos = orc.id ? todos.map(o => o.id === orc.id ? novo : o) : [...todos, novo];
    save({ ...data, orcamentosProjeto: novos }).catch(console.error);
  }

  function abrirNovoOrcamento(cliente) {
    setClienteAtivo(cliente);
    setOrcBase(null);
    setModalNovoAberto(false);
    setBuscaCliente("");
  }

  function abrirOrcamentoExistente(orc) {
    const cli = clientes.find(c => c.id === orc.clienteId) || { nome: orc.cliente || "Cliente" };
    setClienteAtivo(cli);
    setOrcBase(orc);
  }

  function voltarParaLista() {
    setOrcBase(null);
    setClienteAtivo(null);
  }

  // Se um orçamento está aberto (novo ou editando), mostra o formulário
  if (clienteAtivo) {
    return (
      <FormOrcamentoProjetoTeste
        clienteNome={clienteAtivo.nome || "Cliente"}
        clienteWA={clienteAtivo.whatsapp || clienteAtivo.telefone || ""}
        orcBase={orcBase}
        onSalvar={salvarOrcamento}
        onVoltar={voltarParaLista}
      />
    );
  }

  // ─── Lista principal ───
  const totalContadores = {
    rascunho: orcamentos.filter(o => (o.status || "rascunho") === "rascunho").length,
    aberto:   orcamentos.filter(o => o.status === "aberto").length,
    ganho:    orcamentos.filter(o => o.status === "ganho").length,
    perdido:  orcamentos.filter(o => o.status === "perdido").length,
  };
  const totalTodos = orcamentos.length;
  const totalAtivos = totalTodos - totalContadores.perdido;

  const orcFiltrados = orcamentos.filter(o => {
    const st = o.status || "rascunho";
    if (filtro === "ativos"   && st === "perdido") return false;
    if (filtro === "rascunho" && st !== "rascunho") return false;
    if (filtro === "aberto"   && st !== "aberto") return false;
    if (filtro === "ganho"    && st !== "ganho") return false;
    if (filtro === "perdido"  && st !== "perdido") return false;
    if (busca) {
      const cli = clientes.find(c => c.id === o.clienteId);
      const nomeCli = (cli?.nome || o.cliente || "").toLowerCase();
      const ref = (o.referencia || "").toLowerCase();
      const q = busca.toLowerCase();
      if (!nomeCli.includes(q) && !ref.includes(q)) return false;
    }
    return true;
  });

  // Clientes filtrados no modal de novo
  const clientesFiltrados = buscaCliente.trim()
    ? clientes.filter(c => {
        const q = buscaCliente.toLowerCase();
        return (c.nome || "").toLowerCase().includes(q) ||
               (c.telefone || "").includes(q) ||
               (c.whatsapp || "").includes(q);
      })
    : clientes.slice(0, 20);

  return (
    <PageContainer>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:20 }}>
        <div>
          <h2 style={{ color:"#111", fontWeight:700, fontSize:22, margin:0, letterSpacing:-0.5 }}>Orçamentos</h2>
          <div style={{ color:"#9ca3af", fontSize:13, marginTop:4 }}>Lista de todos os orçamentos do escritório</div>
        </div>
        <button
          onClick={() => setModalNovoAberto(true)}
          style={{
            background:"#111", color:"#fff", border:"1px solid #111",
            borderRadius:7, padding:"8px 14px", fontSize:13, fontWeight:500,
            cursor:"pointer", fontFamily:"inherit",
          }}>
          + Novo Orçamento
        </button>
      </div>

      {/* Toolbar: filtros + busca */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        <OrcFilterPill label="Ativos"    count={totalAtivos}              active={filtro==="ativos"}   onClick={()=>setFiltro("ativos")} />
        <OrcFilterPill label="Todos"     count={totalTodos}               active={filtro==="todos"}    onClick={()=>setFiltro("todos")} countColor="#9ca3af" />
        <OrcFilterPill label="Rascunho"  count={totalContadores.rascunho} active={filtro==="rascunho"} onClick={()=>setFiltro("rascunho")} countColor="#6b7280" />
        <OrcFilterPill label="Em aberto" count={totalContadores.aberto}   active={filtro==="aberto"}   onClick={()=>setFiltro("aberto")}   countColor="#2563eb" />
        <OrcFilterPill label="Ganhos"    count={totalContadores.ganho}    active={filtro==="ganho"}    onClick={()=>setFiltro("ganho")}    countColor="#16a34a" />
        <OrcFilterPill label="Perdidos"  count={totalContadores.perdido}  active={filtro==="perdido"}  onClick={()=>setFiltro("perdido")}  countColor="#b91c1c" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar cliente ou referência…"
          style={{
            flex:1, maxWidth:280, padding:"6px 12px",
            border:"1px solid #e5e7eb", borderRadius:6,
            fontSize:12.5, color:"#111", background:"#fff",
            fontFamily:"inherit", outline:"none",
          }}
        />
      </div>

      {/* Lista */}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {orcFiltrados.length === 0 ? (
          <div style={{
            padding:"48px 24px", textAlign:"center",
            border:"1px dashed #e5e7eb", borderRadius:9, background:"#fafafa",
            color:"#9ca3af", fontSize:13,
          }}>
            {orcamentos.length === 0
              ? "Nenhum orçamento cadastrado ainda. Clique em + Novo Orçamento para começar."
              : "Nenhum orçamento corresponde aos filtros."}
          </div>
        ) : orcFiltrados.map(orc => (
          <OrcCard key={orc.id} orc={orc} clientes={clientes} onAbrir={() => abrirOrcamentoExistente(orc)} />
        ))}
      </div>

      {/* Modal Novo Orçamento */}
      {modalNovoAberto && (
        <ModalNovoOrcamento
          clientes={clientesFiltrados}
          busca={buscaCliente}
          setBusca={setBuscaCliente}
          onSelecionar={abrirNovoOrcamento}
          onFechar={() => { setModalNovoAberto(false); setBuscaCliente(""); }}
          onCadastrarNovo={() => {
            // TODO: abrir tela de cadastro de cliente (ainda não integrado)
            alert("Cadastre o cliente no módulo Clientes e volte aqui.");
          }}
        />
      )}
    </PageContainer>
  );
}

// ─── Pill de filtro ──────────────────────────────
function OrcFilterPill({ label, count, active, onClick, countColor }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize:12, color: active ? "#111" : "#6b7280",
        border:"1px solid " + (active ? "#111" : "#e5e7eb"),
        borderRadius:20, padding:"5px 12px",
        background: active ? "#f9fafb" : "#fff",
        cursor:"pointer", fontFamily:"inherit",
        display:"flex", alignItems:"center", gap:5,
      }}>
      {label}
      {count > 0 && (
        <strong style={{ marginLeft:4, color: countColor || "#111", fontWeight:600 }}>{count}</strong>
      )}
    </button>
  );
}

// ─── Card de orçamento na lista ──────────────────
function OrcCard({ orc, clientes, onAbrir }) {
  const cliente = clientes.find(c => c.id === orc.clienteId);
  const nomeCliente = cliente?.nome || orc.cliente || "—";
  const status = orc.status || "rascunho";
  const area = orc.resultado?.areaTotal || 0;
  const precoArq = orc.resultado?.precoArq || 0;
  const precoEng = orc.resultado?.precoEng || 0;
  const valorTotal = precoArq + precoEng;
  const tipo = orc.tipo || "—";
  const ref = orc.referencia || "(sem referência)";
  const dataCriado = orc.criadoEm ? new Date(orc.criadoEm) : null;
  const dataFmt = dataCriado ? dataCriado.toLocaleDateString("pt-BR", { day:"2-digit", month:"short" }).replace(".", "") : "";

  const STATUS_TAGS = {
    rascunho: { label:"Rascunho",  bg:"#f3f4f6", color:"#6b7280" },
    aberto:   { label:"Em aberto", bg:"#eff6ff", color:"#2563eb" },
    ganho:    { label:"Ganho",     bg:"#f0fdf4", color:"#16a34a" },
    perdido:  { label:"Perdido",   bg:"#fef2f2", color:"#b91c1c" },
  };
  const tag = STATUS_TAGS[status] || STATUS_TAGS.rascunho;

  return (
    <div
      onClick={onAbrir}
      style={{
        background:"#fff", border:"1px solid #e5e7eb", borderRadius:9,
        padding:"14px 16px",
        display:"grid", gridTemplateColumns:"1fr auto", gap:16, alignItems:"center",
        transition:"all 0.12s", cursor:"pointer",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
    >
      <div style={{ minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
          <div style={{ fontSize:14, fontWeight:600, color:"#111" }}>{nomeCliente}</div>
          <span style={{
            fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5,
            padding:"2px 7px", borderRadius:4,
            background: tag.bg, color: tag.color,
          }}>{tag.label}</span>
        </div>
        <div style={{ fontSize:12, color:"#6b7280", lineHeight:1.5 }}>
          <span style={{ color:"#374151" }}>{ref}</span>
          <span style={{ color:"#9ca3af" }}> · {tipo}{area > 0 ? ` · ${area.toLocaleString("pt-BR")}m²` : ""} · {orc.id}{dataFmt ? ` · ${dataFmt}` : ""}</span>
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
        {valorTotal > 0 && (
          <div style={{ fontSize:14, fontWeight:600, color:"#111", whiteSpace:"nowrap" }}>
            R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits:0, maximumFractionDigits:0 })}
          </div>
        )}
        <div style={{ display:"flex", gap:4 }} onClick={e => e.stopPropagation()}>
          <button onClick={onAbrir} style={btnIconStyle}>Ver</button>
          <button onClick={onAbrir} style={btnIconStyle}>Editar</button>
          <button onClick={() => alert("Ações em breve: Marcar Ganho / Perdido / Excluir")} style={btnIconStyle}>Ações</button>
        </div>
      </div>
    </div>
  );
}

const btnIconStyle = {
  fontSize:11.5, color:"#6b7280",
  border:"1px solid #e5e7eb", borderRadius:5,
  padding:"3px 9px", background:"#fff",
  cursor:"pointer", fontFamily:"inherit",
};

// ─── Modal de Novo Orçamento (escolha de cliente) ──
function ModalNovoOrcamento({ clientes, busca, setBusca, onSelecionar, onFechar, onCadastrarNovo }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onFechar(); }}
      style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,0.4)",
        display:"flex", alignItems:"center", justifyContent:"center",
        zIndex:100, padding:20,
      }}>
      <div style={{
        background:"#fff", borderRadius:12, width:"100%", maxWidth:480, maxHeight:"90vh",
        display:"flex", flexDirection:"column", boxShadow:"0 20px 40px rgba(0,0,0,0.15)", overflow:"hidden",
      }}>
        <div style={{ padding:"20px 24px 12px", borderBottom:"1px solid #f3f4f6", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:17, fontWeight:700, color:"#111", letterSpacing:-0.3 }}>Novo Orçamento</div>
          <button onClick={onFechar} style={{ background:"none", border:"none", color:"#9ca3af", fontSize:18, cursor:"pointer", fontFamily:"inherit", padding:"2px 6px", lineHeight:1 }}>✕</button>
        </div>
        <div style={{ padding:"16px 24px 20px", overflowY:"auto" }}>
          <div style={{ fontSize:11, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.6, marginBottom:8, fontWeight:600 }}>
            Para qual cliente?
          </div>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar cliente por nome ou telefone…"
            autoFocus
            style={{
              width:"100%", padding:"9px 12px",
              border:"1px solid #e5e7eb", borderRadius:7,
              fontSize:13, color:"#111", fontFamily:"inherit",
              outline:"none", background:"#fff",
            }}
          />
          <div style={{
            marginTop:12, maxHeight:280, overflowY:"auto",
            border:"1px solid #f3f4f6", borderRadius:7,
          }}>
            {clientes.length === 0 ? (
              <div style={{ padding:"24px 16px", textAlign:"center", color:"#9ca3af", fontSize:12.5 }}>
                {busca ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}
              </div>
            ) : clientes.map((c, i) => (
              <div
                key={c.id || i}
                onClick={() => onSelecionar(c)}
                style={{
                  padding:"10px 14px",
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  cursor:"pointer", borderBottom: i < clientes.length - 1 ? "1px solid #f9fafb" : "none",
                  transition:"background 0.1s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ fontSize:13, color:"#111", fontWeight:500 }}>{c.nome || "(sem nome)"}</div>
                <div style={{ fontSize:11.5, color:"#9ca3af" }}>{c.telefone || c.whatsapp || ""}</div>
              </div>
            ))}
          </div>
          <div style={{
            display:"flex", alignItems:"center", gap:12, margin:"16px 0",
            color:"#d1d5db", fontSize:11, textTransform:"uppercase", letterSpacing:0.8,
          }}>
            <div style={{ flex:1, height:1, background:"#f3f4f6" }} />
            ou
            <div style={{ flex:1, height:1, background:"#f3f4f6" }} />
          </div>
          <button
            onClick={onCadastrarNovo}
            style={{
              width:"100%", padding:"10px 14px",
              border:"1px dashed #d1d5db", borderRadius:7, background:"#fff",
              fontSize:13, color:"#374151", fontWeight:500,
              fontFamily:"inherit", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:6,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor="#111"; e.currentTarget.style.color="#111"; e.currentTarget.style.background="#fafafa"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor="#d1d5db"; e.currentTarget.style.color="#374151"; e.currentTarget.style.background="#fff"; }}
          >
            + Cadastrar novo cliente
          </button>
        </div>
      </div>
    </div>
  );
}

function AreaDetalhe({ calculo, fmtNum }) {
  const [aberto, setAberto] = useState(false);
  const [engAberto, setEngAberto] = useState(false);
  const fmt2  = (v) => fmtNum(v);
  const brl  = (v) => v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const m2s  = (v, a) => a > 0 ? ` · R$ ${fmt2(Math.round(v/a*100)/100)}/m²` : "";
  const pct  = (v) => (v * 100).toLocaleString("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:0}) + "%";
  const row  = (lbl, val, opts={}) => (
    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:3, ...opts.style }}>
      <span style={{ color: opts.lblColor||"#6b7280" }}>{lbl}</span>
      <span style={{ color: opts.valColor||"#374151", fontWeight: opts.bold?600:400 }}>{val}</span>
    </div>
  );
  return (
    <div style={{ background:"#f4f5f7", border:"1px solid #dde0e5", borderRadius:8, padding:"10px 14px", marginBottom:10, fontSize:13, color:"#374151" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ fontSize:12, color:"#828a98" }}>Área útil</span>
        <span style={{ fontSize:13, color:"#374151" }}>{fmt2(calculo.areaBruta)} m²</span>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:12, color:"#828a98" }}>Área total (+circ.)</span>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:13, fontWeight:600, color:"#111" }}>{fmt2(calculo.areaTotal)} m²</span>
          <span onClick={() => setAberto(v => !v)}
            style={{ cursor:"pointer", fontSize:11, color:"#828a98", userSelect:"none", lineHeight:1 }}>
            {aberto ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {aberto && (
        <div style={{ marginTop:12, paddingTop:10, borderTop:"1px solid #c8cdd6", display:"flex", flexDirection:"column", gap:5 }}>
          {calculo.isComercial ? (<>
            {row("Área útil", fmt2(calculo.areaBruta)+" m²")}
            {row(`+ ${pct(calculo.acrescimoCirk)} Circulação`, `+${fmt2(Math.round(calculo.areaBruta*calculo.acrescimoCirk*100)/100)} m²`)}
            {(calculo.blocosCom||[]).map((b,i) => (
              <div key={i} style={{ borderTop:"1px solid #c8cdd6", marginTop:6, paddingTop:6 }}>
                {b.label === "Área Comum" ? (<>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontWeight:700, color:"#374151", marginBottom:3 }}>
                    <span>Área Comum · {fmt2(b.area1)} m²</span>
                    <span>{brl(b.precoTot)}{m2s(b.precoTot, b.area1)}</span>
                  </div>
                </>) : (<>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontWeight:700, color:"#374151", marginBottom:3 }}>
                    <span>{b.n > 1 ? `${b.n} ${b.label}s` : b.label} · {fmt2(b.area1)} m² cada · total {fmt2(Math.round(b.area1*b.n*100)/100)} m²</span>
                  </div>
                  {row(`${b.label} (1ª unid.)`, `${brl(b.precoUni)}${m2s(b.precoUni, b.area1)}`, { bold: false })}
                  {b.n > 1 && row(`Total ${b.label}s`, `${brl(b.precoTot)}${m2s(b.precoTot, b.area1*b.n)}`, { bold: true, valColor:"#111" })}
                </>)}
              </div>
            ))}
            {calculo.precoFachada > 0 && (
              <div style={{ borderTop:"1px solid #c8cdd6", marginTop:6, paddingTop:6 }}>
                {row("+15% Fachada", brl(calculo.precoFachada), { bold:false })}
              </div>
            )}
            <div style={{ borderTop:"1px solid #c8cdd6", marginTop:6, paddingTop:6 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <div style={{ fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1 }}>Engenharia <span style={{ fontSize:8, fontWeight:400, letterSpacing:0, textTransform:"none" }}>(Faixas de desconto)</span></div>
                <span onClick={() => setEngAberto(v => !v)} style={{ cursor:"pointer", fontSize:11, color:"#828a98", userSelect:"none" }}>{engAberto ? "▲" : "▼"}</span>
              </div>
              {engAberto && calculo.faixasEng.map((f, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:3 }}>
                  <span style={{ color:"#6b7280" }}>
                    {f.desconto > 0 ? `−${f.desconto.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}% · ` : ""}{fmt2(f.area)} m² × R$ {fmt2(Math.round(f.fator*50*100)/100)}/m²
                  </span>
                  <span style={{ color:"#374151", fontWeight:500 }}>R$ {fmt2(Math.round(f.preco*100)/100)}</span>
                </div>
              ))}
            </div>
          </>) : (<>
            {calculo.nRep > 1 && row(`Área Total (${calculo.nRep}x)`, `${fmt2(calculo.areaTotal)} m² → Total ${fmt2(calculo.areaTot)} m²`)}
            {row("Total de ambientes", calculo.totalAmbientes)}
            {row("Área útil", fmt2(calculo.areaBruta)+" m²")}
            {calculo.areaPiscina > 0 && row("Piscina (Excluído)", fmt2(calculo.areaPiscina)+" m²")}
            {(() => {
              const base = (calculo.areaBruta||0) + (calculo.areaPiscina||0);
              const cirkReal = base > 0 ? Math.round((calculo.areaTotal/base - 1)*100) : 0;
              const vCirk = Math.round(base*(cirkReal/100)*100)/100;
              return row(`+ ${cirkReal}% Circulação e paredes`, `+${fmt2(vCirk)} m²`);
            })()}
            <div style={{ borderTop:"1px solid #c8cdd6", marginTop:4, paddingTop:6 }}>
              <div style={{ fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Índice multiplicador</div>
              {row("Qtd de cômodos", calculo.indiceComodos.toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3}))}
              {row("Padrão", calculo.indicePadrao.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1}))}
              {row("Fator multiplicar", `x${calculo.fatorMult.toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3})}`, { bold:true, valColor:"#111" })}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, borderTop:"1px solid #c8cdd6", paddingTop:6, marginTop:2 }}>
              <span style={{ color:"#6b7280" }}>Preço base</span>
              <span style={{ color:"#374151" }}>{fmt2(calculo.precoBaseVal)} × {calculo.fatorMult.toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3})} = {fmt2(Math.round(calculo.precoBaseVal*calculo.fatorMult*100)/100)} R$/m²</span>
            </div>
            <div style={{ borderTop:"1px solid #c8cdd6", marginTop:4, paddingTop:6 }}>
              <div style={{ fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Faixa de Desconto — Arquitetura (1ª Unidade)</div>
              {calculo.faixasArqDet.map((f, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:3 }}>
                  <span style={{ color:"#6b7280" }}>{f.desconto > 0 ? `−${pct(f.desconto)} · ` : ""}{fmt2(f.area)} m² × R$ {fmt2(Math.round(f.precoM2*100)/100)}/m²</span>
                  <span style={{ color:"#374151", fontWeight:500 }}>R$ {fmt2(f.preco)}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop:"1px solid #c8cdd6", marginTop:4, paddingTop:6 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <div style={{ fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1 }}>Engenharia <span style={{ fontSize:8, fontWeight:400, letterSpacing:0 }}>(Faixas de desconto)</span></div>
                <span onClick={() => setEngAberto(v => !v)} style={{ cursor:"pointer", fontSize:11, color:"#828a98", userSelect:"none" }}>{engAberto ? "▲" : "▼"}</span>
              </div>
              {engAberto && calculo.faixasEng.map((f, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:3 }}>
                  <span style={{ color:"#6b7280" }}>{f.desconto > 0 ? `−${f.desconto.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}% · ` : ""}{fmt2(f.area)} m² × R$ {fmt2(Math.round(f.fator*50*100)/100)}/m²</span>
                  <span style={{ color:"#374151", fontWeight:500 }}>R$ {fmt2(Math.round(f.preco*100)/100)}</span>
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
      <div style={{ ...C.resumoSec, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span>Arquitetura</span>
        {hasRep && (
          <span onClick={() => setRepAberto(v => !v)} style={{ cursor:"pointer", fontSize:13, color:"#828a98", userSelect:"none" }}>
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
      <div style={{ marginTop:20, paddingTop:14, borderTop:"1px solid #dde0e5" }}>
        <div style={{ fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Total Geral</div>
        <div style={{ display:"flex", alignItems:"baseline", gap:8, marginTop:4 }}>
          <span style={{ fontSize:20, fontWeight:800, color:"#111" }}>{fmt2(calculo.precoArq + calculo.precoEng)}</span>
          <span style={C.resumoM2}>R$ {fmtNum(calculo.areaTot > 0 ? Math.round((calculo.precoArq + calculo.precoEng) / calculo.areaTot * 100) / 100 : 0)}/m²</span>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers de edição inline — top-level para preservar identidade
// entre re-renders e manter o foco ao clicar
// ─────────────────────────────────────────────────────────────
function TextoEditavel({ valor, onChange, style={}, multiline=false, placeholder="" }) {
  const [editando, setEditando] = useState(false);
  const [tmp, setTmp] = useState(valor);
  if (editando) {
    const baseStyle = { fontSize:"inherit", fontWeight:"inherit", color:"inherit", fontFamily:"inherit",
      lineHeight:"inherit", letterSpacing:"inherit", background:"#fffde7",
      border:"1px solid #b0b7c3", borderRadius:4, padding:"2px 6px", outline:"none",
      width:"100%", resize: multiline ? "vertical" : "none", boxSizing:"border-box" };
    return multiline
      ? <textarea autoFocus value={tmp} onChange={e=>setTmp(e.target.value)}
          onBlur={()=>{ onChange(tmp); setEditando(false); }}
          style={{ ...baseStyle, minHeight:60, display:"block" }} />
      : <input autoFocus value={tmp} onChange={e=>setTmp(e.target.value)}
          onBlur={()=>{ onChange(tmp); setEditando(false); }}
          onKeyDown={e=>{ if(e.key==="Enter") e.target.blur(); if(e.key==="Escape") setEditando(false); }}
          style={baseStyle} />;
  }
  return (
    <span onClick={()=>{ setTmp(valor); setEditando(true); }}
      title="Clique para editar"
      style={{ cursor:"pointer", ...style }}>
      {valor || placeholder}
    </span>
  );
}

// Textarea sempre visível com state local — commit apenas no blur.
// Só sincroniza com valor externo quando ele MUDA de fora
// (não quando recebe de volta o próprio valor commitado).
function TextareaControlado({ valor, onCommit, placeholder="", style={}, minHeight=60 }) {
  const [local, setLocal] = useState(valor || "");
  const [focado, setFocado] = useState(false);
  const ultimoExterno = useRef(valor || "");
  useEffect(() => {
    const externo = valor || "";
    if (externo !== ultimoExterno.current) {
      ultimoExterno.current = externo;
      setLocal(externo);
    }
  }, [valor]);
  return (
    <textarea
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={() => setFocado(true)}
      onBlur={() => {
        setFocado(false);
        if (local !== (valor || "")) {
          ultimoExterno.current = local;
          onCommit(local);
        }
      }}
      placeholder={focado ? "" : placeholder}
      style={{ width:"100%", fontSize:13, color:"#6b7280", fontFamily:"inherit", lineHeight:1.7,
        border:"1px solid #c8cdd6", borderRadius:6, padding:"6px 10px", outline:"none",
        resize:"vertical", minHeight, boxSizing:"border-box", background:"#f5f6f8", ...style }}
    />
  );
}

// Input single-line com mesmo visual/comportamento do TextareaControlado
function InputControlado({ valor, onCommit, placeholder="", style={} }) {
  const [local, setLocal] = useState(valor || "");
  const [focado, setFocado] = useState(false);
  const ultimoExterno = useRef(valor || "");
  useEffect(() => {
    const externo = valor || "";
    if (externo !== ultimoExterno.current) {
      ultimoExterno.current = externo;
      setLocal(externo);
    }
  }, [valor]);
  return (
    <input
      type="text"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={() => setFocado(true)}
      onBlur={() => {
        setFocado(false);
        if (local !== (valor || "")) {
          ultimoExterno.current = local;
          onCommit(local);
        }
      }}
      onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
      placeholder={focado ? "" : placeholder}
      style={{ fontSize:13, color:"#111", fontFamily:"inherit", fontWeight:600,
        border:"1px solid #c8cdd6", borderRadius:6, padding:"4px 10px", outline:"none",
        boxSizing:"border-box", background:"#f5f6f8", ...style }}
    />
  );
}

// Input de valor monetário com commit no blur
function EtapaValorInput({ valorAtual, fmtN, onCommit, borderColor, color }) {
  const [local, setLocal] = useState(fmtN(valorAtual));
  const [focado, setFocado] = useState(false);
  const ultimoExterno = useRef(valorAtual);
  useEffect(() => {
    if (!focado && valorAtual !== ultimoExterno.current) {
      ultimoExterno.current = valorAtual;
      setLocal(fmtN(valorAtual));
    }
  }, [valorAtual, focado, fmtN]);
  return (
    <input type="text"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={e => { setFocado(true); e.target.select(); }}
      onBlur={() => {
        setFocado(false);
        const raw = local.replace(/\./g, "").replace(",", ".");
        const num = parseFloat(raw);
        if (!isNaN(num) && num >= 0) {
          ultimoExterno.current = num;
          onCommit(num);
        } else {
          setLocal(fmtN(valorAtual));
        }
      }}
      onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { setLocal(fmtN(valorAtual)); e.target.blur(); } }}
      style={{ width:"100%", fontSize:12, padding:"3px 6px", border:`1px solid ${borderColor}`, borderRadius:4, textAlign:"right", fontFamily:"inherit", outline:"none", fontWeight:500, color, background:"transparent" }} />
  );
}

// Input numérico genérico (inteiro ou decimal) com commit no blur.
// Mantém estado LOCAL durante a digitação pra evitar perda de foco quando
// o estado externo desencadeia re-renders (ex: redistribuição de percentuais).
function NumInput({ valor, onCommit, decimais = 2, min = 0, max = 100, width = 50, style = {} }) {
  const [local, setLocal] = useState(String(valor).replace(".",","));
  const [focado, setFocado] = useState(false);
  const ultimoExterno = useRef(valor);
  useEffect(() => {
    if (!focado && valor !== ultimoExterno.current) {
      ultimoExterno.current = valor;
      setLocal(String(valor).replace(".",","));
    }
  }, [valor, focado]);
  return (
    <input type="text"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={e => { setFocado(true); e.target.select(); }}
      onBlur={() => {
        setFocado(false);
        const raw = local.replace(",", ".");
        let num = parseFloat(raw);
        if (isNaN(num)) { setLocal(String(valor).replace(".",",")); return; }
        num = Math.max(min, Math.min(max, num));
        if (decimais === 0) num = Math.round(num);
        ultimoExterno.current = num;
        onCommit(num);
      }}
      onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { setLocal(String(valor).replace(".",",")); e.target.blur(); } }}
      style={{ width, fontSize:12, padding:"3px 6px", border:"1px solid #e5e7eb", borderRadius:4, textAlign:"center", fontFamily:"inherit", outline:"none", ...style }} />
  );
}

// Helper: bloco de opções de pagamento (espelha o PDF)
// tipo: "pacote" (mostra valores) ou "etapaAEtapa" (só descreve)
// Para "pacote": valor, desc%, parcelas
// Para "etapaAEtapa": só desc% e parcelas
function OpcoesPagamento({ tipo, valor, desc, parcelas, fmtV }) {
  const MD = "#6b7280";
  const INK = "#111827";
  const styleContainer = { fontSize:12, color:MD, marginTop:8, lineHeight:1.6 };
  const styleLabel = { fontWeight:600, color:INK };
  const styleValor = { color:INK, fontWeight:600 };
  if (tipo === "etapaAEtapa") {
    return (
      <div style={styleContainer}>
        <div style={{ marginBottom:3 }}>
          <span style={styleLabel}>Opção 1: </span>
          Cada etapa paga antecipadamente com {desc}% de desconto.
        </div>
        <div>
          <span style={styleLabel}>Opção 2: </span>
          {parcelas > 1
            ? <>Cada etapa parcelada em {parcelas}× (entrada + {parcelas-1}× ao longo da etapa). <span style={{ fontSize:10, color:"#9ca3af" }}>sem desconto</span></>
            : <>Cada etapa paga à vista no início.</>}
        </div>
      </div>
    );
  }
  // pacote — mantém layout com valores literais
  const valorComDesc = Math.round(valor * (1 - desc/100) * 100) / 100;
  const parcVal = Math.round(valor / parcelas * 100) / 100;
  return (
    <div style={styleContainer}>
      <div style={{ marginBottom:3 }}>
        <span style={styleLabel}>Opção 1 — Pagamento antecipado ({desc}% de desconto):</span>{" "}
        De {fmtV(valor)} por <span style={styleValor}>{fmtV(valorComDesc)}</span>
      </div>
      <div>
        <span style={styleLabel}>
          Opção 2 — {parcelas > 1 ? `Parcelado em ${parcelas}× sem desconto` : "À vista"}:
        </span>{" "}
        {parcelas > 1
          ? <>Entrada de <span style={styleValor}>{fmtV(parcVal)}</span> + {parcelas-1}× de <span style={styleValor}>{fmtV(parcVal)}</span></>
          : <span style={styleValor}>{fmtV(valor)}</span>}
      </div>
    </div>
  );
}

function PropostaPreview({ data, onVoltar }) {
  // NOTA: NÃO fazer `if (!data) return null` aqui — os hooks abaixo precisam ser
  // chamados em todo render (regra do React). Em vez disso, usamos optional chaining
  // e defaults em cada acesso a `data.xxx` e retornamos null só DEPOIS dos hooks.
  const safeData = data || {};
  const { tipoProjeto, tipoObra, padrao, tipologia, tamanho, clienteNome,
          calculo,
          totSI, totCI, impostoV,
          incluiArq = true, incluiEng = true, incluiMarcenaria = false } = safeData;

  // Estados locais (antes eram props read-only) — editáveis inline
  const [tipoPgto, setTipoPgtoLocal]     = useState(data.tipoPgto || "padrao");
  const [temImposto, setTemImpostoLocal] = useState(data.temImposto || false);
  const [aliqImp, setAliqImpLocal]       = useState(data.aliqImp || 16);
  const [etapasPct, setEtapasPctLocal]   = useState(() => {
    const base = data.etapasPct || [
      { id:1, nome:"Estudo de Viabilidade",  pct:10 },
      { id:2, nome:"Estudo Preliminar",      pct:40 },
      { id:3, nome:"Aprovação na Prefeitura",pct:12 },
      { id:4, nome:"Projeto Executivo",      pct:38 },
    ];
    // Garante que a etapa 5 (Engenharia) sempre exista
    if (!base.some(e => e.id === 5)) {
      return [...base, { id:5, nome:"Engenharia", pct:0 }];
    }
    return base;
  });
  const [etapasIsoladasLocal, setEtapasIsoladasLocal] = useState(new Set(data.etapasIsoladas || []));
  const etapasIsoladas = Array.from(etapasIsoladasLocal);
  const [mostrarTabelaEtapas, setMostrarTabelaEtapas] = useState(data.mostrarTabelaEtapas ?? true);
  // Descontos/parcelas — locais também
  const [descArqLocal,     setDescArqLocal]     = useState(data.descArq     ?? 5);
  const [parcArqLocal,     setParcArqLocal]     = useState(data.parcArq     ?? 3);
  const [descPacoteLocal,  setDescPacoteLocal]  = useState(data.descPacote  ?? 10);
  const [parcPacoteLocal,  setParcPacoteLocal]  = useState(data.parcPacote  ?? 4);
  const [descEtCtrtLocal,  setDescEtCtrtLocal]  = useState(data.descEtCtrt  ?? 5);
  const [parcEtCtrtLocal,  setParcEtCtrtLocal]  = useState(data.parcEtCtrt  ?? 2);
  const [descPacCtrtLocal, setDescPacCtrtLocal] = useState(data.descPacCtrt ?? 15);
  const [parcPacCtrtLocal, setParcPacCtrtLocal] = useState(data.parcPacCtrt ?? 8);

  const fmtV = v => v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const fmtN = v => v.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
  const isPadrao = tipoPgto === "padrao";
  const hoje = new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const dataStr = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
  const validade = new Date(hoje.getTime()+15*86400000).toLocaleDateString("pt-BR");

  const areaTot = calculo.areaTot || calculo.areaTotal || 0;

  // ── Estados editáveis ──────────────────────────────────────
  const [arqEdit, setArqEdit]               = useState(incluiArq ? (calculo.precoArq || 0) : 0);
  const [engEdit, setEngEdit]               = useState(incluiEng ? (calculo.precoEng || 0) : 0);
  const [resumoEdit, setResumoEdit]         = useState(null); // null = usar dinâmico
  const [editandoArq, setEditandoArq]       = useState(false);
  const [editandoEng, setEditandoEng]       = useState(false);
  const [editandoResumo, setEditandoResumo] = useState(false);
  // Textos editáveis da proposta
  const [subTituloEdit, setSubTituloEdit]   = useState(null); // null = usar default dinâmico
  const [validadeEdit, setValidadeEdit]     = useState(new Date(hoje.getTime()+15*86400000).toLocaleDateString("pt-BR"));
  const [naoInclEdit, setNaoInclEdit]       = useState(null); // null = usar default
  const [prazoEdit, setPrazoEdit]           = useState(null); // null = usar default
  const [responsavelEdit, setResponsavelEdit] = useState("Arq. Leonardo Padovan");
  const [cauEdit, setCauEdit]               = useState("CAU A30278-3 · Ourinhos");
  const [emailEdit, setEmailEdit]           = useState("leopadovan.arq@gmail.com");
  const [telefoneEdit, setTelefoneEdit]     = useState("(14) 99767-4200");
  const [instagramEdit, setInstagramEdit]   = useState("@padovan_arquitetos");
  const [cidadeEdit, setCidadeEdit]         = useState("Ourinhos");
  const [pixEdit, setPixEdit]               = useState("PIX · Chave CNPJ: 36.122.417/0001-74 — Leo Padovan Projetos e Construções · Banco Sicoob");
  const [labelApenasEdit, setLabelApenasEdit] = useState(null); // null = usar dinâmico

  const [logoPreview, setLogoPreview]       = useState(null);

  // Carrega logo do storage ao abrir a proposta
  useEffect(() => {
    try {
      window.storage.get("escritorio-logo").then(lr => {
        if (lr?.value) setLogoPreview(lr.value);
      }).catch(()=>{});
    } catch {}
  }, []);

  const inputLogoRef = useRef(null);

  function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const data64 = ev.target.result;
      setLogoPreview(data64);
      try { window.storage.set("escritorio-logo", data64).catch(()=>{}); } catch {}
    };
    reader.readAsDataURL(file);
  }

  function handleLogoRemove() {
    setLogoPreview(null);
    try { window.storage.delete("escritorio-logo").catch(()=>{}); } catch {}
  }

  const arqOriginal  = incluiArq ? (calculo.precoArq || 0) : 0;
  const engOriginal  = incluiEng ? (calculo.precoEng || 0) : 0;
  const valorEditado = arqEdit !== arqOriginal || engEdit !== engOriginal;

  const arqCI = incluiArq ? arqEdit : 0;
  const engCI = incluiEng ? engEdit : 0;

  // Helper: converte valor SEM imposto -> COM imposto (inside calculation)
  // valor_bruto = liquido / (1 - aliq/100). Se temImposto=false, retorna o valor direto.
  const comImposto = (v) => (temImposto && v > 0)
    ? Math.round(v / (1 - aliqImp/100) * 100) / 100
    : v;
  // Inverso: converte valor COM imposto -> SEM imposto.
  const semImposto = (v) => (temImposto && v > 0)
    ? Math.round(v * (1 - aliqImp/100) * 100) / 100
    : v;

  // Recalcula totais com valores editados
  const totSIEdit   = arqCI + engCI;
  const totCIEdit   = comImposto(totSIEdit);
  const impostoEdit = temImposto ? Math.round((totCIEdit - totSIEdit) * 100) / 100 : 0;
  // Base das etapas = só arquitetura com imposto
  const arqCIEdit   = comImposto(arqCI);
  // Engenharia com imposto (para linha separada na tabela de etapas)
  const engCIEdit   = comImposto(engCI);

  // Etapa isolada — valor proporcional do total
  // Etapas isoladas — múltipla seleção (state local, manipulável inline)
  const idsIsolados     = etapasIsoladasLocal;
  const temIsoladas     = idsIsolados.size > 0;
  const etapasIsoladasObjs = temIsoladas ? etapasPct.filter(e => idsIsolados.has(e.id)) : [];
  // Compatibilidade com código que usa etapaIsoladaObj (single)
  const etapaIsoladaObj = temIsoladas ? etapasIsoladasObjs[0] : null;
  const etapasVisiveis  = (temIsoladas ? etapasPct.filter(e => idsIsolados.has(e.id)) : etapasPct).filter(e => incluiEng || e.id !== 5);
  // totSIBase = % da arq das etapas isoladas + 100% da eng (se ativa)
  const pctTotalIsolado = etapasIsoladasObjs.reduce((s,e) => s + (e.id !== 5 ? e.pct : 0), 0);
  const engIsolada      = idsIsolados.has(5);
  // Engenharia ATIVA: incluiEng ligado E (sem isolamento OU eng isolada)
  const engAtiva        = incluiEng && (!temIsoladas || engIsolada);
  const arqIsoladaSI    = temIsoladas ? Math.round(arqCI * (pctTotalIsolado / 100) * 100) / 100 : 0;
  // Com isolamento: eng entra apenas se eng estiver isolada
  const engSI           = engAtiva ? engCI : 0;
  const totSIBase       = temIsoladas
    ? Math.round((arqIsoladaSI + engSI) * 100) / 100
    : totSIEdit;

  // Total do pacote em modo etapas — usado tanto no preview quanto no pagamento
  // Valor com imposto das etapas arq selecionadas + eng (se ativa)
  const totalPacoteEtapas = (() => {
    // Soma dos valores das etapas arq selecionadas (ou todas se sem isolamento)
    const etapasArqAtivas = etapasPct.filter(e => e.id !== 5 && (!temIsoladas || idsIsolados.has(e.id)));
    const pctAtivo = etapasArqAtivas.reduce((s,e)=>s+Number(e.pct),0);
    // arqCIEdit = arq TOTAL com imposto (base dos cálculos por etapa no preview)
    return Math.round((arqCIEdit * pctAtivo / 100 + (engAtiva ? engCIEdit : 0)) * 100) / 100;
  })();
  // Subtotal apenas das etapas de arquitetura (sem eng) — para oferecer opção "Apenas Arquitetura"
  const subTotalArqEtapas = (() => {
    const etapasArqAtivas = etapasPct.filter(e => e.id !== 5 && (!temIsoladas || idsIsolados.has(e.id)));
    const pctAtivo = etapasArqAtivas.reduce((s,e)=>s+Number(e.pct),0);
    return Math.round(arqCIEdit * pctAtivo / 100 * 100) / 100;
  })();

  // Subtítulo dinâmico — usa engAtiva (não só o toggle, mas também considera isolamento)
  const subTituloDefault = (incluiArq && engAtiva)
    ? "Proposta Comercial de Projetos de Arquitetura e Engenharia"
    : (incluiArq && !engAtiva)
      ? "Proposta Comercial de Projetos de Arquitetura"
      : (!incluiArq && engAtiva)
        ? "Proposta Comercial de Projetos de Engenharia"
        : "Proposta Comercial";
  // Valor final (edição manual ou default)
  const subTituloFinal = subTituloEdit !== null ? subTituloEdit : subTituloDefault;

  // Resumo descritivo dinâmico (prefixo "Construção nova de" / "Reforma de")
  // Recalcula sempre que tipoObra mudar, a partir dos dados originais do projeto
  const resumoDinamico = (() => {
    const fmtN2 = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
    const fmtArea = v => v > 0 ? fmtN2(v)+"m²" : null;
    const tipoObraLower = (data.tipoObra || "").toLowerCase();
    const prefixo = tipoObraLower.includes("reforma") ? "Reforma de " : "Construção nova de ";
    const calc = data.calculo || {};
    // Caso comercial (conjunto comercial com grupoQtds)
    if (data.grupoQtds && calc.blocosCom) {
      const partes = [];
      const nL = data.grupoQtds["Por Loja"]||0, nA = data.grupoQtds["Espaço Âncora"]||0;
      const nAp = data.grupoQtds["Por Apartamento"]||0, nG = data.grupoQtds["Galpao"]||0;
      if (nL>0) { const b=calc.blocosCom.find(x=>x.label==="Loja"); if(b) partes.push(`${nL} loja${nL!==1?"s":""} (${fmtArea(b.area1*nL)})`); }
      if (nA>0) { const b=calc.blocosCom.find(x=>x.label==="Âncora"); if(b) partes.push(`${nA} ${nA===1?"Espaço Âncora":"Espaços Âncoras"} (${fmtArea(b.area1*nA)})`); }
      if (nAp>0) { const b=calc.blocosCom.find(x=>x.label==="Apartamento"); if(b) partes.push(`${nAp} apartamento${nAp!==1?"s":""} (${fmtArea(b.area1*nAp)})`); }
      if (nG>0) { const b=calc.blocosCom.find(x=>x.label==="Galpão"); if(b) partes.push(`${nG} ${nG!==1?"galpões":"galpão"} (${fmtArea(b.area1*nG)})`); }
      const bc = calc.blocosCom.find(x=>x.label==="Área Comum"); if(bc) partes.push(`Área Comum (${fmtArea(bc.area1)})`);
      const lista = partes.length>1 ? partes.slice(0,-1).join(", ")+" e "+partes[partes.length-1] : partes[0]||"";
      return `${prefixo}conjunto comercial, contendo ${lista}, totalizando ${fmtArea(calc.areaTot||calc.areaTotal)}.`;
    }
    // Caso residencial
    const nUnid = calc.nRep || 1;
    const areaUni = calc.areaTotal || calc.areaTot || 0;
    const areaTotR = Math.round(areaUni * nUnid * 100)/100;
    const comodos = data.comodos || [];
    const totalAmb = comodos.reduce((s,c)=>s+(c.qtd||0),0);

    // Lista composta (ex: "duas garagens, três dormitórios e uma suíte")
    // Usa formatComodo top-level (helpers PLURAIS_IRREG, GENERO_AMB, NUM_EXT_*)
    const itensFmt = comodos.filter(c=>(c.qtd||0)>0).map(c => formatComodo(c.nome, c.qtd));
    const listaStr = itensFmt.length>1
      ? itensFmt.slice(0,-1).join(", ")+" e "+itensFmt[itensFmt.length-1]
      : itensFmt[0]||"";
    const tipDesc = (data.tipologia||"").toLowerCase().includes("sobrado") ? "com dois pavimentos" : "térrea";
    const numFem = ["","uma","duas","três","quatro","cinco","seis","sete","oito","nove","dez"];
    if (nUnid>1) {
      const nExt = nUnid>=1&&nUnid<=10 ? numFem[nUnid] : String(nUnid);
      return `${prefixo}${nExt} residências ${tipDesc} idênticas, com ${fmtN2(areaUni)}m² por unidade, totalizando ${fmtN2(areaTotR)}m² de área construída. Cada unidade composta por ${totalAmb} ambientes: ${listaStr}.`;
    }
    return `${prefixo}uma residência ${tipDesc}, com ${fmtN2(areaUni)}m² de área construída, composta por ${totalAmb} ambientes: ${listaStr}.`;
  })();
  // Valor final (edição manual preserva, senão usa dinâmico)
  const resumoFinal = resumoEdit !== null ? resumoEdit : resumoDinamico;

  // Manipuladores de etapas (isolar, adicionar, remover, editar %)
  function toggleIsolarEtapa(id) {
    setEtapasIsoladasLocal(prev => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }
  function removerEtapa(id) {
    if (id === 5) { alert("A etapa de Engenharia não pode ser removida. Use o toggle de Engenharia na Tela 1 para excluir."); return; }
    setEtapasPctLocal(prev => prev.filter(e => e.id !== id));
    setEtapasIsoladasLocal(prev => { const n = new Set(prev); n.delete(id); return n; });
  }
  function adicionarEtapa() {
    // Garante ID >= 10 para não colidir com ID=5 (Engenharia) nem com IDs padrão (1-4)
    const maxId = Math.max(9, ...etapasPct.map(e => e.id));
    const nextId = maxId + 1;
    setEtapasPctLocal(prev => {
      const engIdx = prev.findIndex(e => e.id === 5);
      const nova = { id: nextId, nome: "Nova etapa", pct: 0 };
      if (engIdx >= 0) {
        // Insere antes da engenharia
        const semEng = prev.filter(e => e.id !== 5);
        return [...semEng, nova, prev[engIdx]];
      }
      return [...prev, nova];
    });
  }
  function atualizarEtapaPct(id, novoPct) {
    // Arredonda pra inteiro (sem casas decimais)
    const clampedInt = Math.round(Math.max(0, Math.min(100, novoPct)));
    setEtapasPctLocal(prev => {
      // Sem isolamento: só atualiza
      if (!temIsoladas) {
        return prev.map(e => e.id === id ? { ...e, pct: clampedInt } : e);
      }
      const etapaAtual = prev.find(e => e.id === id);
      if (!etapaAtual) return prev;
      // Eng ou etapa não isolada: atualização simples
      if (id === 5 || !idsIsolados.has(id)) {
        return prev.map(e => e.id === id ? { ...e, pct: clampedInt } : e);
      }
      // CASCATA CIRCULAR: ajusta só a PRÓXIMA etapa na ordem.
      // Se a editada é a última da lista de isoladas, volta pra primeira.
      // Assim o total das isoladas se mantém sempre constante.
      const arqIsoladasOrdem = prev.filter(e => e.id !== 5 && idsIsolados.has(e.id));
      const idxEditada = arqIsoladasOrdem.findIndex(e => e.id === id);
      const alvo = arqIsoladasOrdem[(idxEditada + 1) % arqIsoladasOrdem.length];
      const pctAntigoEditada = Math.round(Number(etapaAtual.pct));
      const pctAntigoAlvo = Math.round(Number(alvo.pct));
      // O total a manter é: pctAntigoEditada + pctAntigoAlvo
      const totalPar = pctAntigoEditada + pctAntigoAlvo;
      // Limita o valor editado ao máximo possível (não pode passar do totalPar, senão alvo ficaria negativo)
      const pctFinalEditada = Math.min(clampedInt, totalPar);
      const pctFinalAlvo = totalPar - pctFinalEditada;
      // Só tem a editada (1 única etapa isolada): ajusta só ela
      if (arqIsoladasOrdem.length === 1) {
        return prev.map(e => e.id === id ? { ...e, pct: clampedInt } : e);
      }
      return prev.map(e => {
        if (e.id === id)    return { ...e, pct: pctFinalEditada };
        if (e.id === alvo.id) return { ...e, pct: pctFinalAlvo };
        return e;
      });
    });
  }
  function atualizarEtapaValor(id, novoValor) {
    // Converte valor R$ → % da arq base
    // (arqCIEdit é a arq total com imposto; se não tiver imposto, é arqCI mesmo)
    const base = arqCIEdit;
    if (!base || base <= 0) return;
    const novoPct = Math.round((novoValor / base) * 100 * 100) / 100; // 2 decimais
    setEtapasPctLocal(prev => prev.map(e => e.id === id ? { ...e, pct: Math.max(0, Math.min(100, novoPct)) } : e));
  }
  function atualizarEtapaNome(id, novoNome) {
    setEtapasPctLocal(prev => prev.map(e => e.id === id ? { ...e, nome: novoNome } : e));
  }

  // totCIBase = com imposto
  const totCIBase       = temIsoladas
    ? comImposto(totSIBase)
    : totCIEdit;

  function parseValorBR(str) {
    if (!str) return 0;
    const s = String(str).trim();
    // Detecta formato: se tem vírgula após ponto -> pt-BR (1.234,56)
    // Se só tem vírgula -> pode ser 1234,56 ou 1.234,56
    // Remove tudo que não é dígito nem vírgula/ponto
    const temPontoEVirgula = s.includes(".") && s.includes(",");
    if (temPontoEVirgula) {
      // pt-BR: ponto=milhar, vírgula=decimal
      return parseFloat(s.replace(/\./g,"").replace(",",".")) || 0;
    } else if (s.includes(",")) {
      // só vírgula = decimal
      return parseFloat(s.replace(",",".")) || 0;
    } else {
      // só ponto ou número puro
      return parseFloat(s) || 0;
    }
  }

  // ── Escopo como estado (sincronizado com etapasPct) ────────
  const ESCOPO_BASE = [
    { etapaId:1, titulo:"Estudo de Viabilidade", objetivo:"Analisar o potencial construtivo do terreno e verificar a viabilidade de implantação do empreendimento, considerando as condicionantes físicas, urbanísticas, legais e funcionais aplicáveis ao lote.", itens:["Levantamento inicial e consolidação das informações técnicas do terreno","Análise documental e física do lote, incluindo matrícula, dimensões, topografia e características existentes","Consulta e interpretação dos parâmetros urbanísticos e restrições legais aplicáveis","Verificação da viabilidade construtiva, considerando taxa de ocupação, coeficiente de aproveitamento, recuos obrigatórios, gabarito de altura e demais condicionantes normativas","Estimativa preliminar da área edificável e do potencial de aproveitamento do terreno","Avaliação da melhor ocupação do lote, alinhada ao programa de necessidades do cliente","Definição preliminar da implantação, organização dos acessos, fluxos, circulação, áreas livres e áreas construídas","Estudo de volumetria, análise de inserção no entorno e definição de pontos focais que contribuam para a valorização do empreendimento","Dimensionamento preliminar de estacionamentos, fluxos operacionais e viabilidade de circulação para veículos leves e pesados"], entregaveis:["Estudo técnico de ocupação do terreno, com planta de implantação e setorização preliminar","Esquema conceitual de implantação, incluindo diagramas de organização espacial, acessos e condicionantes do entorno","Representações gráficas, estudo volumétrico em 3D e imagens conceituais","Relatório sintético de viabilidade construtiva, contemplando memorial descritivo, quadro de áreas e síntese dos parâmetros urbanísticos aplicáveis"], obs:"Esta etapa tem como objetivo reduzir riscos e antecipar decisões estratégicas antes do desenvolvimento do projeto, permitindo validar a compatibilidade da proposta com o terreno, com a legislação municipal e com os objetivos do empreendimento.", isEng:false },
    { etapaId:2, titulo:"Estudo Preliminar", objetivo:"Desenvolver o conceito arquitetônico inicial, organizando os ambientes, a implantação e a linguagem estética do projeto.", itens:["Reunião de briefing e entendimento das necessidades do cliente","Definição do programa de necessidades","Estudo de implantação da edificação no terreno","Desenvolvimento da concepção arquitetônica inicial","Definição preliminar de: layout, fluxos, volumetria, setorização e linguagem estética","Compatibilização entre funcionalidade, conforto, estética e viabilidade construtiva","Ajustes conforme alinhamento com o cliente"], entregaveis:["Planta baixa preliminar","Estudo volumétrico / fachada conceitual","Implantação inicial","Imagens, croquis ou perspectivas conceituais","Apresentação para validação do conceito arquitetônico"], obs:"É nesta etapa que o projeto ganha forma. O estudo preliminar define a essência da proposta e orienta todas as fases seguintes.", isEng:false },
    { etapaId:3, titulo:"Aprovação na Prefeitura", objetivo:"Adequar e preparar o projeto arquitetônico para protocolo e aprovação junto aos órgãos públicos competentes.", itens:["Adequação do projeto às exigências legais e urbanísticas do município","Elaboração dos desenhos técnicos exigidos para aprovação","Montagem da documentação técnica necessária ao processo","Inserção de informações obrigatórias conforme normas municipais","Preparação de pranchas, quadros de áreas e demais peças gráficas","Apoio técnico durante o processo de aprovação","Atendimento a eventuais comunique-se ou exigências técnicas da prefeitura"], entregaveis:["Projeto legal para aprovação","Plantas, cortes, fachadas e implantação conforme exigência municipal","Quadros de áreas","Arquivos e documentação técnica para protocolo"], obs:"Não inclusos nesta etapa: taxas municipais, emolumentos, ART/RRT, levantamentos complementares, certidões e exigências extraordinárias de órgãos externos, salvo se expressamente previsto.", isEng:false },
    { etapaId:4, titulo:"Projeto Executivo", objetivo:"Desenvolver o projeto arquitetônico em nível detalhado para execução da obra, fornecendo todas as informações necessárias para construção com precisão.", itens:["Desenvolvimento técnico completo do projeto aprovado","Detalhamento arquitetônico para obra","Definição precisa de: dimensões, níveis, cotas, eixos, paginações, esquadrias, acabamentos e elementos construtivos","Elaboração de desenhos técnicos executivos","Compatibilização arquitetônica com premissas de obra","Apoio técnico para leitura e entendimento do projeto pela equipe executora"], entregaveis:["Planta baixa executiva","Planta de locação e implantação","Planta de cobertura","Cortes e fachadas executivos","Planta de layout e pontos arquitetônicos","Planta de esquadrias e pisos","Detalhamentos construtivos","Quadro de esquadrias e quadro de áreas final"], obs:"É a etapa que transforma a ideia em construção real. Um bom projeto executivo reduz improvisos, retrabalhos e falhas de execução na obra.", isEng:false },
    { etapaId:5, titulo:"Projetos Complementares de Engenharia", objetivo:"", itens:["Estrutural: lançamento, dimensionamento de vigas, pilares, lajes e fundações","Elétrico: dimensionamento de cargas, circuitos, quadros e pontos","Hidrossanitário: distribuição de pontos de água fria/quente, esgoto e dimensionamento","Compatibilização entre projetos arquitetônico e de engenharia para verificar possíveis interferências"], entregaveis:[], obs:"", isEng:true },
  ];

  // Estado do escopo — sincronizado com etapasPct
  const [escopoState, setEscopoState] = useState(() => {
    // IDs das etapas ativas (excluindo Engenharia que é controlada pelo toggle)
    const idsAtivos = new Set(etapasPct.map(e => e.id));
    return ESCOPO_BASE.filter(b => b.isEng || idsAtivos.has(b.etapaId));
  });

  // Sincroniza escopo quando etapasPct muda (adiciona/remove etapas)
  useEffect(() => {
    setEscopoState(prev => {
      const idsAtivos = new Set(etapasPct.map(e => e.id));
      // Remove blocos de etapas que foram excluídas (não-eng)
      const filtrado = prev.filter(b => b.isEng || idsAtivos.has(b.etapaId));
      // Adiciona blocos de etapas novas (id > 5 = customizadas)
      etapasPct.forEach(et => {
        if (et.id > 5 && !filtrado.find(b => b.etapaId === et.id)) {
          filtrado.splice(filtrado.findIndex(b=>b.isEng), 0, {
            etapaId: et.id, titulo: et.nome, objetivo:"", itens:[], entregaveis:[], obs:"", isEng:false, custom:true,
          });
        }
      });
      return filtrado;
    });
  }, [etapasPct]);

  // Guard defensivo: se data não veio, retorna null (APÓS todos os hooks)
  if (!data) return null;


  // Escopo filtrado e renumerado
  const escopoDefault = (() => {
    const blocos = escopoState.filter(b => {
      if (b.isEng) return engAtiva;
      if (!incluiArq) return false;
      if (b.etapaId === 1 && isPadrao) return false;
      if (temIsoladas && !b.isEng && !idsIsolados.has(b.etapaId) && !b.custom) return false;
      return true;
    });
    let n = 0;
    return blocos.map(b => {
      if (!b.isEng) {
        n++;
        const semNum = b.titulo.replace(/^\d+\.\s*/, "");
        return { ...b, tituloNum: `${n}. ${semNum}` };
      }
      const semNum = b.titulo.replace(/^\d+\.\s*/, "");
      return { ...b, tituloNum: `${n+1}. ${semNum}` };
    });
  })();

  // Helpers para editar escopo
  function setEscopoBloco(etapaId, campo, valor) {
    setEscopoState(prev => prev.map(b => b.etapaId === etapaId ? { ...b, [campo]: valor } : b));
  }

    // Itens fixos — simples string ou { label, sub } para texto menor
  const naoInclFixos = [
    // Grupo: Projetos (agrupados em sequência)
    "Projetos de climatização",
    "Projeto de prevenção de incêndio",
    "Projeto de automação",
    "Projeto de paisagismo",
    "Projeto de interiores",
    ...(!incluiMarcenaria ? ["Projeto de Marcenaria (Móveis internos)"] : []),
    "Projeto estrutural de estruturas metálicas",
    "Projeto estrutural de muros de contenção (>1m)",
    // Grupo: Serviços
    "Sondagem e Planialtimétrico do terreno",
    "Acompanhamento semanal de obra",
    "Gestão e execução de obra",
    "Vistoria para Caixa Econômica Federal",
    "RRT de Execução de obra",
    // Outros
    "Taxas municipais e emolumentos (CAU/Prefeitura)",
    ...(!temImposto ? ["Impostos"] : []),
  ];
  // Itens dinâmicos baseados nos toggles + isolamento — com sublabel menor
  // Etapas não isoladas (quando em modo isolamento) aparecem primeiro
  const etapasNaoSelecionadas = temIsoladas
    ? etapasPct.filter(e => e.id !== 5 && !idsIsolados.has(e.id)).map(e => ({ label: e.nome, sub: null }))
    : [];
  const naoInclDinamicos = [
    ...etapasNaoSelecionadas,
    // Eng aparece em "não inclusos" quando não ativa (sem eng no toggle OU com isolamento e eng não isolada)
    ...(!engAtiva ? [{ label:"Projetos de Engenharia", sub:"(Estrutural/Elétrico/Hidrossanitário)" }] : []),
    ...(!incluiArq ? [{ label:"Projetos de Arquitetura", sub:null }] : []),
  ];
  // Normaliza tudo para { label, sub }
  const naoInclDefault = [
    ...naoInclDinamicos,
    ...naoInclFixos.map(s => ({ label: s, sub: null })),
  ];

  const prazoDefault = isPadrao
    ? [
       ...(incluiArq ? ["Prazo estimado para entrega do Projeto Arquitetônico: 30 dias úteis após contratação."] : []),
       ...(engAtiva ? ["Prazo estimado para entrega dos Projetos de Engenharia: 30 dias úteis após aprovação na prefeitura."] : []),
      ]
    : [
       ...(incluiArq || engAtiva ? ["Prazo de 30 dias úteis por etapa, contados após conclusão e aprovação de cada etapa pelo cliente."] : []),
       ...(incluiArq || engAtiva ? ["Concluída e aprovada cada etapa, inicia-se automaticamente o prazo da etapa seguinte."] : []),
       ...(engAtiva ? ["Projetos de Engenharia: 30 dias úteis após aprovação do projeto na Prefeitura."] : []),
      ];

  const C = "#111827";
  const LT = "#828a98";
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

  const Sec = ({title, mt, children, action}) => (
    <div>
      <div style={secH(mt)}>
        <span style={secL}>{title}</span>
        <div style={secLn} />
        {action && action}
      </div>
      {children}
    </div>
  );

  const handlePdf = async () => {
    if (!window.jspdf) { alert("Aguarde 2s e tente novamente."); return; }
    try {
      const c = data.calculo;
      const nUnid = c.nRep || 1;
      // ESPELHO do preview: calcular aqui os valores exatos exibidos e passar prontos ao PDF
      // engAtiva: com isolamento, só conta se eng estiver isolada
      const engAtiva = incluiEng && (!temIsoladas || idsIsolados.has(5));
      // arq/eng exibidos no header (sem imposto)
      const arqExibidoSI = temIsoladas ? arqIsoladaSI : arqCI;
      const engExibidoSI = engAtiva ? engCI : 0;
      // com imposto (usa helper comImposto definido no escopo do componente)
      const arqExibidoCI = comImposto(arqExibidoSI);
      const engExibidoCI = comImposto(engExibidoSI);
      // total com imposto (exatamente como o preview mostra)
      const totalExibidoSI = Math.round((arqExibidoSI + engExibidoSI) * 100) / 100;
      const totalExibidoCI = comImposto(totalExibidoSI);
      // etapas que aparecem no preview (só isoladas quando tem isolamento; sem eng - eng vai separado)
      const etapasExibidas = (temIsoladas
        ? etapasPct.filter(e => e.id !== 5 && idsIsolados.has(e.id))
        : etapasPct.filter(e => e.id !== 5)
      ).map(e => ({
        ...e,
        // Valor calculado exatamente como o preview mostra
        valorCalculado: Math.round(arqCIEdit * (e.pct/100) * 100) / 100,
      }));
      // Etapas NÃO selecionadas (pra entrar em "serviços não inclusos")
      const etapasNaoIncluidas = temIsoladas
        ? etapasPct.filter(e => e.id !== 5 && !idsIsolados.has(e.id)).map(e => e.nome)
        : [];
      // Engenharia também desconsiderada quando não isolada em modo isolamento
      if (incluiEng && temIsoladas && !idsIsolados.has(5)) {
        etapasNaoIncluidas.push("Projetos de Engenharia (Estrutural/Elétrico/Hidrossanitário)");
      }

      // Frase descritiva — só aparece quando tem etapa arq ISOLADA E nem todas estão isoladas
      // (se todas as arq estão isoladas, já está óbvio no escopo — não redundar)
      let avisoIsolado = null;
      if (temIsoladas) {
        const etapasArqTotal = etapasPct.filter(e => e.id !== 5).length;
        const etapasArqIsoladas = etapasPct.filter(e => e.id !== 5 && idsIsolados.has(e.id));
        if (etapasArqIsoladas.length > 0 && etapasArqIsoladas.length < etapasArqTotal) {
          // Lista das etapas isoladas com "e" antes da última
          const nomes = etapasArqIsoladas.map(e => e.nome);
          let lista;
          if (nomes.length === 1) lista = nomes[0];
          else if (nomes.length === 2) lista = `${nomes[0]} e ${nomes[1]}`;
          else lista = `${nomes.slice(0,-1).join(", ")} e ${nomes[nomes.length-1]}`;
          const verboEtapa = nomes.length === 1 ? "à etapa de" : "às etapas de";
          avisoIsolado = `Referente ${verboEtapa} ${lista}:`;
        }
      }

      // Legado (mantido por compat do defaultModelo)
      const arqTotal = arqExibidoSI;
      const engTotal = engExibidoSI;
      const grandTotal = totalExibidoCI;
      const engUnit = engTotal;

      const r = {
        areaTotal: areaTot, areaBruta: c.areaBruta||0, nUnidades: nUnid,
        precoArq: arqTotal, precoFinal: arqTotal, precoTotal: arqTotal,
        precoEng: engTotal, engTotal,
        impostoAplicado: temImposto, aliquotaImposto: aliqImp,
      };
      const fmt   = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
      const fmtM2 = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+" m²";
      // etapasPct no PDF: passa só as que aparecem no preview
      const etapasPdfFinal = etapasExibidas;
      const orc = { id:"teste-"+Date.now(), cliente:data.clienteNome||"Cliente", tipo:data.tipoProjeto, subtipo:data.tipoObra, padrao:data.padrao, tipologia:data.tipologia, tamanho:data.tamanho, comodos:data.comodos||[], tipoPagamento:tipoPgto, descontoEtapa:descArqLocal, parcelasEtapa:parcArqLocal, descontoPacote:descPacoteLocal, parcelasPacote:parcPacoteLocal, descontoEtapaCtrt:descEtCtrtLocal, parcelasEtapaCtrt:parcEtCtrtLocal, descontoPacoteCtrt:descPacCtrtLocal, parcelasPacoteCtrt:parcPacCtrtLocal, etapasPct:etapasPdfFinal, incluiImposto:temImposto, aliquotaImposto:aliqImp, etapasIsoladas:Array.from(idsIsolados), totSI:0, criadoEm:new Date().toISOString(), resultado:r,
        // Controle de exibição
        mostrarTabelaEtapas: mostrarTabelaEtapas,
        // ESPELHO do preview: valores exatos pré-calculados (PDF usa esses em vez de recalcular)
        _preview: {
          arqSI: arqExibidoSI, arqCI: arqExibidoCI,
          engSI: engExibidoSI, engCI: engExibidoCI,
          totalSI: totalExibidoSI, totalCI: totalExibidoCI,
          impostoV: Math.round((totalExibidoCI - totalExibidoSI) * 100) / 100,
          engAtiva, mostrarTabelaEtapas,
          etapasNaoIncluidas,
          // Valores do pacote em modo etapas (igual ao que o preview mostra)
          totalPacoteEtapas,
          subTotalArqEtapas,
          // Textos editáveis da preview
          subTitulo: subTituloFinal,
          labelApenas: labelApenasEdit || (incluiArq && incluiEng ? "Apenas Arquitetura" : incluiEng && !incluiArq ? "Apenas Engenharia" : "Apenas Arquitetura"),
          avisoIsolado: avisoIsolado, // frase "Referente às etapas..." quando isolamento parcial
          prazoCustom: prazoEdit, // pode ser null (usa default do PDF)
          naoInclCustom: naoInclEdit, // pode ser null
        },
        // Textos editáveis
        cidade: cidadeEdit, validadeStr: validadeEdit, pixTexto: pixEdit,
        // Escopo editado na preview
        escopoEditado: escopoState,
      };
      const modelo = defaultModelo(orc, arqTotal, engTotal, grandTotal, fmt, fmtM2, nUnid, engUnit, r);
      if (resumoFinal && modelo.cliente) modelo.cliente.resumo = resumoFinal;
      // Sobrescreve subtítulo no modelo (modo estilo C do PDF usa modelo.subtitulo)
      if (modelo && subTituloFinal) modelo.subtitulo = subTituloFinal;
      await buildPdf(orc, logoPreview, modelo, null, "#ffffff", incluiArq, incluiEng);
    } catch(e) { console.error(e); alert("Erro ao gerar PDF: "+e.message); }
  };

  return (
    <div style={wrap}>
      <div style={page}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:36 }}>
          <button onClick={onVoltar} style={{ background:"none", border:`1px solid ${LN}`, borderRadius:8, padding:"7px 14px", fontSize:13, cursor:"pointer", fontFamily:"inherit", color:MD }}>
            ← Voltar
          </button>
          <button onClick={handlePdf} style={{ background:C, border:"none", borderRadius:8, padding:"8px 22px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", color:"#fff" }}>
            Gerar PDF
          </button>
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {logoPreview ? (
              <div style={{ position:"relative", display:"inline-flex", alignItems:"center" }}>
                <img src={logoPreview} alt="Logo" style={{ height:44, maxWidth:120, objectFit:"contain", borderRadius:4 }} />
                <button onClick={handleLogoRemove} title="Remover logo"
                  style={{ position:"absolute", top:-6, right:-6, width:16, height:16, borderRadius:"50%",
                    background:"#ef4444", border:"none", cursor:"pointer", display:"flex", alignItems:"center",
                    justifyContent:"center", fontSize:9, color:"#fff", fontWeight:700, lineHeight:1 }}>
                  ✕
                </button>
              </div>
            ) : (
              <button onClick={() => inputLogoRef.current?.click()}
                style={{ height:44, padding:"0 12px", border:"1.5px dashed #d1d5db", borderRadius:6,
                  background:"#f5f6f8", cursor:"pointer", fontSize:11, color:"#828a98", fontFamily:"inherit",
                  display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap" }}>
                + Logo
              </button>
            )}
            <input ref={inputLogoRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleLogoUpload} />
          </div>
          <div style={{ fontSize:11, color:LT }}><TextoEditavel valor={cidadeEdit} onChange={setCidadeEdit} style={{}} />, {dataStr} · Válido até <TextoEditavel valor={validadeEdit} onChange={setValidadeEdit} style={{}} /></div>
        </div>

        <div style={{ borderTop:`1.5px solid ${C}`, borderBottom:`0.5px solid ${LN}`, padding:"12px 0", marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
          <div>
            <div style={{ fontSize:24, fontWeight:600, color:C }}>{clienteNome || "Cliente"}</div>
            <div style={{ fontSize:10, color:LT, marginTop:3, letterSpacing:"0.04em" }}><TextoEditavel valor={subTituloFinal} onChange={setSubTituloEdit} style={{ fontSize:10 }} /></div>
          </div>
          <div style={{ textAlign:"right" }}>
            {incluiArq && engAtiva && (
              <>
                <div style={{ display:"flex", alignItems:"baseline", justifyContent:"flex-end", gap:6 }}>
                  <span style={{ fontSize:10, color:LT }}>Apenas Arquitetura</span>
                  <span style={{ fontSize:22, fontWeight:600, color:C }}>{fmtV(temIsoladas ? arqIsoladaSI : arqEdit)}</span>
                </div>
                {areaTot > 0 && (
                  <div style={{ fontSize:11, color:LT }}>R$ {fmtN(Math.round((temIsoladas ? arqIsoladaSI : arqCI)/areaTot*100)/100)}/m²</div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Aviso de isolamento parcial (só quando tem arq isolada E nem todas estão) */}
        {(() => {
          const etArqTotal = etapasPct.filter(e => e.id !== 5).length;
          const etArqIsoladas = etapasIsoladasObjs.filter(e => e.id !== 5);
          if (!temIsoladas || etArqIsoladas.length === 0 || etArqIsoladas.length >= etArqTotal) return null;
          const nomes = etArqIsoladas.map(e => e.nome);
          let lista;
          if (nomes.length === 1) lista = nomes[0];
          else if (nomes.length === 2) lista = `${nomes[0]} e ${nomes[1]}`;
          else lista = `${nomes.slice(0,-1).join(", ")} e ${nomes[nomes.length-1]}`;
          const verboEtapa = nomes.length === 1 ? "à etapa de" : "às etapas de";
          return (
            <div style={{ marginBottom:12, fontSize:13, color:C, fontWeight:600, lineHeight:1.5 }}>
              Referente {verboEtapa} {lista}:
            </div>
          );
        })()}
        {resumoFinal && (
          <div style={{ marginBottom:20, position:"relative" }}>
            {editandoResumo ? (
              <textarea
                autoFocus
                value={resumoFinal}
                onChange={e => setResumoEdit(e.target.value)}
                onBlur={() => setEditandoResumo(false)}
                style={{ width:"100%", fontSize:13, color:MD, lineHeight:1.7, fontFamily:"inherit",
                  background:"#fffde7", border:"2px solid #f59e0b", borderRadius:4,
                  padding:"6px 8px", outline:"none", resize:"vertical", minHeight:60, boxSizing:"border-box" }}
              />
            ) : (
              <div
                onClick={() => setEditandoResumo(true)}
                title="Clique para editar"
                style={{ fontSize:13, color:MD, lineHeight:1.7, cursor:"pointer" }}>
                {resumoFinal}
              </div>
            )}
          </div>
        )}

        <div style={{ display:"flex", alignItems:"center", gap:10, margin:"0 0 14px" }}>
          <span style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", color:"#828a98", fontWeight:600, whiteSpace:"nowrap" }}>Valores dos projetos</span>
          <div style={{ flex:1, height:1, background:"#e5e7eb" }} />
          {valorEditado && (
            <button className="no-print" onClick={() => { setArqEdit(arqOriginal); setEngEdit(engOriginal); }}
              style={{ fontSize:11, color:"#dc2626", background:"#fef2f2", border:"1px solid #fca5a5",
                borderRadius:6, padding:"3px 10px", cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap", fontWeight:600 }}>
              ↺ Restaurar valores
            </button>
          )}
        </div>
        <div>

          <div style={{ display:"grid", gridTemplateColumns: incluiArq && engAtiva ? "1fr 0.5px 1fr" : "1fr", gap:0, marginBottom:12 }}>
            {incluiArq && <div style={{ paddingRight:20 }}>
              <div style={tag}>Arquitetura</div>
              <div style={{ fontSize:20, fontWeight:600, color:C }}>
                {editandoArq ? (
                  <input autoFocus type="text"
                    key={arqCI}
                    defaultValue={(temIsoladas ? arqIsoladaSI : arqCI).toFixed(2).replace(".",",")}
                    onBlur={e => { const v = parseValorBR(e.target.value); if(v>0){ if(temIsoladas && pctTotalIsolado>0){ setArqEdit(Math.round(v/(pctTotalIsolado/100)*100)/100); } else { setArqEdit(Math.round(v*100)/100); } } setEditandoArq(false); }}
                    onKeyDown={e => { if(e.key==="Enter") e.target.blur(); if(e.key==="Escape") setEditandoArq(false); }}
                    style={{ fontSize:20, fontWeight:600, color:C, fontFamily:"inherit", background:"#fffde7",
                      border:"1px solid #b0b7c3", borderRadius:4, padding:"2px 6px", outline:"none", width:"100%" }} />
                ) : (
                  <span onClick={() => setEditandoArq(true)} title="Clique para editar" style={{ cursor:"pointer" }}>
                    {fmtV(temIsoladas ? arqIsoladaSI : arqCI)}
                  </span>
                )}
              </div>
              {areaTot > 0 && (
                <div style={{ fontSize:11, color:LT }}>R$ {fmtN(Math.round((temIsoladas ? arqIsoladaSI : arqCI)/areaTot*100)/100)}/m²</div>
              )}
            </div>}
            {incluiArq && engAtiva && <div style={{ background:LN }} />}
            {engAtiva && <div style={{ paddingLeft: incluiArq ? 20 : 0 }}>
              <div style={tag}>Engenharia <span style={{ fontSize:10, color:LT, textTransform:"none", letterSpacing:0 }}>(Opcional)</span></div>
              <div style={{ fontSize:20, fontWeight:600, color:C }}>
                {editandoEng ? (
                  <input autoFocus type="text"
                    key={engCI}
                    defaultValue={engCI.toFixed(2).replace(".",",")}
                    onBlur={e => { const v = parseValorBR(e.target.value); setEngEdit(v>0 ? Math.round(v*100)/100 : engCI); setEditandoEng(false); }}
                    onKeyDown={e => { if(e.key==="Enter") e.target.blur(); if(e.key==="Escape") setEditandoEng(false); }}
                    style={{ fontSize:20, fontWeight:600, color:C, fontFamily:"inherit", background:"#fffde7",
                      border:"1px solid #b0b7c3", borderRadius:4, padding:"2px 6px", outline:"none", width:"100%" }} />
                ) : (
                  <span onClick={() => setEditandoEng(true)} title="Clique para editar" style={{ cursor:"pointer" }}>
                    {fmtV(engCI)}
                  </span>
                )}
              </div>
              {areaTot > 0 && (
                <div style={{ fontSize:11, color:LT }}>R$ {fmtN(Math.round(engCI/areaTot*100)/100)}/m²</div>
              )}
            </div>}
          </div>
          <div style={{ border:`0.5px solid ${LN}`, borderRadius:8, padding:"10px 14px", fontSize:12, color:LT, marginBottom:4,
              display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
            <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
              <span style={{
                position:"relative", display:"inline-block", width:26, height:14,
                background: temImposto ? "#0369a1" : "#d1d5db",
                borderRadius:7, transition:"background 0.15s",
              }}>
                <span style={{
                  position:"absolute", top:2, left: temImposto ? 14 : 2,
                  width:10, height:10, background:"#fff", borderRadius:"50%",
                  transition:"left 0.15s", boxShadow:"0 1px 2px rgba(0,0,0,0.2)",
                }} />
              </span>
              <input type="checkbox" checked={temImposto} onChange={e => setTemImpostoLocal(e.target.checked)} style={{ display:"none" }} />
              <span>Incluir impostos</span>
            </label>
            {temImposto && (
              <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                <NumInput valor={aliqImp} onCommit={n => setAliqImpLocal(n)}
                  decimais={2} min={0} max={99} width={42}
                  style={{ textAlign:"right" }} />
                <span style={{ color:LT }}>%</span>
              </span>
            )}
            <span style={{ color:LN }}>·</span>
            {temImposto ? (<>
              + Impostos — <span style={{ color:MD, fontWeight:500 }}>{fmtV(temIsoladas ? Math.round((totCIBase - totSIBase)*100)/100 : impostoEdit)}</span>
              &nbsp;·&nbsp; Total com impostos — <span style={{ fontSize:13, fontWeight:600, color:C }}>{fmtV(totCIBase)}</span>
            </>) : (<>
              Total sem impostos — <span style={{ fontSize:13, fontWeight:600, color:C }}>{fmtV(totCIBase)}</span>
            </>)}
          </div>
          <div style={{ display:"flex", gap:6, marginTop:6, marginBottom:4 }}>
            <button
              onClick={() => {
                setTipoPgtoLocal("padrao");
                // Limpa etapas isoladas ao trocar pra Pagamento padrão
                // (pagamento padrão = orça tudo; isolamento é exclusivo do modo "Por etapas")
                setEtapasIsoladasLocal(new Set());
              }}
              style={{ flex:1, padding:"8px 10px", fontSize:12, fontWeight:isPadrao?600:400,
                border: isPadrao ? `1px solid ${C}` : `0.5px solid ${LN}`,
                background:"transparent", borderRadius:6, cursor:"pointer", color:C, fontFamily:"inherit" }}>
              Pagamento padrão
            </button>
            <button
              onClick={() => setTipoPgtoLocal("etapas")}
              style={{ flex:1, padding:"8px 10px", fontSize:12, fontWeight:!isPadrao?600:400,
                border: !isPadrao ? `1px solid ${C}` : `0.5px solid ${LN}`,
                background:"transparent", borderRadius:6, cursor:"pointer", color:C, fontFamily:"inherit" }}>
              Por etapas
            </button>
          </div>
        </div>

        <Sec title={isPadrao ? "Formas de pagamento" : "Contratação por etapa"}>
          {isPadrao ? (<>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:8 }}>
                <TextoEditavel
                  valor={labelApenasEdit || (incluiArq && incluiEng ? "Apenas Arquitetura" : incluiEng ? "Apenas Engenharia" : "Apenas Arquitetura")}
                  onChange={setLabelApenasEdit}
                  style={{ fontSize:12, fontWeight:600 }} />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Antecipado — desconto</span>
                  <NumInput valor={descArqLocal} onCommit={n => setDescArqLocal(n)} decimais={2} min={0} max={100} width={42} />
                  <span style={{ fontSize:11, color:LT }}>%</span>
                </div>
                <span style={{ color:LN }}>·</span>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Parcelado</span>
                  <NumInput valor={parcArqLocal} onCommit={n => setParcArqLocal(Math.max(1, n))} decimais={0} min={1} max={99} width={42} />
                  <span style={{ fontSize:11, color:LT }}>×</span>
                </div>
              </div>
              <OpcoesPagamento tipo="pacote" valor={arqCIEdit} desc={descArqLocal} parcelas={parcArqLocal} fmtV={fmtV} />
            </div>
            {incluiArq && incluiEng && (
            <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:12, marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:8 }}>Pacote Completo (Arq. + Eng.)</div>
              <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Antecipado — desconto</span>
                  <NumInput valor={descPacoteLocal} onCommit={n => setDescPacoteLocal(n)} decimais={2} min={0} max={100} width={42} />
                  <span style={{ fontSize:11, color:LT }}>%</span>
                </div>
                <span style={{ color:LN }}>·</span>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Parcelado</span>
                  <NumInput valor={parcPacoteLocal} onCommit={n => setParcPacoteLocal(Math.max(1, n))} decimais={0} min={1} max={99} width={42} />
                  <span style={{ fontSize:11, color:LT }}>×</span>
                </div>
              </div>
              <OpcoesPagamento tipo="pacote" valor={totCIEdit} desc={descPacoteLocal} parcelas={parcPacoteLocal} fmtV={fmtV} />
            </div>
            )}
          </>) : (<>
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"grid", gridTemplateColumns:"24px 1fr 60px 60px 110px 22px", gap:6, alignItems:"center", paddingBottom:6, borderBottom:`1.5px solid ${C}` }}>
                <span></span>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:10, fontWeight:600, color:C, textTransform:"uppercase", letterSpacing:"0.06em" }}>Etapa</span>
                  <label style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", fontSize:10, color:LT, textTransform:"none", letterSpacing:0, fontWeight:400 }}>
                    <span style={{
                      position:"relative", display:"inline-block", width:26, height:14,
                      background: mostrarTabelaEtapas ? "#0369a1" : "#d1d5db",
                      borderRadius:7, transition:"background 0.15s",
                    }}>
                      <span style={{
                        position:"absolute", top:2, left: mostrarTabelaEtapas ? 14 : 2,
                        width:10, height:10, background:"#fff", borderRadius:"50%",
                        transition:"left 0.15s", boxShadow:"0 1px 2px rgba(0,0,0,0.2)",
                      }} />
                    </span>
                    <input type="checkbox"
                      checked={mostrarTabelaEtapas}
                      onChange={e => setMostrarTabelaEtapas(e.target.checked)}
                      style={{ display:"none" }} />
                    <span>Mostrar no PDF</span>
                  </label>
                </div>
                <span></span>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                  <span style={{ fontSize:10, fontWeight:600, color:C, textTransform:"uppercase", letterSpacing:"0.06em" }}>%</span>
                  <span
                    title="Para alterar valores das etapas de arquitetura, edite o total de arquitetura no topo ou ajuste os percentuais"
                    style={{ fontSize:11, color:LT, cursor:"help", userSelect:"none", lineHeight:1 }}>ⓘ</span>
                </div>
                <span style={{ fontSize:10, fontWeight:600, color:C, textTransform:"uppercase", letterSpacing:"0.06em", textAlign:"right" }}>Valor</span>
                <span></span>
              </div>
              {etapasPct.filter(e => incluiEng || e.id !== 5).map((et, i) => {
                const isIsolada = idsIsolados.has(et.id);
                const isEng = et.id === 5;
                // visivel: sem isolamento, tudo visível. Com isolamento, só isoladas
                const visivel = !temIsoladas || isIsolada;
                const bgRow = isIsolada ? "#e0f2fe" : "transparent";
                const corRow = isIsolada ? "#0369a1" : C;
                const fontWt = isIsolada ? 600 : 400;
                // Valor da etapa: arq × pct/100 (com imp). Engenharia: integral (com imp)
                const valorEtapa = isEng
                  ? engCIEdit
                  : Math.round(arqCIEdit*(et.pct/100)*100)/100;
                return (
                <div key={et.id} style={{ display:"grid", gridTemplateColumns:"24px 1fr 60px 60px 110px 22px", gap:6, padding:"7px 4px", borderBottom:`0.5px solid ${LN}`, alignItems:"center", background: bgRow, opacity: visivel ? 1 : 0.35 }}>
                  <span
                    onClick={() => toggleIsolarEtapa(et.id)}
                    title={isIsolada ? "Desmarcar isolamento" : "Orçar apenas esta etapa"}
                    style={{ cursor:"pointer", textAlign:"center", fontSize:14, color: isIsolada ? "#0369a1" : LT, fontWeight:500, userSelect:"none" }}>
                    {isIsolada ? "◉" : "◎"}
                  </span>
                  <span style={{ color:corRow, fontWeight:fontWt }}>
                    {isEng ? (<>
                      <div>Projetos de Engenharia</div>
                      <div style={{ fontSize:11, color:LT, fontWeight:400 }}>Estrutural · Elétrico · Hidrossanitário</div>
                    </>) : (
                      <TextoEditavel valor={et.nome} onChange={v => atualizarEtapaNome(et.id, v)} style={{ fontSize:13, color:corRow, fontWeight:fontWt }} />
                    )}
                  </span>
                  <span></span>
                  {!isEng ? (
                    <NumInput valor={et.pct} onCommit={n => atualizarEtapaPct(et.id, n)}
                      decimais={0} min={0} max={100} width={50} />
                  ) : (
                    <span style={{ color:LT, textAlign:"center" }}>—</span>
                  )}
                  {!isEng ? (
                    <span style={{ fontSize:12, color:corRow, fontWeight:isIsolada?600:500, textAlign:"right", padding:"3px 6px" }}>
                      {fmtN(valorEtapa)}
                    </span>
                  ) : (
                    <EtapaValorInput
                      valorAtual={valorEtapa}
                      fmtN={fmtN}
                      onCommit={novo => {
                        // Converte valor com imposto de volta para sem imposto antes de setar engEdit
                        const semImp = semImposto(novo);
                        setEngEdit(semImp);
                      }}
                      borderColor={LN}
                      color={corRow}
                    />
                  )}
                  {!isEng ? (
                    <span onClick={() => removerEtapa(et.id)} title="Remover etapa"
                      style={{ cursor:"pointer", textAlign:"center", color:"#d1d5db", userSelect:"none", fontSize:14 }}>×</span>
                  ) : <span></span>}
                </div>
                );
              })}
              <div style={{ padding:"8px 0" }}>
                <button
                  onClick={adicionarEtapa}
                  style={{ width:"100%", fontSize:11, color:LT, background:"transparent",
                    border:`1px dashed ${LN}`, borderRadius:6, padding:"6px", cursor:"pointer", fontFamily:"inherit" }}>
                  + Adicionar etapa
                </button>
              </div>
              {(() => {
                // Total = apenas linhas ativas
                // - Etapas arq: ativas se (sem isolamento) OU (isolada)
                // - Engenharia: ativa se incluiEng && ((sem isolamento) OU (eng isolada))
                const etapasAtivas = etapasPct.filter(e => {
                  if (e.id === 5) return false; // eng vai separado
                  if (!temIsoladas) return true;
                  return idsIsolados.has(e.id);
                });
                const pctAtivo = etapasAtivas.reduce((s,e)=>s+Number(e.pct),0);
                const engAtiva = incluiEng && (!temIsoladas || idsIsolados.has(5));
                const valorAtivo = Math.round((arqCIEdit * pctAtivo / 100 + (engAtiva ? engCIEdit : 0)) * 100) / 100;
                return (
                  <div style={{ display:"grid", gridTemplateColumns:"24px 1fr 60px 60px 110px 22px", gap:6, padding:"8px 4px", borderTop:`1.5px solid ${C}`, marginTop:2, alignItems:"center" }}>
                    <span></span>
                    <span style={{ fontWeight:600, color:C }}>Total</span>
                    <span></span>
                    <span style={{ fontWeight:600, color:C, textAlign:"center" }}>{pctAtivo}%</span>
                    <span style={{ fontSize:15, fontWeight:700, color:C, textAlign:"right" }}>{fmtV(valorAtivo)}</span>
                    <span></span>
                  </div>
                );
              })()}
            </div>
            {mostrarTabelaEtapas ? (
            <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:10, marginBottom:10 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:8 }}>Etapa a Etapa</div>
              <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Antecipado por etapa — desconto</span>
                  <NumInput valor={descEtCtrtLocal} onCommit={n => setDescEtCtrtLocal(n)} decimais={2} min={0} max={100} width={42} />
                  <span style={{ fontSize:11, color:LT }}>%</span>
                </div>
                <span style={{ color:LN }}>·</span>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Parcelado por etapa</span>
                  <NumInput valor={parcEtCtrtLocal} onCommit={n => setParcEtCtrtLocal(Math.max(1, n))} decimais={0} min={1} max={99} width={42} />
                  <span style={{ fontSize:11, color:LT }}>×</span>
                </div>
              </div>
              <OpcoesPagamento tipo="etapaAEtapa" desc={descEtCtrtLocal} parcelas={parcEtCtrtLocal} fmtV={fmtV} />
            </div>
            ) : (
            /* Toggle "Mostrar no PDF" DESLIGADO: espelha pagamento padrão —
               "Apenas Arquitetura" (valor arq selecionada) + "Pacote Completo" se eng ativa */
            <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:10, marginBottom:10 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:8 }}>
                Apenas Arquitetura
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Antecipado — desconto</span>
                  <NumInput valor={descArqLocal} onCommit={n => setDescArqLocal(n)} decimais={2} min={0} max={100} width={42} />
                  <span style={{ fontSize:11, color:LT }}>%</span>
                </div>
                <span style={{ color:LN }}>·</span>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Parcelado</span>
                  <NumInput valor={parcArqLocal} onCommit={n => setParcArqLocal(Math.max(1, n))} decimais={0} min={1} max={99} width={42} />
                  <span style={{ fontSize:11, color:LT }}>×</span>
                </div>
              </div>
              <OpcoesPagamento tipo="pacote" valor={subTotalArqEtapas} desc={descArqLocal} parcelas={parcArqLocal} fmtV={fmtV} />
            </div>
            )}
            {/* Pacote Completo — sempre aparece quando tem mais de 1 etapa selecionada
                 OU quando eng + arq estão selecionadas (oferece contratação total)
                 Não aparece se só 1 etapa sem eng (pacote = etapa única, não faz sentido) */}
            {(() => {
              const etArqAtivas = etapasPct.filter(e => e.id !== 5 && (!temIsoladas || idsIsolados.has(e.id)));
              const multiEtapas = etArqAtivas.length > 1;
              const temArqEEng = incluiArq && engAtiva && etArqAtivas.length > 0;
              // Pacote Completo só aparece em 2 cenários:
              // 1) Toggle LIGADO + (várias etapas OU arq+eng) — permite contratação total vs etapa a etapa
              // 2) Toggle DESLIGADO + arq+eng ambos ativos — oferece "Apenas Arq" + "Pacote Completo"
              // Quando toggle desligado E sem eng, fica só o bloco único "Apenas Arq" (sem pacote)
              const mostraPacote = mostrarTabelaEtapas
                ? (multiEtapas || temArqEEng)
                : temArqEEng; // toggle off: só mostra pacote se tem arq+eng
              if (!mostraPacote) return null;
              // Label dinâmico
              const labelPacote = (incluiArq && engAtiva)
                ? "Pacote Completo (Arq. + Eng.)"
                : "Pacote Completo";
              return (
                <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:10, marginBottom:10 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:8 }}>{labelPacote}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:6 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:12, color:MD }}>Antecipado — desconto</span>
                      <NumInput valor={descPacCtrtLocal} onCommit={n => setDescPacCtrtLocal(n)} decimais={2} min={0} max={100} width={42} />
                      <span style={{ fontSize:11, color:LT }}>%</span>
                    </div>
                    <span style={{ color:LN }}>·</span>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:12, color:MD }}>Parcelado</span>
                      <NumInput valor={parcPacCtrtLocal} onCommit={n => setParcPacCtrtLocal(Math.max(1, n))} decimais={0} min={1} max={99} width={42} />
                      <span style={{ fontSize:11, color:LT }}>×</span>
                    </div>
                  </div>
                  <OpcoesPagamento tipo="pacote" valor={totalPacoteEtapas} desc={descPacCtrtLocal} parcelas={parcPacCtrtLocal} fmtV={fmtV} />
                </div>
              );
            })()}
          </>)}
          <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:10, fontSize:11, color:LT }}>
            <TextoEditavel valor={pixEdit} onChange={setPixEdit} style={{ fontSize:11, color:LT }} />
          </div>
        </Sec>

        <Sec title="Escopo dos serviços" action={
          <span
            onClick={() => {
              const newId = Date.now();
              setEscopoState(prev => {
                const semEng = prev.filter(b => !b.isEng);
                const eng = prev.filter(b => b.isEng);
                return [...semEng, { etapaId:newId, titulo:"", objetivo:"", itens:[], entregaveis:[], obs:"", isEng:false, custom:true }, ...eng];
              });
            }}
            style={{ fontSize:10, color:LT, cursor:"pointer", padding:"2px 8px", borderRadius:4,
              border:`1px solid ${LN}`, background:"#f3f4f6", whiteSpace:"nowrap", userSelect:"none" }}>+ bloco</span>
        }>
          {escopoDefault.map((bloco, i) => {
            // Separa número (fixo) do texto (editável)
            const numMatch = bloco.tituloNum.match(/^(\d+\.\s*)(.*)$/);
            const numPrefix = numMatch ? numMatch[1] : "";
            const tituloTexto = numMatch ? numMatch[2] : bloco.tituloNum;
            return (
            <div key={bloco.etapaId} style={{ marginBottom:18 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6, gap:8 }}>
                <div style={{ display:"flex", alignItems:"baseline", gap:4, flex:1, minWidth:0 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:C, whiteSpace:"nowrap" }}>{numPrefix}</span>
                  <InputControlado
                    valor={tituloTexto}
                    onCommit={v => setEscopoBloco(bloco.etapaId, "titulo", v)}
                    placeholder="Inserir novo escopo"
                    style={{ flex:1, minWidth:0 }}
                  />
                </div>
                <span
                  onClick={() => setEscopoState(prev => prev.filter(b => b.etapaId !== bloco.etapaId))}
                  title="Remover bloco"
                  style={{ fontSize:11, color:"#d1d5db", cursor:"pointer", padding:"2px 6px", borderRadius:4,
                    border:"1px solid #e5e7eb", background:"#fafafa", lineHeight:1.4,
                    userSelect:"none" }}>✕ remover</span>
              </div>
              {bloco.custom ? (
                // Bloco customizado — totalmente editável
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <div>
                    <div style={tag}>Objetivo</div>
                    <TextareaControlado
                      valor={bloco.objetivo}
                      onCommit={v => setEscopoBloco(bloco.etapaId, "objetivo", v)}
                      placeholder="Descreva o objetivo desta etapa..."
                      minHeight={60}
                    />
                  </div>
                  <div>
                    <div style={tag}>Descrição / Serviços inclusos</div>
                    <TextareaControlado
                      valor={(bloco.itens||[]).join("\n")}
                      onCommit={v => setEscopoBloco(bloco.etapaId, "itens", v.split("\n").filter(s=>s.trim()))}
                      placeholder="Um item por linha..."
                      minHeight={80}
                    />
                    <div style={{ fontSize:11, color:LT, marginTop:3 }}>Um item por linha</div>
                  </div>
                  <div>
                    <div style={tag}>Entregáveis</div>
                    <TextareaControlado
                      valor={(bloco.entregaveis||[]).join("\n")}
                      onCommit={v => setEscopoBloco(bloco.etapaId, "entregaveis", v.split("\n").filter(s=>s.trim()))}
                      placeholder="Um entregável por linha..."
                      minHeight={60}
                    />
                    <div style={{ fontSize:11, color:LT, marginTop:3 }}>Um entregável por linha</div>
                  </div>
                  <div>
                    <div style={tag}>Observação</div>
                    <TextareaControlado
                      valor={bloco.obs}
                      onCommit={v => setEscopoBloco(bloco.etapaId, "obs", v)}
                      placeholder="Observação opcional..."
                      minHeight={40}
                    />
                  </div>
                </div>
              ) : (
                // Bloco fixo — editável inline
                <>
                  {bloco.objetivo !== undefined && <>
                    <div style={tag}>Objetivo</div>
                    <TextoEditavel valor={bloco.objetivo} onChange={v => setEscopoBloco(bloco.etapaId, "objetivo", v)}
                      style={{ fontSize:13, color:MD, lineHeight:1.7, display:"block" }} multiline={true} />
                  </>}
                  {bloco.itens !== undefined && <>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:2 }}>
                      <div style={tag}>Serviços inclusos</div>
                      <span onClick={() => setEscopoBloco(bloco.etapaId, "itens", [...(bloco.itens||[]), "Novo item"])}
                        title="Adicionar item"
                        style={{ fontSize:10, color:LT, cursor:"pointer", padding:"0 4px", borderRadius:3,
                          background:"#f3f4f6", border:"1px solid #c8cdd6", lineHeight:"16px" }}>+ item</span>
                    </div>
                    {(bloco.itens||[]).map((it,j) => (
                      <div key={j} style={{ ...bl, alignItems:"flex-start" }}>
                        <span style={dot}>•</span>
                        <TextoEditavel valor={it} onChange={v => {
                          const arr = [...bloco.itens]; arr[j] = v;
                          setEscopoBloco(bloco.etapaId, "itens", arr);
                        }} style={{ fontSize:13, color:MD, lineHeight:1.6, flex:1 }} />
                        <span onClick={() => setEscopoBloco(bloco.etapaId, "itens", bloco.itens.filter((_,k)=>k!==j))}
                          style={{ fontSize:10, color:"#d1d5db", cursor:"pointer", marginLeft:4, flexShrink:0, paddingTop:2 }}>✕</span>
                      </div>
                    ))}
                  </>}
                  {bloco.entregaveis !== undefined && <>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:2, marginTop:6 }}>
                      <div style={tag}>Entregáveis</div>
                      <span onClick={() => setEscopoBloco(bloco.etapaId, "entregaveis", [...(bloco.entregaveis||[]), "Novo entregável"])}
                        title="Adicionar entregável"
                        style={{ fontSize:10, color:LT, cursor:"pointer", padding:"0 4px", borderRadius:3,
                          background:"#f3f4f6", border:"1px solid #c8cdd6", lineHeight:"16px" }}>+ item</span>
                    </div>
                    {(bloco.entregaveis||[]).map((it,j) => (
                      <div key={j} style={{ ...bl, alignItems:"flex-start" }}>
                        <span style={dot}>•</span>
                        <TextoEditavel valor={it} onChange={v => {
                          const arr = [...bloco.entregaveis]; arr[j] = v;
                          setEscopoBloco(bloco.etapaId, "entregaveis", arr);
                        }} style={{ fontSize:13, color:MD, lineHeight:1.6, flex:1 }} />
                        <span onClick={() => setEscopoBloco(bloco.etapaId, "entregaveis", bloco.entregaveis.filter((_,k)=>k!==j))}
                          style={{ fontSize:10, color:"#d1d5db", cursor:"pointer", marginLeft:4, flexShrink:0, paddingTop:2 }}>✕</span>
                      </div>
                    ))}
                  </>}
                  {bloco.obs !== undefined && <div style={{ fontSize:12, color:LT, marginTop:8, lineHeight:1.6, fontStyle:"italic" }}>
                    <TextoEditavel valor={bloco.obs} onChange={v => setEscopoBloco(bloco.etapaId, "obs", v)}
                      style={{ fontSize:12, color:LT, fontStyle:"italic" }} multiline={true} />
                  </div>}
                </>
              )}
              {i < escopoDefault.length-1 && <div style={{ borderBottom:`0.5px solid ${LN}`, marginTop:14 }} />}
            </div>
            );
          })}

        </Sec>

        <Sec title="Serviços não inclusos">
          <div style={{ columns:"2", columnGap:32, marginBottom:8 }}>
            {(naoInclEdit || naoInclDefault).map((item, i) => (
              <div key={i} style={{ ...bl, breakInside:"avoid", marginBottom:4, alignItems:"flex-start" }}>
                <span style={dot}>•</span>
                <TextoEditavel valor={item.label} onChange={v => {
                  const arr = [...(naoInclEdit || naoInclDefault)];
                  arr[i] = { ...arr[i], label: v };
                  setNaoInclEdit(arr);
                }} style={{ fontSize:13, color:MD, flex:1 }} />
                {item.sub && <span style={{ fontSize:11, color:LT, marginLeft:4 }}>{item.sub}</span>}
                <span onClick={() => setNaoInclEdit((naoInclEdit || naoInclDefault).filter((_,k)=>k!==i))}
                  style={{ fontSize:10, color:"#d1d5db", cursor:"pointer", marginLeft:4, flexShrink:0, paddingTop:2 }}>✕</span>
              </div>
            ))}
          </div>
          <div style={{ marginBottom:8 }}>
            <span onClick={() => setNaoInclEdit([...(naoInclEdit||naoInclDefault), { label:"Novo item", sub:null }])}
              style={{ fontSize:11, color:LT, cursor:"pointer", padding:"2px 8px", borderRadius:4,
                background:"#f3f4f6", border:"1px solid #c8cdd6" }}>+ item</span>
          </div>
          <div style={{ fontSize:12, color:LT, fontStyle:"italic" }}>Todos os serviços não inclusos podem ser contratados como serviços adicionais.</div>
        </Sec>

        <Sec title="Prazo de execução">
          {(prazoEdit || prazoDefault).filter(p => {
              if (p.toLowerCase().includes("engenharia")) {
                if (!engAtiva) return false; // toggle desligado OU eng não isolada
              }
              return true;
            }).map((p, i) => (
            <div key={i} style={{ ...bl, marginBottom:6 }}>
              <span style={dot}>•</span>
              <TextoEditavel valor={p} onChange={v => {
                const arr = [...(prazoEdit || prazoDefault)];
                arr[i] = v;
                setPrazoEdit(arr);
              }} style={{ fontSize:13, color:MD, lineHeight:1.6 }} multiline={true} />
            </div>
          ))}
        </Sec>

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
              <div style={{ fontSize:14, fontWeight:600, color:C, marginBottom:4 }}><TextoEditavel valor={responsavelEdit} onChange={setResponsavelEdit} style={{ fontSize:14, fontWeight:600 }} /></div>
              <div style={{ fontSize:12, color:LT, marginBottom:20 }}><TextoEditavel valor={cauEdit} onChange={setCauEdit} style={{ fontSize:12 }} /></div>
              <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:6, display:"flex", justifyContent:"space-between", fontSize:11, color:LT }}>
                <span>Assinatura</span><span>{dataStr}</span>
              </div>
            </div>
          </div>
        </Sec>

        <div style={{ borderTop:`0.5px solid ${LN}`, marginTop:48, paddingTop:14, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:11, color:LT }}>
            <span>Padovan Arquitetos</span><span>·</span>
            <TextoEditavel valor={emailEdit} onChange={setEmailEdit} style={{ fontSize:11 }} /><span>·</span>
            <TextoEditavel valor={telefoneEdit} onChange={setTelefoneEdit} style={{ fontSize:11 }} /><span>·</span>
            <TextoEditavel valor={instagramEdit} onChange={setInstagramEdit} style={{ fontSize:11 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FormOrcamentoProjetoTeste({ onSalvar, orcBase, clienteNome, clienteWA, onVoltar, modoVer }) {
  const [referencia,   setReferencia]   = useState(orcBase?.referencia  || "");
  const [tipoObra,     setTipoObra]     = useState(orcBase?.subtipo     || null);
  const [tipoProjeto,  setTipoProjeto]  = useState(orcBase?.tipo        || null);
  const [padrao,       setPadrao]       = useState(orcBase?.padrao      || null);
  const [tipologia,    setTipologia]    = useState(orcBase?.tipologia   || null);
  const [tamanho,      setTamanho]      = useState(orcBase?.tamanho     || null);
  const [aberto,       setAberto]       = useState(null);
  const [hoverDrop,    setHoverDrop]    = useState(null);
  const [panelPos,     setPanelPos]     = useState({ top:0, left:0 });
  const [propostaData,  setPropostaData]  = useState(modoVer && orcBase ? {
    tipoProjeto: orcBase.tipo, tipoObra: orcBase.subtipo, padrao: orcBase.padrao,
    tipologia: orcBase.tipologia, tamanho: orcBase.tamanho,
    clienteNome, referencia: orcBase.referencia || "",
    comodos: orcBase.comodos || [],
    calculo: orcBase.resultado || {},
    tipoPgto: orcBase.tipoPgto || "padrao",
    temImposto: orcBase.temImposto || false,
    aliqImp: orcBase.aliqImp || 16,
    descArq: orcBase.descArq || 5, parcArq: orcBase.parcArq || 3,
    descPacote: orcBase.descPacote || 10, parcPacote: orcBase.parcPacote || 4,
    descEtCtrt: orcBase.descEtCtrt || 5, parcEtCtrt: orcBase.parcEtCtrt || 2,
    descPacCtrt: orcBase.descPacCtrt || 15, parcPacCtrt: orcBase.parcPacCtrt || 8,
    etapasPct: orcBase.etapasPct || [],
    totSI: orcBase.totSI || 0, totCI: orcBase.totCI || 0, impostoV: orcBase.impostoV || 0,
    incluiArq: orcBase.incluiArq !== false,
    incluiEng: orcBase.incluiEng !== false,
    incluiMarcenaria: orcBase.incluiMarcenaria || false,
    grupoQtds: orcBase.grupoQtds || null,
    resumoDescritivo: orcBase.resumoDescritivo || "",
  } : null);
  const [tipoPgto,      setTipoPgto]      = useState(orcBase?.tipoPgto    || "padrao");
  const [temImposto,    setTemImposto]    = useState(orcBase?.temImposto  || false);
  const [aliqImp,       setAliqImp]       = useState(orcBase?.aliqImp     || 16);
  const [descArq,       setDescArq]       = useState(orcBase?.descArq     || 5);
  const [parcArq,       setParcArq]       = useState(orcBase?.parcArq     || 3);
  const [descPacote,    setDescPacote]    = useState(orcBase?.descPacote  || 10);
  const [parcPacote,    setParcPacote]    = useState(orcBase?.parcPacote  || 4);
  const [descEtCtrt,    setDescEtCtrt]    = useState(orcBase?.descEtCtrt  || 5);
  const [parcEtCtrt,    setParcEtCtrt]    = useState(orcBase?.parcEtCtrt  || 2);
  const [descPacCtrt,   setDescPacCtrt]   = useState(orcBase?.descPacCtrt || 15);
  const [parcPacCtrt,   setParcPacCtrt]   = useState(orcBase?.parcPacCtrt || 8);
  const [etapasPct, setEtapasPct] = useState(orcBase?.etapasPct || [
    { id:1, nome:"Estudo de Viabilidade",  pct:10 },
    { id:2, nome:"Estudo Preliminar",      pct:40 },
    { id:3, nome:"Aprovação na Prefeitura",pct:12 },
    { id:4, nome:"Projeto Executivo",      pct:38 },
  ]);
  const [qtdRep, setQtdRep] = useState(orcBase?.repeticao ? (orcBase?.nUnidades || 2) : 0);
  const [editandoRep, setEditandoRep] = useState(false);
  const [editandoGrupoQtd, setEditandoGrupoQtd] = useState(null); // guarda o nome do grupo que está com input aberto
  const [etapasIsoladas, setEtapasIsoladas] = useState(new Set(orcBase?.etapasIsoladas || []));
  const [incluiArq,        setIncluiArq]        = useState(orcBase?.incluiArq        !== false);
  const [incluiEng,        setIncluiEng]        = useState(orcBase?.incluiEng        !== false);
  const [incluiMarcenaria, setIncluiMarcenaria] = useState(orcBase?.incluiMarcenaria || false);

  useEffect(() => {
    if (!orcBase) return;
    // Ativa flag para evitar que useEffect de grupoParams sobrescreva durante sincronização
    sincronizandoOrcBase.current = true;
    if (orcBase.referencia  !== undefined) setReferencia(orcBase.referencia || "");
    if (orcBase.subtipo     !== undefined) setTipoObra(orcBase.subtipo);
    if (orcBase.tipo        !== undefined) setTipoProjeto(orcBase.tipo);
    if (orcBase.padrao      !== undefined) setPadrao(orcBase.padrao);
    if (orcBase.tipologia   !== undefined) setTipologia(orcBase.tipologia);
    if (orcBase.tamanho     !== undefined) setTamanho(orcBase.tamanho);
    if (orcBase.comodos)     setQtds(Object.fromEntries(orcBase.comodos.map(c => [c.nome, c.qtd])));
    if (orcBase.repeticao   !== undefined) setQtdRep(orcBase.repeticao ? (orcBase.nUnidades || 2) : 0);
    if (orcBase.tipoPgto    !== undefined) setTipoPgto(orcBase.tipoPgto);
    if (orcBase.temImposto  !== undefined) setTemImposto(orcBase.temImposto);
    if (orcBase.aliqImp     !== undefined) setAliqImp(orcBase.aliqImp);
    if (orcBase.etapasPct   !== undefined) setEtapasPct((orcBase.etapasPct || []).filter(e => e.id !== 5));
    if (orcBase.descArq     !== undefined) setDescArq(orcBase.descArq);
    if (orcBase.parcArq     !== undefined) setParcArq(orcBase.parcArq);
    if (orcBase.descPacote  !== undefined) setDescPacote(orcBase.descPacote);
    if (orcBase.parcPacote  !== undefined) setParcPacote(orcBase.parcPacote);
    if (orcBase.descEtCtrt  !== undefined) setDescEtCtrt(orcBase.descEtCtrt);
    if (orcBase.parcEtCtrt  !== undefined) setParcEtCtrt(orcBase.parcEtCtrt);
    if (orcBase.descPacCtrt !== undefined) setDescPacCtrt(orcBase.descPacCtrt);
    if (orcBase.parcPacCtrt !== undefined) setParcPacCtrt(orcBase.parcPacCtrt);
    if (orcBase.grupoQtds   !== undefined) setGrupoQtds(orcBase.grupoQtds || { "Por Loja":0, "Espaço Âncora":0, "Áreas Comuns":0, "Por Apartamento":0, "Galpao":0 });
    if (orcBase.etapasIsoladas !== undefined) setEtapasIsoladas(new Set(orcBase.etapasIsoladas || []));
    if (orcBase.grupoParams  !== undefined && orcBase.grupoParams) setGrupoParams(orcBase.grupoParams);
    // Desativa flag no próximo tick, após todos os estados terem sido setados
    setTimeout(() => { sincronizandoOrcBase.current = false; }, 0);
  }, [orcBase?.id]);

  const GRUPOS_COMERCIAIS = ["Por Loja","Espaço Âncora","Áreas Comuns","Por Apartamento","Galpao"];
  const [grupoParams, setGrupoParams] = useState(() => {
    const init = {};
    const p  = orcBase?.padrao    || "Médio";
    const ti = orcBase?.tipologia || "Térreo";
    const ta = orcBase?.tamanho   || "Médio";
    GRUPOS_COMERCIAIS.forEach(g => { init[g] = { padrao:p, tipologia:ti, tamanho:ta }; });
    return init;
  });
  const [abertoGrupo, setAbertoGrupo] = useState(null);

  // Ref para evitar que a sincronização do orcBase dispare o useEffect de grupoParams
  const sincronizandoOrcBase = useRef(false);
  // Ref para controlar timeout de fechamento do dropdown por hover
  const hoverCloseRef = useRef(null);

  useEffect(() => {
    if (!padrao && !tipologia && !tamanho) return;
    if (sincronizandoOrcBase.current) return; // não sobrescreve durante carregamento do orcBase
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
  const isComercial = tipoProjeto === "Conj. Comercial" || tipoProjeto === "Galpão";
  const [grupoQtds, setGrupoQtds] = useState(orcBase?.grupoQtds || {
    "Por Loja": 0, "Espaço Âncora": 0, "Áreas Comuns": 0, "Por Apartamento": 0, "Galpao": 0,
  });

  function setGrupoQtd(grupo, delta) {
    setGrupoQtds(prev => ({ ...prev, [grupo]: Math.max(0, (prev[grupo] || 0) + delta) }));
  }

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

  const [qtds, setQtds] = useState(() => {
    if (!orcBase?.comodos) return {};
    return Object.fromEntries(orcBase.comodos.map(c => [c.nome, c.qtd]));
  });

  const isEdicao = useRef(!!orcBase?.comodos?.length);
  useEffect(() => {
    if (isEdicao.current) { isEdicao.current = false; return; }
    setQtds({});
  }, [tipoProjeto]);

  // ── Salvar como rascunho ao voltar ─────────────────────────
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  function temDadosPreenchidos() {
    // Qualquer coisa além do estado inicial conta como "iniciado"
    if (referencia?.trim()) return true;
    if (tipoObra || tipoProjeto || padrao || tipologia || tamanho) return true;
    if (Object.values(qtds).some(q => q > 0)) return true;
    return false;
  }
  function handleVoltar() {
    // Em modo "ver", nunca pergunta — só volta
    if (modoVer) { onVoltar(); return; }
    // Se já existe orcBase (edição), deixa voltar direto sem perguntar
    if (orcBase?.id) { onVoltar(); return; }
    // Novo orçamento: pergunta se tem algo preenchido
    if (temDadosPreenchidos()) {
      setShowSaveDialog(true);
    } else {
      onVoltar();
    }
  }
  async function salvarRascunhoEVoltar() {
    const orcRascunho = {
      ...(orcBase || {}),
      referencia,
      tipo: tipoProjeto, subtipo: tipoObra,
      padrao, tipologia, tamanho,
      comodos: Object.entries(qtds).filter(([,q]) => q > 0).map(([nome, qtd]) => ({ nome, qtd })),
      incluiArq, incluiEng,
      tipoPgto, temImposto, aliqImp,
      descArq, parcArq, descPacote, parcPacote,
      descEtCtrt, parcEtCtrt, descPacCtrt, parcPacCtrt,
      etapasPct,
      rascunho: true,
      status: "rascunho",
    };
    setShowSaveDialog(false);
    if (onSalvar) {
      try { await onSalvar(orcRascunho); } catch(e) { console.error("Erro ao salvar rascunho:", e); }
    }
    onVoltar();
  }

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

  // Reposiciona o painel dropdown ao fazer scroll/resize (para grudar no botão)
  useEffect(() => {
    if (!aberto) return;
    const reposicionar = () => {
      const btn = document.querySelector(`[data-drop-btn="${aberto}"]`);
      if (btn) {
        const r = btn.getBoundingClientRect();
        setPanelPos({ top: r.bottom + 6, left: r.left });
      }
    };
    // capture: true captura scroll de qualquer elemento descendente
    // (inclui containers internos com overflow:auto)
    document.addEventListener("scroll", reposicionar, true);
    window.addEventListener("resize", reposicionar);
    return () => {
      document.removeEventListener("scroll", reposicionar, true);
      window.removeEventListener("resize", reposicionar);
    };
  }, [aberto]);

  const OPCOES = {
    tipoObra:    ["Construção nova", "Reforma"],
    tipoProjeto: ["Residencial", "Clínica", "Conj. Comercial", "Galpão", "Empreendimento"],
    padrao:      ["Alto", "Médio", "Baixo"],
    tipologia:   ["Térreo", "Sobrado"],
    tamanho:     ["Grande", "Médio", "Pequeno", "Compacta"],
  };

  // Mapa de display: valor interno → label exibido APENAS após seleção (no fluxo horizontal).
  // Na lista de opções do dropdown, o valor interno é mantido ("Alto", "Médio", "Baixo").
  // Preserva compatibilidade com orçamentos salvos no DB que usam valores internos.
  const DISPLAY_OPCAO = {
    padrao: { "Alto":"Alto Padrão", "Médio":"Médio Padrão", "Baixo":"Baixo Padrão" },
  };
  const displayOpcao = (key, val) => (DISPLAY_OPCAO[key] && DISPLAY_OPCAO[key][val]) || val;

  const VALS   = { tipoObra, tipoProjeto, padrao, tipologia, tamanho };
  const LABELS = { tipoObra:"Tipo Obra", tipoProjeto:"Tipo Projeto", padrao:"Padrão", tipologia:"Tipologia", tamanho:"Tamanho" };
  const SETS   = { tipoObra:setTipoObra, tipoProjeto:setTipoProjeto, padrao:setPadrao, tipologia:setTipologia, tamanho:setTamanho };

  function selecionar(key, val) { SETS[key](val); setAberto(null); setHoverDrop(null); }

  const grupoDeComodo = useMemo(() => {
    const map = {};
    if (configAtual?.grupos) {
      Object.entries(configAtual.grupos).forEach(([grupo, nomes]) => {
        nomes.forEach(nome => { map[nome] = grupo; });
      });
    }
    return map;
  }, [configAtual]);

  const calculo = useMemo(() => {
    if (!configAtual) return null;
    if (!isComercial && (!tamanho || !padrao)) return null;
    const { comodos: COMODOS_USE } = configAtual;
    const tcfg = getTipoConfig(tipoParaConfig(tipoProjeto));
    const pb = tcfg.precoBase;

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
          const pct2 = acum<1000?0.25:acum<2000?0.20:0.15;
          total += precoUni*pct2;
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
        nGalpoes >0&&atGalpao1>0 ? {label:"Galpão",       n:nGalpoes, area1:atGalpao1, precoUni:p1Galpao, precoTot:pGalpoes} : null,
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

    const nRep   = qtdRep > 1 ? qtdRep : 1;
    const pctRep = 0.25;
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
      areaTotal, areaTot,
      precoArq1, precoArq,
      precoEng1, precoEng,
      precoM2Arq: areaTot > 0 ? Math.round(precoArq / areaTot * 100) / 100 : 0,
      precoM2Eng: areaTot > 0 ? Math.round(precoEng / areaTot * 100) / 100 : 0,
      nRep, pctRep, unidades,
      indiceComodos, indicePadrao, fatorMult,
      precoBaseVal, precoM2Ef,
      faixasArqDet, faixasEng: engCalc.faixas,
      totalAmbientes,
      acrescimoCirk: tcfg.acrescimoCirk,
      labelCirk: tcfg.labelCirk || String(Math.round(tcfg.acrescimoCirk*100)),
    };
  }, [qtds, tamanho, padrao, tipoProjeto, configAtual, qtdRep, grupoQtds, isComercial, grupoParams, grupoDeComodo]);

  const temComodos = isComercial
    ? Object.entries(grupoQtds).some(([g, gq]) => gq > 0 && Object.keys(qtds).some(nome => grupoDeComodo[nome] === g && (qtds[nome]||0) > 0))
    : Object.values(qtds).some(q => q > 0);

  useEffect(() => {
    if (document.getElementById("slide-up-style")) return;
    const s = document.createElement("style");
    s.id = "slide-up-style";
    s.textContent = `
      @keyframes slideUp { from { opacity:0; transform:translateY(32px); } to { opacity:1; transform:translateY(0); } }
      @keyframes surgeHoriz { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:translateX(0); } }
      input.no-spin::-webkit-outer-spin-button,
      input.no-spin::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      input.no-spin { -moz-appearance: textfield; }
      .comodo-escolhido:hover { color: #dc2626 !important; text-decoration: line-through; text-decoration-color: #dc2626; }
      .comodo-escolhido:hover .comodo-m2 { color: #dc2626 !important; }
      .comodo-escolhido:hover strong { color: #dc2626 !important; }
    `;
    document.head.appendChild(s);
  }, []);

  const C = {
    wrap:       { fontFamily:"inherit", color:"#111", background:"#fff", padding:"24px 28px", position:"relative", maxWidth:1200, margin:"0 auto" },
    fieldBox:   { background:"#f5f5f5", border:"1px solid #333", borderRadius:10, padding:"12px 16px", fontSize:14, color:"#6b7280" },
    fieldLabel: { fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1, marginBottom:6, display:"block" },
    input:      { width:"100%", border:"1px solid #333", borderRadius:10, padding:"12px 16px", fontSize:14, color:"#111", outline:"none", background:"#fff", boxSizing:"border-box", fontFamily:"inherit" },
    dropWrap:   { position:"relative", display:"flex", flexDirection:"column", alignItems:"center", gap:6 },
    dropLbl:    { fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1.2, textAlign:"center" },
    dropBtn:    (open, hasVal) => ({ display:"flex", alignItems:"center", gap:6, background: hasVal&&!open?"#fff":"#fff", border:`1px solid ${open?"#111": hasVal?"#c0c5cf":"#333"}`, borderRadius:10, padding:"9px 14px", fontSize:11, color: null, cursor:"pointer", fontFamily:"inherit", minWidth:110, userSelect:"none", WebkitUserSelect:"none" }),
    dropBtnTxt: (val) => ({ flex:1, textAlign:"center", color: val ? "#111" : "#828a98" }),
    chevron:    (open) => ({ transition:"transform 0.15s", transform: open ? "rotate(180deg)" : "none", display:"flex", alignItems:"center" }),
    dropPanel:  { position:"fixed", zIndex:9999, background:"#fff", border:"1px solid #333", borderRadius:10, boxShadow:"0 4px 16px rgba(0,0,0,0.12)", minWidth:160, overflow:"hidden" },
    dropItem:   (sel) => ({ padding:"10px 16px", fontSize:14, cursor:"pointer", color:"#374151", background: sel ? "#eceef2" : "#fff", fontWeight: sel ? 600 : 400 }),
    groupHdr:   { fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1.2, textAlign:"center", marginBottom:12 },
    sep:        { width:1, background:"#c8cdd6", alignSelf:"stretch", marginTop:22 },
    btnDefinir: { width:"100%", maxWidth:380, background:"#111", border:"1px solid #111", borderRadius:10, padding:"13px 0", fontSize:14, fontWeight:700, color:"#fff", cursor:"pointer", fontFamily:"inherit", textAlign:"center", display:"block", margin:"0 auto" },
    aviso:      { fontSize:12, color:"#ef4444", textAlign:"center", marginTop:8 },
    comodoGrupoHdr: { fontSize:10, color:"#555e6b", textTransform:"uppercase", letterSpacing:1, marginBottom:8, marginTop:20, background:"#f0f1f4", border:"1px solid #b8bec8", borderRadius:6, padding:"6px 10px", display:"inline-block" },
    comodoRow:  (ativo) => ({ display:"flex", alignItems:"center", gap:4, padding:"3px 0", borderBottom:"1px solid #c8cdd6", opacity: ativo ? 1 : 0.55 }),
    comodoNome: { flex:1, fontSize:14, color:"#374151" },
    comodoM2:   { fontSize:12, color:"#828a98", width:70, textAlign:"right", whiteSpace:"nowrap" },
    qtdWrap:    { display:"flex", alignItems:"center", gap:8 },
    qtdBtn:     { width:26, height:26, borderRadius:6, border:"1px solid #888", background:"#fff", color:"#374151", fontSize:16, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 },
    qtdNum:     (q) => ({ width:24, textAlign:"center", fontSize:14, fontWeight: q > 0 ? 700 : 400, color: q > 0 ? "#111" : "#828a98" }),
    qtdM2Tot:   { fontSize:12, color:"#6b7280", width:72, textAlign:"right", whiteSpace:"nowrap" },
    resumoBox:  { background:"#fff", border:"1px solid #333", borderRadius:12, padding:"20px 20px" },
    resumoHdr:  { fontSize:10, color:"#555e6b", textTransform:"uppercase", letterSpacing:1.2, textAlign:"center", marginBottom:16, paddingBottom:12, borderBottom:"1px solid #b8bec8" },
    resumoSec:  { fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, marginBottom:6, marginTop:14 },
    resumoVal:  { fontSize:18, fontWeight:700, color:"#111" },
    resumoM2:   { fontSize:12, color:"#828a98", marginTop:2 },
    resumoLinha:{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginTop:4 },
    resumoArea: { background:"#f0f1f4", border:"1px solid #c0c5cf", borderRadius:8, padding:"10px 14px", marginBottom:10, fontSize:13, color:"#374151" },
  };

  function renderStep(id) {
    const open = aberto === id;
    const val  = VALS[id];
    const lbl  = LABELS[id];
    const btnRef = { current: null };
    const hovered = hoverDrop === id;
    const ativo = open || hovered;
    return (
      <div style={{ position:"relative" }} key={id}>
        <button
          ref={el => { btnRef.current = el; }}
          data-drop-btn={id}
          onMouseEnter={(e) => {
            // Cancela qualquer fechamento pendente
            if (hoverCloseRef.current) { clearTimeout(hoverCloseRef.current); hoverCloseRef.current = null; }
            setHoverDrop(id);
            // Abre o dropdown automaticamente no hover
            if (!open) {
              const r = e.currentTarget.getBoundingClientRect();
              setPanelPos({ top: r.bottom + 6, left: r.left });
              setAberto(id);
            }
          }}
          onMouseLeave={() => {
            // Fecha com pequeno delay pra permitir mover o mouse pro painel
            if (hoverCloseRef.current) clearTimeout(hoverCloseRef.current);
            hoverCloseRef.current = setTimeout(() => {
              setHoverDrop(null);
              setAberto(null);
            }, 120);
          }}
          style={{
            ...C.dropBtn(open, !!val),
            background: ativo ? "#eceef2" : (val ? "#f4f5f7" : "#fff"),
          }}
          onClick={(e) => {
            // Tira o focus pra evitar highlight azul ao clicar
            e.currentTarget.blur();
            if (open) { setAberto(null); return; }
            const r = e.currentTarget.getBoundingClientRect();
            setPanelPos({ top: r.bottom + 6, left: r.left });
            setAberto(id);
          }}>
          <span style={C.dropBtnTxt(val)}>
            {val
              ? <><span style={{ color:"#828a98", fontWeight:400 }}>{lbl}: </span><span style={{ fontWeight:600, color:"#111" }}>{val}</span></>
              : <span style={{ color:"#828a98" }}>{lbl}</span>
            }
          </span>
          <span style={C.chevron(open)}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" stroke="#828a98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </button>
      </div>
    );
  }

  // Renderiza um valor já escolhido como texto editável — hover reabre dropdown
  function renderValor(id) {
    const open = aberto === id;
    const val  = VALS[id];
    if (!val) return null;
    const hovered = hoverDrop === id;
    const ativo = open || hovered;
    return (
      <div style={{ position:"relative" }} key={id+"-valor"}>
        <span
          data-drop-btn={id}
          onMouseEnter={(e) => {
            if (hoverCloseRef.current) { clearTimeout(hoverCloseRef.current); hoverCloseRef.current = null; }
            setHoverDrop(id);
            if (!open) {
              const r = e.currentTarget.getBoundingClientRect();
              setPanelPos({ top: r.bottom + 6, left: r.left });
              setAberto(id);
            }
          }}
          onMouseLeave={() => {
            if (hoverCloseRef.current) clearTimeout(hoverCloseRef.current);
            hoverCloseRef.current = setTimeout(() => {
              setHoverDrop(null);
              setAberto(null);
            }, 120);
          }}
          onClick={(e) => {
            if (open) { setAberto(null); return; }
            const r = e.currentTarget.getBoundingClientRect();
            setPanelPos({ top: r.bottom + 6, left: r.left });
            setAberto(id);
          }}
          style={{
            display:"inline-block",
            fontSize:14, color:"#111", fontWeight:500,
            cursor:"pointer", userSelect:"none", WebkitUserSelect:"none",
            padding:"4px 10px", borderRadius:6,
            background: ativo ? "#eceef2" : "transparent",
            borderBottom: ativo ? "1px solid #c8cdd6" : "1px solid transparent",
            transition: "background 0.2s ease, border-color 0.2s ease",
            animation: "surgeHoriz 0.35s ease both",
          }}>
          {displayOpcao(id, val)}
        </span>
      </div>
    );
  }

  const GRUPO_DISPLAY = {
    "Por Loja":        "Loja",
    "Espaço Âncora":   "Espaço Âncora",
    "Áreas Comuns":    "Área Comum",
    "Por Apartamento": "Apartamento",
    "Galpao":          "Galpão",
  };

  const [gruposAbertos, setGruposAbertos] = useState({});
  // Cômodo com popup visível (via hover OU via click no input)
  const [comodoAberto, setComodoAberto] = useState(null);
  // Quando true, o popup está "travado" pelo clique no input:
  // - mouseLeave não fecha
  // - hover em outros cômodos é ignorado
  const [travado, setTravado] = useState(false);
  const comodoCloseRef = useRef(null);
  // Rastreia última posição do mouse para reabrir popup após a lista reorganizar
  const mousePosRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const tracker = (e) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; };
    document.addEventListener("mousemove", tracker, { passive: true });
    return () => document.removeEventListener("mousemove", tracker);
  }, []);

  // Hover: passou em cima
  function abrirComodo(nome) {
    if (travado) return; // travado → ignora hover
    if (comodoCloseRef.current) { clearTimeout(comodoCloseRef.current); comodoCloseRef.current = null; }
    setComodoAberto(nome);
  }
  // Hover: saiu
  function agendarFecharComodo() {
    if (travado) return; // travado → não fecha
    if (comodoCloseRef.current) clearTimeout(comodoCloseRef.current);
    comodoCloseRef.current = setTimeout(() => setComodoAberto(null), 80);
  }

  // Após qtds mudar (cômodo selecionado → lista reorganiza), o browser não dispara
  // mouseenter/leave porque o cursor não se moveu. Detecta qual cômodo está sob o
  // cursor via elementFromPoint e abre ele. Usa requestAnimationFrame pra rodar
  // após o React commitar o DOM reorganizado.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (travado) return;
      const { x, y } = mousePosRef.current;
      if (x === 0 && y === 0) return;
      const el = document.elementFromPoint(x, y);
      if (!el) return;
      const wrap = el.closest && el.closest("[data-comodo-wrap]");
      const nome = wrap ? wrap.getAttribute("data-comodo-nome") : null;
      if (nome) {
        if (comodoCloseRef.current) { clearTimeout(comodoCloseRef.current); comodoCloseRef.current = null; }
        setComodoAberto(nome);
      } else {
        setComodoAberto(null);
      }
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qtds]);

  // Listener global: mousedown em qualquer lugar enquanto travado
  useEffect(() => {
    if (!travado) return;
    const handler = (e) => {
      // Clique dentro do próprio cômodo travado (input, números, ✕) → deixa o onClick deles decidir
      const wrap = e.target.closest && e.target.closest("[data-comodo-wrap]");
      const nomeClicado = wrap ? wrap.getAttribute("data-comodo-nome") : null;
      if (nomeClicado && nomeClicado === comodoAberto) return;

      // Clicou fora do cômodo travado → aplica valor digitado (se houver) e destrava
      const inputAtivo = document.activeElement;
      if (inputAtivo && inputAtivo.tagName === "INPUT" && comodoAberto) {
        const v = parseInt(inputAtivo.value) || 0;
        const qAtual = qtds[comodoAberto] || 0;
        if (v > 0 && v !== qAtual) setQtdAbs(comodoAberto, v);
      }

      setTravado(false);
      if (nomeClicado) {
        // Se caiu em outro cômodo, abre ele imediatamente
        setComodoAberto(nomeClicado);
      } else {
        setComodoAberto(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [travado, comodoAberto, qtds]);

  function toggleGrupo(grupo) {
    setGruposAbertos(prev => ({ ...prev, [grupo]: prev[grupo] === false ? true : false }));
  }
  function isGrupoAberto(grupo) { return gruposAbertos[grupo] !== false; }

  function setQtd(nome, delta) {
    setQtds(prev => ({ ...prev, [nome]: Math.max(0, (prev[nome] || 0) + delta) }));
  }

  // Define quantidade absoluta (não delta) — usado no hover com atalhos 1-6 e input livre
  function setQtdAbs(nome, val) {
    const v = Math.max(0, parseInt(val) || 0);
    setQtds(prev => {
      const next = { ...prev };
      if (v === 0) delete next[nome]; else next[nome] = v;
      return next;
    });
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

  const modalTotSI   = calculo ? Math.round(((incluiArq?calculo.precoArq:0) + (incluiEng?calculo.precoEng:0))*100)/100 : 0;
  const modalTotCI   = temImposto && modalTotSI > 0 ? Math.round(modalTotSI/(1-aliqImp/100)*100)/100 : modalTotSI;
  const modalImposto = temImposto ? Math.round((modalTotCI - modalTotSI)*100)/100 : 0;

  // Geração da proposta (antes estava no onClick do modal, agora extraída)
  function gerarProposta() {
    if (!calculo) return;
    const resumoDescritivo = (() => {
      const fmtN2 = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
      const fmtArea = v => v > 0 ? fmtN2(v)+"m²" : null;
      // Prefixo "Construção nova de" ou "Reforma de"
      const tipoObraLower = (tipoObra || "").toLowerCase();
      const prefixo = tipoObraLower.includes("reforma") ? "Reforma de " : "Construção nova de ";
      // Helper: minúscula na primeira letra (para encaixar após "de ")
      const toLowerFirst = s => s.length > 0 ? s.charAt(0).toLowerCase() + s.slice(1) : s;
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
        return `${prefixo}conjunto comercial, contendo ${lista}, totalizando ${fmtArea(c.areaTot||c.areaTotal)}.`;
      }
      const nUnid = calculo?.nRep || 1;
      const areaUni = calculo?.areaTotal || calculo?.areaTot || 0;
      const areaTotR = Math.round(areaUni * nUnid * 100)/100;
      const totalAmb = Object.entries(qtds).filter(([,q])=>q>0).reduce((s,[,q])=>s+q,0);
      // Usa formatComodo top-level (helpers PLURAIS_IRREG, GENERO_AMB, NUM_EXT_*)
      const itensFmt = Object.entries(qtds).filter(([,q])=>q>0).map(([nome,q]) => formatComodo(nome, q));
      const listaStr = itensFmt.length>1 ? itensFmt.slice(0,-1).join(", ")+" e "+itensFmt[itensFmt.length-1] : itensFmt[0]||"";
      const tipDesc = (tipologia||"").toLowerCase().includes("sobrado") ? "com dois pavimentos" : "térrea";
      if (nUnid>1) {
        const nExt = nUnid>=1&&nUnid<=10 ? NUM_EXT_FEM[nUnid] : String(nUnid);
        return `${prefixo}${nExt} residências ${tipDesc} idênticas, com ${fmtN2(areaUni)}m² por unidade, totalizando ${fmtN2(areaTotR)}m² de área construída. Cada unidade composta por ${totalAmb} ambientes: ${listaStr}.`;
      }
      return `${prefixo}uma residência ${tipDesc}, com ${fmtN2(areaUni)}m² de área construída, composta por ${totalAmb} ambientes: ${listaStr}.`;
    })();
    setPropostaData({
      tipoProjeto, tipoObra, padrao, tipologia, tamanho,
      clienteNome, referencia,
      comodos: Object.entries(qtds).filter(([,q])=>q>0).map(([nome,qtd])=>({nome,qtd})),
      resumoDescritivo,
      grupoQtds: isComercial ? grupoQtds : null,
      calculo,
      incluiArq, incluiEng, incluiMarcenaria,
      etapasIsoladas: Array.from(etapasIsoladas),
      tipoPgto, temImposto, aliqImp,
      descArq, parcArq, descPacote, parcPacote,
      descEtCtrt, parcEtCtrt, descPacCtrt, parcPacCtrt,
      etapasPct,
      totSI: modalTotSI, totCI: modalTotCI, impostoV: modalImposto,
    });
    const orcParaSalvar = {
      ...(orcBase || {}),
      tipo: tipoProjeto, subtipo: tipoObra, tipologia, tamanho, padrao,
      cliente: clienteNome, referencia,
      comodos: Object.entries(qtds).filter(([,q])=>q>0).map(([nome,qtd])=>({nome,qtd})),
      repeticao: qtdRep > 0, nUnidades: qtdRep > 0 ? qtdRep : 1,
      grupoQtds: isComercial ? grupoQtds : null,
      grupoParams: isComercial ? grupoParams : null,
      incluiArq, incluiEng, incluiMarcenaria,
      etapasIsoladas: Array.from(etapasIsoladas),
      resultado: { ...calculo, precoArq: calculo?.precoArq || 0, precoEng: calculo?.precoEng || 0, areaTotal: calculo?.areaTotal || 0 },
      tipoPgto, temImposto, aliqImp,
      descArq, parcArq, descPacote, parcPacote,
      descEtCtrt, parcEtCtrt, descPacCtrt, parcPacCtrt,
      etapasPct,
      totSI: modalTotSI, totCI: modalTotCI, impostoV: modalImposto,
    };
    if (onSalvar) onSalvar(orcParaSalvar);
  }

  if (propostaData) {
    const liveData = {
      ...propostaData,
      tipoPgto, temImposto, aliqImp,
      resumoDescritivo: propostaData.resumoDescritivo || "",
      descArq, parcArq, descPacote, parcPacote,
      descEtCtrt, parcEtCtrt, descPacCtrt, parcPacCtrt,
      etapasPct,
      totSI: modalTotSI, totCI: modalTotCI, impostoV: modalImposto,
    };
    return <PropostaPreview data={liveData} onVoltar={() => { setPropostaData(null); }} />;
  }

  return (
    <div style={C.wrap} ref={wrapRef}>

      {/* ── Botão Voltar ── */}
      <div style={{ marginBottom:16 }}>
        <button onClick={handleVoltar} style={{ background:"none", border:"none", padding:"0", fontSize:13, color:"#828a98", cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="#828a98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Voltar
        </button>
      </div>

      {/* ── Identificação ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:32 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:"#111", padding:"4px 0" }}>{clienteNome || "—"}</div>
        </div>
        <div>
          <span style={C.fieldLabel}>Referência</span>
          <input style={C.input} placeholder="Nome do projeto, endereço ou bairro"
            value={referencia} onChange={e => setReferencia(e.target.value)} />
        </div>
      </div>

      {/* ── Fluxo sequencial de parâmetros (horizontal: botão ativo à esquerda + valores editáveis à direita) ── */}
      {(() => {
        // Determina qual é a próxima etapa pendente (ordem: tipoObra → tipoProjeto → padrao → tipologia → tamanho)
        // Pula etapas condicionais (padrao/tipologia/tamanho só se !isComercial)
        const ordem = ["tipoObra", "tipoProjeto"];
        if (!isComercial) ordem.push("padrao", "tipologia", "tamanho");
        const proxima = ordem.find(k => !VALS[k]);
        const concluido = !proxima;
        return (
          <div style={{ display:"flex", alignItems:"center", gap:18, flexWrap:"wrap", minHeight:42 }}>
            {/* Botão ativo à esquerda (ou "Concluído" quando tudo preenchido) */}
            {proxima ? renderStep(proxima) : (
              <div style={{
                display:"inline-flex", alignItems:"center",
                padding:"9px 18px", border:"1px solid #c0c5cf", borderRadius:10,
                fontSize:11, background:"#f4f5f7", color:"#828a98",
                minWidth:110, justifyContent:"center", userSelect:"none",
              }}>
                Concluído ✓
              </div>
            )}
            {/* Valores escolhidos em ordem — cada um editável via hover */}
            {ordem.map(k => VALS[k] ? renderValor(k) : null)}
          </div>
        );
      })()}

      {/* ── Cômodos + Resumo ── */}
      {!!(tamanho || isComercial) && !!configAtual && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 400px", gap:32, alignItems:"start",
          animation:"slideUp 0.5s ease forwards",
          marginTop:32,
        }}>

          <div>
            {/* Toggles de serviços */}
            <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:12, alignItems:"center" }}>
              {[
                { key:"incluiArq",        val:incluiArq,        set:setIncluiArq,        label:"Arquitetura"  },
                { key:"incluiEng",        val:incluiEng,        set:setIncluiEng,        label:"Engenharia"   },
                { key:"incluiMarcenaria", val:incluiMarcenaria, set:setIncluiMarcenaria, label:"Marcenaria"   },
              ].map(({ key, val, set, label }) => (
                <label key={key} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", userSelect:"none" }}>
                  <span onClick={() => set(v => !v)} style={{
                    position:"relative", display:"inline-block",
                    width:36, height:20, borderRadius:10, flexShrink:0,
                    background: val ? "#111" : "#d1d5db",
                    transition:"background 0.2s",
                    cursor:"pointer",
                  }}>
                    <span style={{
                      position:"absolute", top:3, left: val ? 19 : 3,
                      width:14, height:14, borderRadius:"50%",
                      background:"#fff",
                      transition:"left 0.2s",
                      boxShadow:"0 1px 3px rgba(0,0,0,0.2)",
                    }} />
                  </span>
                  <span style={{ fontSize:13, color: val ? "#111" : "#828a98", fontWeight: val ? 600 : 400, transition:"color 0.2s" }}>
                    {label}
                  </span>
                </label>
              ))}
              {tipoProjeto !== "Conj. Comercial" && (
                <div style={{ display:"flex", alignItems:"center", gap:6, paddingLeft:8, borderLeft:"1px solid #e5e7eb" }}>
                  <span style={{ fontSize:13, color:"#828a98" }}>Repetição</span>
                  <button style={{ width:22, height:22, borderRadius:5, border:"1px solid #d0d4db", background:"#fff", fontSize:14, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1, color:"#374151" }}
                    onClick={() => setQtdRep(n => Math.max(0, n - 1))}>−</button>
                  {editandoRep ? (
                    <input
                      autoFocus
                      type="number" min="0"
                      defaultValue={qtdRep}
                      onBlur={e => { const v = parseInt(e.target.value)||0; setQtdRep(Math.max(0,v)); setEditandoRep(false); }}
                      onKeyDown={e => { if(e.key==="Enter"||e.key==="Escape"){ const v=parseInt(e.target.value)||0; setQtdRep(Math.max(0,v)); setEditandoRep(false); } }}
                      className="no-spin"
                      style={{ width:36, textAlign:"center", fontSize:13, fontWeight:600, border:"1px solid #333", borderRadius:5, padding:"1px 4px", outline:"none", fontFamily:"inherit", MozAppearance:"textfield" }}
                    />
                  ) : (
                    <span
                      onClick={() => setEditandoRep(true)}
                      title="Clique para digitar"
                      style={{ fontSize:13, fontWeight: qtdRep > 0 ? 700 : 400, minWidth:16, textAlign:"center", color: qtdRep > 0 ? "#111" : "#9ca3af", cursor:"text" }}>
                      {qtdRep}
                    </span>
                  )}
                  <button style={{ width:22, height:22, borderRadius:5, border:"1px solid #d0d4db", background:"#fff", fontSize:14, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1, color:"#374151" }}
                    onClick={() => setQtdRep(n => n + 1)}>+</button>
                </div>
              )}
            </div>



            {/* Container 1 coluna */}
            <div>
            {Object.entries(configAtual.grupos).filter(([grupo]) => {
                const isTerrea = tipologia === "Térreo" || tipologia === "Térrea";
                if (isTerrea && grupo === "Outros") return false;
                return true;
              }).map(([grupo, nomes]) => {
              // Split: escolhidos vs disponíveis
              const escolhidos  = nomes.filter(n => (qtds[n] || 0) > 0);
              const disponiveis = nomes.filter(n => (qtds[n] || 0) === 0);
              const m2Grupo  = escolhidos.reduce((s,n) => s + getArea(n) * (qtds[n]||0), 0);
              const qtdGrupo = escolhidos.reduce((s,n) => s + (qtds[n]||0), 0);

              // Renderiza controles: input + 1-6 + ✕ (se escolhido)
              // Função plana (não componente) pra evitar unmount/remount a cada re-render
              const renderControles = (nome, sempreVisivel) => {
                const q = qtds[nome] || 0;
                const isOpen = comodoAberto === nome;
                const visivel = sempreVisivel || isOpen;
                // Só renderiza quando visível — quando fechado, não ocupa espaço no layout
                if (!visivel) return null;
                return (
                  <span key={nome+"-ctrls"}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 1,
                      transition: "opacity 0.15s ease",
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                      background: "transparent",
                      padding: 0,
                      borderRadius: 4,
                      border: "none",
                      zIndex: 100,
                      position: "relative",
                    }}>
                    {/* Input em primeiro lugar */}
                    <input
                      type="number" min="0"
                      defaultValue={q > 6 ? q : ""}
                      className="no-spin"
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => e.stopPropagation()}
                      onFocus={e => {
                        setComodoAberto(nome);
                        setTravado(true);
                        if (comodoCloseRef.current) { clearTimeout(comodoCloseRef.current); comodoCloseRef.current = null; }
                      }}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          const v = parseInt(e.currentTarget.value) || 0;
                          if (v > 0) setQtdAbs(nome, v);
                          setTravado(false);
                          setComodoAberto(null);
                          e.currentTarget.blur();
                        } else if (e.key === "Escape") {
                          setTravado(false);
                          setComodoAberto(null);
                          e.currentTarget.blur();
                        }
                      }}
                      style={{
                        width:28, height:22, border:"1px solid #d1d5db", borderRadius:4,
                        background:"#fff", fontSize:11, fontWeight:500, color:"#111",
                        padding:"0 2px", textAlign:"center", outline:"none", fontFamily:"inherit",
                        flexShrink:0, marginRight:2,
                        MozAppearance:"textfield",
                      }}
                    />
                    {[1,2,3,4,5,6].map(n => (
                      <button key={n}
                        onClick={e => { e.stopPropagation(); setQtdAbs(nome, n); setTravado(false); setComodoAberto(null); }}
                        style={{
                          width:22, height:22, border:"1px solid transparent", borderRadius:4,
                          background: q===n ? "#111" : "transparent",
                          color: q===n ? "#fff" : "#6b7280",
                          fontSize:11, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
                          display:"inline-flex", alignItems:"center", justifyContent:"center",
                          flexShrink:0, padding:0,
                          transition:"all 0.1s",
                        }}
                        onMouseEnter={e => { if (q !== n) { e.currentTarget.style.background = "#111"; e.currentTarget.style.color = "#fff"; } }}
                        onMouseLeave={e => { if (q !== n) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6b7280"; } }}>
                        {n}
                      </button>
                    ))}
                    {q > 0 && (
                      <>
                        <span style={{ width:1, height:14, background:"#d1d5db", margin:"0 3px", alignSelf:"center" }} />
                        <button
                          onClick={e => { e.stopPropagation(); setQtdAbs(nome, 0); setTravado(false); setComodoAberto(null); }}
                          title="Remover"
                          style={{
                            width:22, height:22, border:"1px solid transparent", borderRadius:4,
                            background:"transparent", color:"#dc2626", fontSize:12,
                            display:"inline-flex", alignItems:"center", justifyContent:"center",
                            cursor:"pointer", fontFamily:"inherit", flexShrink:0, padding:0,
                          }}>
                          ✕
                        </button>
                      </>
                    )}
                  </span>
                );
              };

              const recolhido = !isGrupoAberto(grupo);

              return (
                <div key={grupo} style={{ marginBottom:14 }}>
                  {/* Header: retângulo cinza com bordas arredondadas */}
                  <div style={{
                    display:"flex", alignItems:"center", gap:10,
                    background:"#f4f5f7", border:"1px solid #e5e7eb", borderRadius:6,
                    padding:"5px 10px",
                    marginBottom: (recolhido && escolhidos.length === 0) ? 0 : 8,
                  }}>
                    <span style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, fontWeight:600, userSelect:"none", flexShrink:0 }}>
                      {isComercial ? (GRUPO_DISPLAY[grupo] || grupo) : grupo}
                    </span>
                    {/* Resetar — só aparece no primeiro grupo, reseta TODOS os cômodos */}
                    {grupo === "Áreas Sociais" && Object.keys(qtds).some(n => qtds[n] > 0) && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setQtds({});
                          setGruposAbertos({});
                        }}
                        style={{
                          background:"transparent", border:"1px solid #d0d4db",
                          color:"#6b7280", fontSize:10, fontFamily:"inherit",
                          cursor:"pointer", padding:"1px 8px", borderRadius:4,
                          transition:"all 0.15s", fontWeight:500, lineHeight:1.4,
                          flexShrink:0,
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = "#dc2626";
                          e.currentTarget.style.color = "#dc2626";
                          e.currentTarget.style.background = "#fef2f2";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = "#d0d4db";
                          e.currentTarget.style.color = "#6b7280";
                          e.currentTarget.style.background = "transparent";
                        }}>
                        Resetar
                      </button>
                    )}
                    <span style={{ flex:1 }} />

                    {/* Controles específicos de grupos comerciais: Padrão/Tipologia/Tamanho + Quantidade de unidades */}
                    {isComercial && (
                      <>
                        {["padrao","tipologia","tamanho"].map(key => {
                          const labels = { padrao:"Padrão", tipologia:"Tipologia", tamanho:"Tamanho" };
                          const opcoes = { padrao:["Alto","Médio","Baixo"], tipologia:["Térreo","Sobrado"], tamanho:["Grande","Médio","Pequeno","Compacta"] };
                          const gp = grupoParams[grupo] || {};
                          const val = gp[key] || "";
                          const aKey = `${grupo}__${key}`;
                          const open = abertoGrupo?.key === aKey;
                          return (
                            <div key={key} style={{ position:"relative", flexShrink:0 }}
                              onMouseEnter={() => {
                                if (hoverCloseRef.current) { clearTimeout(hoverCloseRef.current); hoverCloseRef.current = null; }
                                setAbertoGrupo({ key: aKey, grupo, param: key });
                              }}
                              onMouseLeave={() => {
                                if (hoverCloseRef.current) clearTimeout(hoverCloseRef.current);
                                hoverCloseRef.current = setTimeout(() => setAbertoGrupo(null), 120);
                              }}>
                              <button
                                onClick={e => { e.stopPropagation(); setAbertoGrupo(open ? null : { key: aKey, grupo, param: key }); }}
                                style={{
                                  display:"flex", alignItems:"center", gap:4,
                                  background: open ? "#eceef2" : (val ? "#fff" : "transparent"),
                                  border: `1px solid ${open ? "#828a98" : (val ? "#d0d4db" : "#d0d4db")}`,
                                  borderRadius:4, padding:"2px 8px",
                                  fontSize:10, fontFamily:"inherit", cursor:"pointer",
                                  color:"#111", lineHeight:1.4, transition:"all 0.15s",
                                }}>
                                {val
                                  ? <><span style={{ color:"#828a98", fontWeight:400 }}>{labels[key]}:</span><span style={{ fontWeight:600, color:"#111" }}>{val}</span></>
                                  : <span style={{ color:"#6b7280" }}>{labels[key]}</span>}
                                <svg width="8" height="8" viewBox="0 0 12 12" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition:"transform 0.15s" }}>
                                  <path d="M2 4l4 4 4-4" stroke="#828a98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                              {open && (
                                <div style={{ position:"absolute", top:"100%", left:0, zIndex:9999,
                                  background:"#fff", border:"1px solid #b0b7c3", borderRadius:8,
                                  boxShadow:"0 4px 20px rgba(0,0,0,0.12)", minWidth:110, overflow:"hidden", marginTop:4 }}>
                                  {opcoes[key].map(op => {
                                    const selecionado = val === op;
                                    return (
                                      <div key={op}
                                        onClick={e => { e.stopPropagation(); setGrupoParam(grupo, key, op); }}
                                        onMouseEnter={e => { if (!selecionado) e.currentTarget.style.background = "#f4f5f7"; }}
                                        onMouseLeave={e => { if (!selecionado) e.currentTarget.style.background = "#fff"; }}
                                        style={{
                                          padding:"6px 12px", fontSize:12, cursor:"pointer",
                                          background: selecionado ? "#eceef2" : "#fff",
                                          color:"#374151", fontWeight: selecionado ? 600 : 400,
                                        }}>
                                        {op}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Controle de quantidade de unidades do grupo (− N +) */}
                        <div style={{ display:"flex", alignItems:"center", gap:3, flexShrink:0, paddingLeft:6, borderLeft:"1px solid #d0d4db" }}>
                          <button
                            onClick={() => setGrupoQtd(grupo, -1)}
                            style={{ width:18, height:18, borderRadius:4, border:"1px solid #d0d4db", background:"#fff", fontSize:11, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1, color:"#374151", padding:0 }}>
                            −
                          </button>
                          {editandoGrupoQtd === grupo ? (
                            <input
                              autoFocus
                              type="number" min="0"
                              defaultValue={grupoQtds[grupo]||0}
                              onBlur={e => {
                                const v = Math.max(0, parseInt(e.target.value)||0);
                                setGrupoQtds(prev => ({ ...prev, [grupo]: v }));
                                setEditandoGrupoQtd(null);
                              }}
                              onKeyDown={e => {
                                if (e.key === "Enter" || e.key === "Escape") {
                                  const v = Math.max(0, parseInt(e.target.value)||0);
                                  setGrupoQtds(prev => ({ ...prev, [grupo]: v }));
                                  setEditandoGrupoQtd(null);
                                }
                              }}
                              className="no-spin"
                              style={{ width:36, textAlign:"center", fontSize:11, fontWeight:600, border:"1px solid #333", borderRadius:4, padding:"1px 4px", outline:"none", fontFamily:"inherit", MozAppearance:"textfield" }}
                            />
                          ) : (
                            <span
                              onClick={() => setEditandoGrupoQtd(grupo)}
                              title="Clique para digitar"
                              style={{ fontSize:11, fontWeight: (grupoQtds[grupo]||0) > 0 ? 700 : 400, minWidth:18, textAlign:"center", color: (grupoQtds[grupo]||0) > 0 ? "#111" : "#9ca3af", cursor:"text" }}>
                              {grupoQtds[grupo]||0}
                            </span>
                          )}
                          <button
                            onClick={() => setGrupoQtd(grupo, +1)}
                            style={{ width:18, height:18, borderRadius:4, border:"1px solid #d0d4db", background:"#fff", fontSize:11, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1, color:"#374151", padding:0 }}>
                            +
                          </button>
                        </div>
                      </>
                    )}

                    {qtdGrupo > 0 && (
                      <span style={{ fontSize:10, color:"#9ca3af" }}>
                        <strong style={{ color:"#111", fontWeight:600 }}>{qtdGrupo * (isComercial ? (grupoQtds[grupo]||1) : 1)}</strong> amb · <strong style={{ color:"#111", fontWeight:600 }}>{fmtNum(m2Grupo * (isComercial ? (grupoQtds[grupo]||1) : 1))}</strong> m²
                      </span>
                    )}
                    <button
                      onClick={() => toggleGrupo(grupo)}
                      title={recolhido ? "Expandir" : "Recolher"}
                      style={{
                        width:18, height:18, border:"none", background:"transparent",
                        cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                        padding:0, fontFamily:"inherit", flexShrink:0,
                      }}>
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ transform: recolhido ? "rotate(180deg)" : "rotate(0)", transition:"transform 0.2s" }}>
                        <path d="M2 8l4-4 4 4" stroke="#828a98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>

                  {!recolhido && disponiveis.length > 0 && (
                    <>
                      {/* Disponíveis — layout em 2 colunas padronizado: nome (fixo) + quantidades (fundo cinza) */}
                      <div style={{ position:"relative", marginTop:4, maxWidth:380 }}>
                        {/* Faixa de fundo da coluna de quantidades + título */}
                        <div style={{
                          position:"absolute", top:0, right:0, bottom:0,
                          width:180,
                          background:"#f4f5f7",
                          borderRadius:6,
                          zIndex:0,
                        }}>
                          <div style={{
                            fontSize:9, color:"#6b7280",
                            textTransform:"uppercase", letterSpacing:1, fontWeight:600,
                            padding:"4px 10px", textAlign:"center",
                            borderBottom:"1px solid #e5e7eb",
                          }}>
                            Quantidades
                          </div>
                        </div>
                        {/* Lista */}
                        <div style={{ display:"flex", flexDirection:"column", gap:2, position:"relative", zIndex:1, paddingTop:22 }}>
                          {disponiveis.map(nome => {
                            const isOpen = comodoAberto === nome;
                            return (
                              <div key={nome}
                                data-comodo-wrap
                                data-comodo-nome={nome}
                                onMouseEnter={() => abrirComodo(nome)}
                                onMouseLeave={agendarFecharComodo}
                                style={{
                                  position:"relative",
                                  display:"flex", alignItems:"center",
                                  padding:"4px 8px", fontSize:13,
                                  color: isOpen ? "#111" : "#6b7280",
                                  background: isOpen ? "#e5e7eb" : "transparent",
                                  borderRadius:6,
                                  userSelect:"none",
                                  transition:"color 0.15s, background 0.15s",
                                  minHeight:28,
                                }}>
                                <span style={{ flex:1, fontWeight: isOpen ? 500 : 400, minWidth:0, whiteSpace:"nowrap" }}>
                                  {nome}
                                  {(nome === "Suíte" || nome === "Dormitório") && (
                                    <span style={{ fontSize:10, color:"#9ca3af", marginLeft:5, fontWeight:400 }}>(Sem Closet)</span>
                                  )}
                                </span>
                                <span style={{ width:180, flexShrink:0, display:"flex", justifyContent:"center", alignItems:"center" }}>
                                  {renderControles(nome, false)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Escolhidos — SEMPRE visíveis, mesmo com grupo recolhido */}
                  {escolhidos.length > 0 && (
                    <div style={{
                      display:"flex", flexDirection:"row", flexWrap:"wrap", alignItems:"center",
                      gap:"6px 14px",
                      paddingTop: (!recolhido && disponiveis.length > 0) ? 10 : 0,
                      marginTop:  (!recolhido && disponiveis.length > 0) ? 10 : 4,
                      borderTop:  (!recolhido && disponiveis.length > 0) ? "1px dashed #e5e7eb" : "none",
                      width:"100%",
                    }}>
                      {escolhidos.map(nome => {
                        const q = qtds[nome] || 0;
                        const m2Total = getArea(nome) * q;
                        return (
                          <span key={nome}
                            onClick={() => setQtdAbs(nome, 0)}
                            title="Clique para remover"
                            className="comodo-escolhido"
                            style={{
                              display:"inline-flex", alignItems:"center", gap:4,
                              fontSize:13, color:"#111",
                              userSelect:"none",
                              whiteSpace:"nowrap",
                              flex:"0 0 auto",
                              cursor:"pointer",
                              transition:"color 0.15s",
                            }}>
                            <span>
                              {nome}
                              {(nome === "Suíte" || nome === "Dormitório") && (
                                <span style={{ fontSize:10, color:"#9ca3af", marginLeft:4, fontWeight:400 }}>(Sem Closet)</span>
                              )}
                              {" "}<strong style={{ fontWeight:600 }}>{q}</strong>
                              <span className="comodo-m2" style={{ fontSize:11, color:"#9ca3af", marginLeft:6, transition:"color 0.15s" }}>{fmtNum(m2Total)} m²</span>
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
              })}
              {/* Folga no final — compensa a altura que as linhas selecionadas deixam
                  de ocupar na lista de disponíveis. Mantém altura total constante pra
                  que o scroll não seja reajustado ao selecionar (o próximo cômodo
                  sobe exatamente pra posição do cursor). */}
              {(() => {
                const gruposVisiveis = Object.entries(configAtual.grupos).filter(([g]) => {
                  const isTerrea = tipologia === "Térreo" || tipologia === "Térrea";
                  if (isTerrea && g === "Outros") return false;
                  return isGrupoAberto(g);
                });
                // Conta cômodos selecionados dentro dos grupos visíveis/expandidos
                const selecionadosVisiveis = gruposVisiveis.reduce((acc, [, nomes]) =>
                  acc + nomes.filter(n => (qtds[n]||0) > 0).length, 0);
                // 30px = minHeight 28 + gap 2 (uma linha da lista de disponíveis)
                const folga = selecionadosVisiveis * 30;
                return folga > 0 ? <div style={{ height: folga, flexShrink: 0 }} aria-hidden="true" /> : null;
              })()}
            </div>
          </div>

          {/* Resumo Cálculo */}
          <div style={{ position:"sticky", top:24 }}>
            {temComodos && calculo ? (
              <div>
                <div style={C.resumoBox}>
                  <div style={C.resumoHdr}>Resumo Cálculo</div>
                  <AreaDetalhe calculo={calculo} fmtNum={fmtNum} />
                  <ResumoDetalhes calculo={{
                    ...calculo,
                    precoArq:   incluiArq ? calculo.precoArq : 0,
                    precoEng:   incluiEng ? calculo.precoEng : 0,
                    precoM2Arq: incluiArq ? calculo.precoM2Arq : 0,
                    precoM2Eng: incluiEng ? calculo.precoM2Eng : 0,
                  }} fmtNum={fmtNum} C={C} />
                </div>
                <button
                  style={{ width:"100%", marginTop:12, background:"#f3f4f6", color:"#111", border:"1px solid #c8cdd6", borderRadius:10, padding:"13px 0", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", letterSpacing:0.2, transition:"background 0.15s, border-color 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background="#e5e7eb"; e.currentTarget.style.borderColor="#d1d5db"; }}
                  onMouseLeave={e => { e.currentTarget.style.background="#f3f4f6"; e.currentTarget.style.borderColor="#e5e7eb"; }}
                  onClick={gerarProposta}>
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

      {(() => {
        if (calculo) {
          const _arqV = calculo.precoArq;
          const _engV = calculo.precoEng;
          const _totSI = _arqV + _engV;
          const _totCI = temImposto ? Math.round(_totSI/(1-aliqImp/100)*100)/100 : _totSI;
          const _impostoV = temImposto ? Math.round((_totCI-_totSI)*100)/100 : 0;
          window.__obraModalVals = { totSI: _totSI, totCI: _totCI, impostoV: _impostoV };
        }
        return null;
      })()}


      {aberto && (
        <div
          onMouseEnter={() => {
            // Mantém aberto quando mouse entra no painel
            if (hoverCloseRef.current) { clearTimeout(hoverCloseRef.current); hoverCloseRef.current = null; }
          }}
          onMouseLeave={() => {
            // Fecha ao sair do painel (sem delay pois já saiu do botão também)
            if (hoverCloseRef.current) clearTimeout(hoverCloseRef.current);
            hoverCloseRef.current = setTimeout(() => {
              setHoverDrop(null);
              setAberto(null);
            }, 80);
          }}
          style={{
          position:"fixed",
          top: panelPos.top, left: panelPos.left,
          zIndex:9999,
          background:"#fff", border:"1px solid #b0b7c3", borderRadius:10,
          boxShadow:"0 4px 20px rgba(0,0,0,0.12)", minWidth:160, overflow:"hidden",
        }}>
          {(OPCOES[aberto] || []).map(op => {
            const val = VALS[aberto];
            return (
              <div key={op}
                style={C.dropItem(val === op)}
                onMouseEnter={e => { if (val !== op) e.currentTarget.style.background = "#f4f5f7"; }}
                onMouseLeave={e => { if (val !== op) e.currentTarget.style.background = val === op ? "#efefef" : "#fff"; }}
                onClick={() => selecionar(aberto, op)}>
                {op}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal "Deseja salvar?" ao voltar com dados preenchidos */}
      {showSaveDialog && (
        <div
          onClick={() => setShowSaveDialog(false)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:"#fff", borderRadius:12, padding:"28px 28px 20px", maxWidth:380, width:"90%", boxShadow:"0 8px 32px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize:16, fontWeight:700, color:"#111", marginBottom:8 }}>Salvar este orçamento?</div>
            <div style={{ fontSize:13, color:"#6b7280", marginBottom:22, lineHeight:1.5 }}>
              Você iniciou um orçamento mas ainda não finalizou. Deseja salvá-lo como rascunho para continuar depois?
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button
                onClick={() => { setShowSaveDialog(false); onVoltar(); }}
                style={{ background:"#fff", color:"#6b7280", border:"1px solid #d1d5db", borderRadius:8, padding:"9px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                Não
              </button>
              <button
                onClick={salvarRascunhoEVoltar}
                style={{ background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"9px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                Sim, salvar
              </button>
            </div>
          </div>
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
    wrap: { fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", background:"#fff", minHeight:"100vh", color:"#111", maxWidth:1200, margin:"0 auto" },
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
  const res = await fetch("https://orbi-production-5f5c.up.railway.app" + path, {
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
    { k:"clientes",         label:"Clientes",     desc:"Cadastro e orçamentos",     count: data?.clientes?.length },
    { k:"projetos:etapas",  label:"Projetos",     desc:"Etapas e prazos" },
    { k:"obras",            label:"Obras",        desc:"Acompanhamento e execução" },
    { k:"financeiro",       label:"Financeiro",   desc:"Receitas e lançamentos" },
    { k:"fornecedores",     label:"Fornecedores", desc:"Cadastro e histórico",      count: data?.fornecedores?.length },
    { k:"escritorio",       label:"Escritório",   desc:"Dados e equipe" },
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
  const [orcamentoTelaCheia, setOrcamentoTelaCheia] = useState(null); // { clienteOrc, orcBase, modo }
  const [clienteRetorno, setClienteRetorno] = useState(null); // cliente pra abrir detail ao fechar orçamento
  const [backendOffline, setBackendOffline]   = useState(false);

  // Accordion: Projetos fica aberto quando qualquer aba "projetos:*" está ativa
  // IMPORTANTE: hooks DEVEM ser chamados antes de qualquer return condicional (regra do React)
  const [projetosAberto, setProjetosAberto] = useState(() => (typeof aba === "string" && aba.indexOf("projetos") === 0));
  useEffect(() => {
    if (typeof aba === "string" && aba.indexOf("projetos") === 0) setProjetosAberto(true);
  }, [aba]);

  useEffect(() => { if (autenticado) loadData(); }, [autenticado]);

  // Migração de abas antigas para nova nomenclatura
  useEffect(() => {
    if (aba === "projetos") setAba("projetos:etapas");
    else if (aba === "teste") setAba("projetos:orcamentos");
  }, [aba]);

  useEffect(() => {
    const handler = e => { e.preventDefault(); e.returnValue = "Deseja sair?"; return e.returnValue; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  function handleLogin(usr, tok) { setUsuario(usr); setToken(tok); setAutenticado(true); }
  function handleLogout() { clearAuth(); setUsuario(null); setToken(null); setAutenticado(false); setData(null); }

  async function loadData() {
    try {
      const saved = await loadAllData();
      setData(saved);
      setBackendOffline(false);
    }
    catch(e) {
      console.error("Erro ao carregar dados do servidor:", e);
      setData(SEED);
      setBackendOffline(true);
    }
    setLoading(false);
  }

  async function save(newData, opts = {}) {
    const oldData = data;
    setData(newData);
    try {
      await saveAllData(newData, oldData);
      setBackendOffline(false);
      if (!opts.skipReload) {
        const fresh = await loadAllData();
        setData(fresh);
      }
    }
    catch(e) {
      console.error("Erro ao salvar:", e);
      setBackendOffline(true);
    }
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

  // Itens do menu. "projetos" tem sub-itens que ficam num accordion.
  // Chaves das abas (aba state):
  //   "projetos:orcamentos" → módulo Orçamentos
  //   "projetos:etapas"     → Kanban "Em Andamento"
  const MENU = [
    { k:"home",        label:"Início" },
    { k:"clientes",    label:"Clientes",     count: data?.clientes?.length },
    { k:"projetos", label:"Projetos", sub: [
      { k:"projetos:orcamentos", label:"Orçamentos" },
      { k:"projetos:etapas",     label:"Em Andamento" },
    ]},
    { k:"obras",       label:"Obras" },
    { k:"financeiro",  label:"Financeiro" },
    { k:"fornecedores",label:"Fornecedores", count: data?.fornecedores?.length },
    { k:"nf",          label:"Notas Fiscais" },
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
            {MENU.map(item => {
              const {k, label, count, sub} = item;
              // Item com sub-menu (accordion)
              if (sub && sub.length) {
                const ativoNeleMesmoOuSubitem = aba === k || (typeof aba === "string" && aba.indexOf(k + ":") === 0);
                return (
                  <div key={k} style={{ display:"flex", flexDirection:"column" }}>
                    <button
                      style={{
                        ...itemStyle(ativoNeleMesmoOuSubitem),
                        // Força chevron grudado ao texto (ignora o space-between do itemStyle)
                        justifyContent: "flex-start",
                        gap: 6,
                        // Quando algum subitem está ativo, o pai fica "suavemente marcado"
                        background: ativoNeleMesmoOuSubitem && aba !== k ? "transparent" : undefined,
                        fontWeight: ativoNeleMesmoOuSubitem ? 600 : 400,
                        color: ativoNeleMesmoOuSubitem ? "#111" : "#6b7280",
                      }}
                      onMouseEnter={e => { if (!ativoNeleMesmoOuSubitem) e.currentTarget.style.background="#f9fafb"; }}
                      onMouseLeave={e => { if (!ativoNeleMesmoOuSubitem) e.currentTarget.style.background="transparent"; }}
                      onClick={() => setProjetosAberto(o => !o)}
                    >
                      <span>{label}</span>
                      <span style={{
                        color:"#9ca3af", fontSize:9,
                        transition:"transform 0.2s",
                        transform: projetosAberto ? "rotate(90deg)" : "rotate(0deg)",
                        display:"inline-block",
                        lineHeight: 1,
                      }}>▶</span>
                    </button>
                    {projetosAberto && (
                      <div style={{ display:"flex", flexDirection:"column", gap:1, marginLeft:14, paddingLeft:8, borderLeft:"1px solid #f3f4f6", marginTop:2 }}>
                        {sub.map(s => {
                          const ativoSub = aba === s.k;
                          return (
                            <button
                              key={s.k}
                              style={{
                                padding:"6px 10px", borderRadius:6,
                                fontSize:12.5,
                                color: ativoSub ? "#111" : "#9ca3af",
                                fontWeight: ativoSub ? 600 : 400,
                                background: ativoSub ? "#f3f4f6" : "transparent",
                                cursor:"pointer", border:"none",
                                fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",
                                textAlign:"left", transition:"all 0.12s",
                              }}
                              onMouseEnter={e => { if (!ativoSub) { e.currentTarget.style.background="#f9fafb"; e.currentTarget.style.color="#6b7280"; } }}
                              onMouseLeave={e => { if (!ativoSub) { e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#9ca3af"; } }}
                              onClick={() => {
                                setAba(s.k);
                                setOrcamentoTelaCheia(null);
                                if (s.k === "projetos:etapas") setProjetosKey(n=>n+1);
                              }}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              // Item simples
              return (
                <button key={k} style={itemStyle(aba===k)}
                  onMouseEnter={e => { if(aba!==k) e.currentTarget.style.background="#f9fafb"; }}
                  onMouseLeave={e => { if(aba!==k) e.currentTarget.style.background="transparent"; }}
                  onClick={() => {
                    setAba(k);
                    setOrcamentoTelaCheia(null);
                    if(k==="clientes")    setClientesKey(n=>n+1);
                    if(k==="obras")       setObrasKey(n=>n+1);
                    if(k==="financeiro")  setFinanceiroKey(n=>n+1);
                    if(k==="fornecedores")setFornecedoresKey(n=>n+1);
                  }}>
                  <span>{label}</span>
                  {count > 0 && <span style={{ background:"#f3f4f6", color:"#9ca3af", fontSize:11, padding:"1px 7px", borderRadius:8 }}>{count}</span>}
                </button>
              );
            })}
          </nav>
          <div style={{ padding:"8px 8px 12px", borderTop:"1px solid #f3f4f6", display:"flex", flexDirection:"column", gap:2 }}>
            <button style={itemStyle(aba==="escritorio")}
              onMouseEnter={e => { if(aba!=="escritorio") e.currentTarget.style.background="#f9fafb"; }}
              onMouseLeave={e => { if(aba!=="escritorio") e.currentTarget.style.background="transparent"; }}
              onClick={() => { setAba("escritorio"); setEscritorioKey(n=>n+1); setOrcamentoTelaCheia(null); }}>
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
        {backendOffline && (
          <div style={{ background:"#fef2f2", borderBottom:"1px solid #fecaca", padding:"8px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
            <div style={{ fontSize:12, color:"#991b1b" }}>
              <span style={{ fontWeight:600 }}>⚠ Servidor indisponível</span>
              <span style={{ marginLeft:8, color:"#b91c1c" }}>— trabalhando no modo offline. Alterações não serão salvas até o servidor voltar.</span>
            </div>
            <button onClick={loadData} style={{ background:"#fff", color:"#991b1b", border:"1px solid #fca5a5", borderRadius:6, padding:"4px 12px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
              Tentar reconectar
            </button>
          </div>
        )}
        <div style={{ flex:1, overflowY:"auto" }}>
          <>
          {orcamentoTelaCheia ? (
            <FormOrcamentoProjetoTeste
              clienteNome={orcamentoTelaCheia.clienteOrc.nome}
              clienteWA={orcamentoTelaCheia.clienteOrc.contatos?.find(c=>c.whatsapp)?.telefone||""}
              orcBase={orcamentoTelaCheia.orcBase || null}
              modoVer={orcamentoTelaCheia.modo === "ver"}
              onSalvar={async (orc) => {
                const todos = data.orcamentosProjeto || [];
                const maxSeq = todos.reduce((mx2, o2) => {
                  const mm = (o2.id||"").match(/^ORC-(\d+)$/);
                  return mm ? Math.max(mx2, parseInt(mm[1])) : mx2;
                }, 0);
                const nextId = "ORC-" + String(maxSeq + 1).padStart(4, "0");
                const novo2 = { ...orc, clienteId: orcamentoTelaCheia.clienteOrc.id, cliente: orcamentoTelaCheia.clienteOrc.nome, whatsapp: orcamentoTelaCheia.clienteOrc.contatos?.find(c=>c.whatsapp)?.telefone || "", id: orc.id || nextId, criadoEm: orc.criadoEm || new Date().toISOString() };
                const novos2 = orc.id ? todos.map(o2=>o2.id===orc.id?novo2:o2) : [...todos, novo2];
                await save({ ...data, orcamentosProjeto: novos2 }, { skipReload: true });
                // Não fecha a tela — apenas atualiza o orcBase para o PDF continuar aberto
                setOrcamentoTelaCheia(prev => ({ ...prev, orcBase: novo2 }));
              }}
              onVoltar={() => {
                // Lembra cliente para Clientes abrir direto no detail
                setClienteRetorno(orcamentoTelaCheia.clienteOrc);
                setOrcamentoTelaCheia(null);
                setAba("clientes");
                setClientesKey(n=>n+1);
                loadData();
              }}
            />
          ) : (<>
          {aba === "home"                   && <HomeMenu setAba={setAba} data={data} />}
          {aba === "clientes"               && <Clientes key={clientesKey} data={data} save={save} onReload={()=>setClientesKey(n=>n+1)} onAbrirOrcamento={(c, orc, modo) => setOrcamentoTelaCheia({ clienteOrc: c, orcBase: orc, modo: modo || "editar" })} orcamentoAberto={!!orcamentoTelaCheia} abrirClienteDetail={clienteRetorno} onClienteDetailAberto={() => setClienteRetorno(null)} />}
          {aba === "projetos:etapas"        && <Etapas key={projetosKey} data={data} save={save} />}
          {aba === "projetos:orcamentos"    && <TesteOrcamento data={data} save={save} />}
          {aba === "obras"                  && <Obras key={obrasKey} data={data} save={save} />}
          {aba === "financeiro"             && <Financeiro key={financeiroKey} data={data} save={save} />}
          {aba === "fornecedores"           && <Fornecedores key={fornecedoresKey} data={data} save={save} />}
          {aba === "nf"                     && <ImportarNF data={data} save={save} />}
          {aba === "escritorio"             && <Escritorio key={escritorioKey} data={data} save={save} />}
          </>)}
          </>
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
