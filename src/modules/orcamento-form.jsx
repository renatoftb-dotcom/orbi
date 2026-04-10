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
