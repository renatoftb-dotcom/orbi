// ═══════════════════════════════════════════════════════════════
// ONBOARDING — Sprint 3
// ═══════════════════════════════════════════════════════════════
// Tela bloqueante que aparece pra empresas novas (precisa_fazer_onboarding=true).
// Coleta perfil do escritório em 7 perguntas + estado, calcula pct_matriz,
// permite calibragem (digitar valor desejado pra casa exemplo) e salva.
//
// Estilo: vertical scrolling igual Claude.ai. Pergunta clicada → próxima
// aparece logo abaixo com fade-in suave. Pode voltar e mudar respostas
// anteriores — recálculos acontecem automaticamente.
//
// Visual: paleta neutra preto/branco, alinhada ao resto do app.
//
// Backend usa nomenclatura oficial NBR 12721 ("Normal" pro padrão médio),
// mas no UI mostramos "Médio" (mais intuitivo pro usuário). Mapeamento
// fica isolado nas constantes ESTADOS / labels da matriz.

// ── Constantes ─────────────────────────────────────────────────
// Estados que têm CUB coletado (alinhado com ESTADOS_VALIDOS_ONBOARDING do backend)
const ESTADOS_DISPONIVEIS = [
  { sigla: "SP", nome: "São Paulo (SP)" },
  { sigla: "RJ", nome: "Rio de Janeiro (RJ)" },
  { sigla: "MG", nome: "Minas Gerais (MG)" },
  { sigla: "SC", nome: "Santa Catarina (SC)" },
];

// Mapeia chave do backend → label de exibição.
// Padrão: backend manda "medio", mostramos "Maior parte médio padrão".
// Fonte da verdade são os labels que vêm de /api/onboarding/matriz, mas
// mantemos esses fallbacks caso a API esteja indisponível por algum motivo.
const ORDEM_PORTE = ["1-3", "4-10", "11-30", "30+"];
const ORDEM_EXPERIENCIA = ["0-2", "3-5", "6-10", "11-20", "20+"];
// "Referência no mercado" foi renomeada pra "Momento atual da carreira" — escala
// de 7 níveis cobrindo do iniciante ao referência internacional. O nome do
// campo no DB continua sendo `referencia` pra evitar migration de schema.
const ORDEM_REFERENCIA = [
  "iniciando",
  "alguns_projetos",
  "projetos_crescendo",
  "referencia_cidade",
  "referencia_alem",
  "nacional",
  "internacional",
];
const ORDEM_PADRAO = ["baixo", "medio", "alto"];

// ════════════════════════════════════════════════════════════════
// CASA EXEMPLO — usada pra calibragem e simulação
// ════════════════════════════════════════════════════════════════
// Composição "típica" residencial padrão Médio. DEVE BATER com a CASA_EXEMPLO
// definida no backend (server.js). Se mudar uma, mudar a outra — senão o
// pct_calibrado reverso vai sair errado quando o usuário calibrar.
//
// Espelha a estrutura do app real: índices de cômodos vêm de COMODOS de
// shared.jsx, áreas são as do tamanho "Médio".
const CASA_EXEMPLO = {
  comodos: [
    { nome: "Suíte Master",   qtd: 1, indice: 0.05, area: 32.50 }, // 5 × 6.5
    { nome: "Suíte",          qtd: 2, indice: 0.05, area: 25.30 }, // 4.6 × 5.5
    { nome: "Living",         qtd: 1, indice: 0.05, area: 32.00 }, // 8 × 4
    { nome: "Sala de jantar", qtd: 1, indice: 0.05, area: 12.00 }, // 4 × 3
    { nome: "Cozinha",        qtd: 1, indice: 0.08, area: 12.00 }, // 4 × 3
    { nome: "Lavabo",         qtd: 1, indice: 0.05, area:  2.80 }, // 2 × 1.4
    { nome: "Lavanderia",     qtd: 1, indice: 0.05, area:  6.00 }, // 3 × 2
    { nome: "Garagem",        qtd: 2, indice: 0.03, area: 15.60 }, // 5.2 × 3
  ],
  acrescimoCirk: 0.25,
  faixasDesconto: [
    { ate: 200,      desconto: 0.00 },
    { ate: 300,      desconto: 0.30 },
    { ate: 400,      desconto: 0.35 },
    { ate: 500,      desconto: 0.40 },
    { ate: 600,      desconto: 0.45 },
    { ate: Infinity, desconto: 0.50 },
  ],
};

// Calcula honorário da casa exemplo dado o precoBase (R$/m²). Reproduz
// fielmente a fórmula do orcamento-teste.jsx (indiceComodos somado, fator
// multiplicador, faixas de desconto progressivas). Padrão Médio = indicePadrao 0.
function calcularCasaExemplo(precoBase) {
  let indiceComodos = 0;
  let areaBruta = 0;
  for (const c of CASA_EXEMPLO.comodos) {
    indiceComodos += c.indice * c.qtd;
    areaBruta     += c.area   * c.qtd;
  }
  indiceComodos = Math.round(indiceComodos * 1000) / 1000;
  const areaTotal = Math.round(areaBruta * (1 + CASA_EXEMPLO.acrescimoCirk) * 100) / 100;
  const fatorMult = Math.round((1 + indiceComodos + 0) * 1000) / 1000;
  const precoM2Ef = precoBase * fatorMult;

  const faixas = [];
  let acum = 0, rest = areaTotal, total = 0;
  for (const f of CASA_EXEMPLO.faixasDesconto) {
    const chunk = Math.min(rest, f.ate - acum);
    if (chunk <= 0) break;
    const valorChunk = chunk * precoM2Ef * (1 - f.desconto);
    total += valorChunk;
    faixas.push({
      m2: Math.round(chunk * 100) / 100,
      desconto: f.desconto,
      precoM2Efetivo: Math.round(precoM2Ef * (1 - f.desconto) * 100) / 100,
      subtotal: Math.round(valorChunk * 100) / 100,
    });
    rest -= chunk; acum += chunk;
    if (rest <= 0) break;
  }

  return {
    areaBruta:     Math.round(areaBruta * 100) / 100,
    areaTotal,
    indiceComodos,
    fatorMult,
    precoM2:       Math.round(precoM2Ef * 100) / 100, // R$/m² cheio (sem desconto)
    faixas,
    honorario:     Math.round(total * 100) / 100,
  };
}

// Limites pra disparar aviso de "valor absurdo" na calibragem.
const RATIO_MUITO_BAIXO = 0.5;  // valor < 50% do calculado
const RATIO_MUITO_ALTO  = 2.0;  // valor > 200% do calculado

// ── Componente principal ───────────────────────────────────────
function TelaOnboarding({ usuario, onConcluido, onLogout }) {
  // Estado das respostas. null = ainda não respondeu.
  const [profissao, setProfissao]       = useState(null);  // "arquiteto" | "engenheiro"
  const [porte, setPorte]               = useState(null);
  const [experiencia, setExperiencia]   = useState(null);
  const [referencia, setReferencia]     = useState(null);
  const [padrao, setPadrao]             = useState(null);
  const [capital, setCapital]           = useState(null);  // boolean
  const [estado, setEstado]             = useState(null);

  // Matriz vinda do backend (com labels e ratings).
  const [matriz, setMatriz]             = useState(null);
  const [matrizErro, setMatrizErro]     = useState(null);

  // CUB do estado escolhido — buscado quando seleciona estado, usado pro
  // exemplo de cálculo na tela de resumo/calibragem.
  const [cubEstado, setCubEstado]       = useState(null);
  const [cubErro, setCubErro]           = useState(null);

  // Calibragem: null = ainda não decidiu, true = aceita o calculado,
  // false = quer ajustar (mostra campo de input).
  const [aceitouCalculado, setAceitouCalculado] = useState(null);
  const [valorCalibragem, setValorCalibragem]   = useState(""); // string do input
  const [confirmandoAbsurdo, setConfirmandoAbsurdo] = useState(false);

  // Estado de salvamento.
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState(null);

  // Após salvar com sucesso, mostra tela de transição com explicação do
  // que vem em seguida (cadastro do escritório). Usuário clica e libera.
  const [concluido, setConcluido] = useState(false);

  // Ref pra rolar o conteúdo conforme novas perguntas aparecem.
  const containerRef = useRef(null);

  // Busca matriz do backend ao montar.
  useEffect(() => {
    api.onboarding.matriz()
      .then(setMatriz)
      .catch(e => setMatrizErro(e.message || "Falha ao carregar perguntas"));
  }, []);

  // Busca CUB quando estado é selecionado (pra mostrar exemplo de cálculo).
  useEffect(() => {
    if (!estado) { setCubEstado(null); setCubErro(null); return; }
    setCubEstado(null);
    setCubErro(null);
    // CUB R-1 padrão Normal (médio) do estado escolhido — usado pra mostrar
    // o exemplo de honorário na tela de calibragem.
    api.cub.atual(estado, "R-1", "Normal")
      .then(setCubEstado)
      .catch(e => setCubErro(e.message || "Falha ao carregar CUB"));
  }, [estado]);

  // Auto-scroll suave pro fim do conteúdo quando uma pergunta nova aparece.
  // Detectamos "pergunta nova" quando qualquer resposta muda — aí esperamos
  // 1 frame pra DOM atualizar e rolamos.
  const lastAnswerCount = useRef(0);
  useEffect(() => {
    const respondidas = [profissao, porte, experiencia, referencia, padrao, capital, estado].filter(v => v !== null && v !== undefined).length;
    if (respondidas > lastAnswerCount.current) {
      lastAnswerCount.current = respondidas;
      // Esperar 1 tick pra DOM atualizar e medir altura corretamente
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" });
        }
      });
    } else {
      lastAnswerCount.current = respondidas;
    }
  }, [profissao, porte, experiencia, referencia, padrao, capital, estado]);

  // Rating efetivo somando as respostas atuais. Retorna null se ainda
  // faltam respostas (não dá pra mostrar resultado).
  const todasRespondidas = profissao && porte && experiencia && referencia && padrao && (capital !== null) && estado;
  const pctMatriz = useMemo(() => {
    if (!matriz || !todasRespondidas) return null;
    return (matriz.profissao?.[profissao]?.rating || 0)
         + (matriz.porte?.[porte]?.rating || 0)
         + (matriz.experiencia?.[experiencia]?.rating || 0)
         + (matriz.referencia?.[referencia]?.rating || 0)
         + (matriz.padrao_projetos?.[padrao]?.rating || 0)
         + (matriz.capital?.[String(capital)]?.rating || 0);
  }, [matriz, profissao, porte, experiencia, referencia, padrao, capital, todasRespondidas]);

  // Cálculo completo da casa exemplo (3 suítes, sala estar+jantar, cozinha,
  // lavabo, lavanderia, garagem 2 vagas — Médio padrão). Inclui faixas de
  // desconto, igual ao orçamento real. Preço base = pctMatriz × CUB R-1 Normal.
  const casaCalc = useMemo(() => {
    if (pctMatriz === null || !cubEstado) return null;
    const precoBase = pctMatriz * cubEstado.valor_m2;
    return calcularCasaExemplo(precoBase);
  }, [pctMatriz, cubEstado]);
  const honorarioCalculado = casaCalc?.honorario ?? null;

  // Análise da calibragem: valor digitado vs calculado. Como a fórmula nova
  // tem faixas de desconto não-lineares, o pct_calibrado reverso é encontrado
  // por bisseção (igual ao backend faz).
  const analiseCalibragem = useMemo(() => {
    if (aceitouCalculado !== false || !valorCalibragem || !honorarioCalculado || !cubEstado) return null;
    const v = parseFloat(String(valorCalibragem).replace(/[^\d,.-]/g, "").replace(",", "."));
    if (!v || v <= 0) return { invalido: true };

    // Bisseção: encontra pct tal que calcularCasaExemplo(pct * cub).honorario === v
    let lo = 0.001, hi = 0.20;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      const honor = calcularCasaExemplo(mid * cubEstado.valor_m2).honorario;
      if (honor < v) lo = mid; else hi = mid;
      if (Math.abs(honor - v) < 1) break;
    }
    const pctCalibrado = (lo + hi) / 2;

    const ratio = v / honorarioCalculado;
    return {
      valor: v,
      ratio,
      muitoBaixo: ratio < RATIO_MUITO_BAIXO,
      muitoAlto:  ratio > RATIO_MUITO_ALTO,
      pctCalibrado,
    };
  }, [valorCalibragem, honorarioCalculado, aceitouCalculado, cubEstado]);

  // Loading / erro inicial.
  if (matrizErro) {
    return (
      <div style={tela}>
        <div style={card}>
          <div style={{ fontSize:15, fontWeight:600, color:"#991b1b", marginBottom:8 }}>Erro ao carregar configuração</div>
          <div style={{ fontSize:13, color:"#6b7280", marginBottom:14 }}>{matrizErro}</div>
          <button onClick={() => location.reload()} style={btnPrimario}>Tentar novamente</button>
          <button onClick={onLogout} style={btnSecundario}>Sair</button>
        </div>
      </div>
    );
  }
  if (!matriz) {
    return (
      <div style={tela}>
        <div style={{ fontSize:13, color:"#9ca3af" }}>Carregando…</div>
      </div>
    );
  }

  // Pode "concluir" quando tudo respondido e:
  //   - aceitou o calculado, OU
  //   - digitou valor de calibragem válido (e confirmou caso seja absurdo)
  const podeConcluir = todasRespondidas && (
    aceitouCalculado === true ||
    (aceitouCalculado === false && analiseCalibragem && !analiseCalibragem.invalido && (
      // Se for absurdo, só pode concluir se já confirmou
      (!analiseCalibragem.muitoBaixo && !analiseCalibragem.muitoAlto) || confirmandoAbsurdo
    ))
  );

  async function handleConcluir() {
    if (!podeConcluir) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      const valor_calibrado = aceitouCalculado === false && analiseCalibragem && !analiseCalibragem.invalido
        ? analiseCalibragem.valor
        : null;
      await api.onboarding.concluir({
        profissao,
        porte,
        experiencia,
        referencia,
        padrao_projetos: padrao,
        capital,
        estado,
        valor_calibrado,
      });
      // Sucesso → mostra tela de transição. onConcluido() é chamado quando
      // usuário clicar "Continuar para o cadastro" (ver TelaTransicao abaixo).
      setConcluido(true);
    } catch (e) {
      setErroSalvar(e.message || "Falha ao salvar perfil");
    } finally {
      setSalvando(false);
    }
  }

  // Após salvar com sucesso, mostra tela de transição amigável que prepara
  // o usuário pra próxima etapa (cadastro do escritório). Não usa o mesmo
  // layout do questionário porque é momento de "respirar" e celebrar a
  // conclusão antes de seguir.
  if (concluido) {
    return (
      <TelaTransicao
        usuarioNome={usuario?.nome}
        onContinuar={() => onConcluido(estado)}
      />
    );
  }

  return (
    <div ref={containerRef} style={tela}>
      <div style={{ width:"100%", maxWidth:560, padding:"40px 20px 80px" }}>

        {/* ── Cabeçalho ── */}
        <div style={{ marginBottom:32 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>VICKE</div>
          <div style={{ fontSize:24, fontWeight:300, color:"#111", letterSpacing:-0.5, marginBottom:6 }}>
            Bem-vindo, {(usuario?.nome || "").split(" ")[0]}!
          </div>
          <div style={{ fontSize:14, color:"#6b7280", lineHeight:1.5 }}>
            Configure seu perfil profissional para personalizar seus orçamentos. Vai levar 2 minutos.
          </div>
        </div>

        {/* ── 1. Profissão ── */}
        <PerguntaBlock pergunta="Qual é a sua profissão?">
          <Opcao
            label={matriz.profissao.arquiteto.label}
            selecionada={profissao === "arquiteto"}
            onClick={() => setProfissao("arquiteto")}
          />
          <Opcao
            label={matriz.profissao.engenheiro.label}
            selecionada={profissao === "engenheiro"}
            onClick={() => setProfissao("engenheiro")}
          />
        </PerguntaBlock>

        {/* ── 2. Porte ── */}
        {profissao && (
          <PerguntaBlock pergunta="Quantas pessoas trabalham no seu escritório?">
            {ORDEM_PORTE.map(k => (
              <Opcao key={k}
                label={matriz.porte[k].label}
                selecionada={porte === k}
                onClick={() => setPorte(k)}
              />
            ))}
          </PerguntaBlock>
        )}

        {/* ── 3. Experiência ── */}
        {porte && (
          <PerguntaBlock pergunta="Quantos anos de experiência tem o(a) profissional responsável?">
            {ORDEM_EXPERIENCIA.map(k => (
              <Opcao key={k}
                label={matriz.experiencia[k].label}
                selecionada={experiencia === k}
                onClick={() => setExperiencia(k)}
              />
            ))}
          </PerguntaBlock>
        )}

        {/* ── 4. Momento atual da carreira ── */}
        {experiencia && (
          <PerguntaBlock
            pergunta="Em que momento da sua carreira você está?"
            sub="Pense no estágio atual, não no que pretende alcançar — você poderá refazer essa calibragem quando seu momento mudar."
          >
            {ORDEM_REFERENCIA
              .filter(k => matriz.referencia?.[k])  // resilência: ignora itens que sumiram da matriz (em vez de quebrar a tela)
              .map(k => (
                <Opcao key={k}
                  label={matriz.referencia[k].label}
                  selecionada={referencia === k}
                  onClick={() => setReferencia(k)}
                />
              ))}
          </PerguntaBlock>
        )}

        {/* ── 5. Padrão de projetos ── */}
        {referencia && (
          <PerguntaBlock pergunta="Qual o padrão da maioria dos seus projetos?">
            {ORDEM_PADRAO.map(k => (
              <Opcao key={k}
                label={matriz.padrao_projetos[k].label}
                selecionada={padrao === k}
                onClick={() => setPadrao(k)}
              />
            ))}
          </PerguntaBlock>
        )}

        {/* ── 6. Capital ── */}
        {padrao && (
          <PerguntaBlock pergunta="Seu escritório está localizado em uma capital?">
            <Opcao
              label={matriz.capital.true.label}
              selecionada={capital === true}
              onClick={() => setCapital(true)}
            />
            <Opcao
              label={matriz.capital.false.label}
              selecionada={capital === false}
              onClick={() => setCapital(false)}
            />
          </PerguntaBlock>
        )}

        {/* ── 7. Estado ── */}
        {capital !== null && (
          <PerguntaBlock
            pergunta="Em qual estado fica o escritório?"
            sub="Usamos o CUB do seu estado pra calcular o preço base dos projetos."
          >
            {ESTADOS_DISPONIVEIS.map(e => (
              <Opcao key={e.sigla}
                label={e.nome}
                selecionada={estado === e.sigla}
                onClick={() => setEstado(e.sigla)}
              />
            ))}
          </PerguntaBlock>
        )}

        {/* ── Resultado + calibragem ── */}
        {todasRespondidas && (
          <BlocoResultado
            pctMatriz={pctMatriz}
            cubEstado={cubEstado}
            cubErro={cubErro}
            casaCalc={casaCalc}
            honorarioCalculado={honorarioCalculado}
            aceitouCalculado={aceitouCalculado}
            setAceitouCalculado={setAceitouCalculado}
            valorCalibragem={valorCalibragem}
            setValorCalibragem={(v) => { setValorCalibragem(v); setConfirmandoAbsurdo(false); }}
            analiseCalibragem={analiseCalibragem}
            confirmandoAbsurdo={confirmandoAbsurdo}
            setConfirmandoAbsurdo={setConfirmandoAbsurdo}
          />
        )}

        {/* ── Botão concluir ── */}
        {todasRespondidas && aceitouCalculado !== null && (
          <div style={{ marginTop:32, paddingTop:24, borderTop:"1px solid #f3f4f6" }}>
            {erroSalvar && (
              <div style={{ fontSize:12.5, color:"#991b1b", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"8px 12px", marginBottom:14 }}>
                {erroSalvar}
              </div>
            )}
            <button
              onClick={handleConcluir}
              disabled={!podeConcluir || salvando}
              style={{
                ...btnPrimario,
                width:"100%",
                opacity: (!podeConcluir || salvando) ? 0.5 : 1,
                cursor: (!podeConcluir || salvando) ? "not-allowed" : "pointer",
              }}>
              {salvando ? "Salvando..." : "Salvar e começar a usar o VICKE"}
            </button>
            <button
              onClick={onLogout}
              disabled={salvando}
              style={{ ...btnSecundario, width:"100%", marginTop:8 }}>
              Sair sem concluir
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────

// Bloco de uma pergunta + suas opções. Fade-in suave ao montar.
function PerguntaBlock({ pergunta, sub, children }) {
  return (
    <div style={{
      marginTop:28,
      animation:"vk-onb-fade-in 0.35s ease-out",
    }}>
      <style>{`
        @keyframes vk-onb-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{ fontSize:15, fontWeight:500, color:"#111", marginBottom: sub ? 4 : 12, lineHeight:1.4 }}>
        {pergunta}
      </div>
      {sub && (
        <div style={{ fontSize:12.5, color:"#9ca3af", marginBottom:12, lineHeight:1.5 }}>
          {sub}
        </div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {children}
      </div>
    </div>
  );
}

// Botão de opção. Quando selecionada, fica destacada com borda preta + check.
function Opcao({ label, selecionada, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display:"flex", alignItems:"center", gap:10,
        padding:"12px 14px",
        background: selecionada ? "#fafbfc" : "#fff",
        border: selecionada ? "1.5px solid #111" : "1px solid #e5e7eb",
        borderRadius:8,
        cursor:"pointer",
        textAlign:"left",
        fontFamily:"inherit",
        fontSize:13.5,
        color:"#111",
        fontWeight: selecionada ? 600 : 400,
        transition:"all 0.12s",
      }}
      onMouseEnter={e => { if (!selecionada) e.currentTarget.style.borderColor="#9ca3af"; }}
      onMouseLeave={e => { if (!selecionada) e.currentTarget.style.borderColor="#e5e7eb"; }}>
      <span style={{
        flexShrink:0,
        width:18, height:18, borderRadius:"50%",
        border: selecionada ? "5px solid #111" : "1.5px solid #d1d5db",
        background:"#fff",
        transition:"all 0.12s",
      }} />
      <span style={{ flex:1 }}>{label}</span>
    </button>
  );
}

// Bloco final: resumo + calibragem.
function BlocoResultado({
  pctMatriz, cubEstado, cubErro, casaCalc, honorarioCalculado,
  aceitouCalculado, setAceitouCalculado,
  valorCalibragem, setValorCalibragem, analiseCalibragem,
  confirmandoAbsurdo, setConfirmandoAbsurdo,
}) {
  if (cubErro) {
    return (
      <div style={{ marginTop:32, padding:"16px 18px", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8 }}>
        <div style={{ fontSize:13, color:"#991b1b", fontWeight:600, marginBottom:4 }}>CUB indisponível</div>
        <div style={{ fontSize:12.5, color:"#7f1d1d" }}>{cubErro}</div>
      </div>
    );
  }
  if (!cubEstado || honorarioCalculado === null || !casaCalc) {
    return (
      <div style={{ marginTop:32, fontSize:13, color:"#9ca3af" }}>
        Calculando…
      </div>
    );
  }

  const pctPct     = (pctMatriz * 100).toFixed(2).replace(".", ",");
  const precoBase  = pctMatriz * cubEstado.valor_m2;

  // Estilos compartilhados
  const linhaCalc = {
    display:"flex", justifyContent:"space-between", alignItems:"baseline",
    padding:"7px 0", fontSize:13, fontVariantNumeric:"tabular-nums",
  };
  const linhaCalcLabel = { color:"#6b7280" };
  const linhaCalcValor = { color:"#111", fontWeight:500 };
  const sep = { borderTop:"1px dashed #e5e7eb", margin:"4px 0" };

  return (
    <div style={{
      marginTop:36,
      paddingTop:28,
      borderTop:"1px solid #f3f4f6",
      animation:"vk-onb-fade-in 0.35s ease-out",
    }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:14 }}>
        Resultado
      </div>

      <div style={{ fontSize:15, fontWeight:500, color:"#111", marginBottom:6, lineHeight:1.4 }}>
        Pelo seu perfil, você cobraria <strong>{moeda(honorarioCalculado)}</strong> por uma casa típica de {casaCalc.areaTotal.toLocaleString("pt-BR")}m².
      </div>
      <div style={{ fontSize:12.5, color:"#9ca3af", marginBottom:18, lineHeight:1.55 }}>
        3 suítes · sala estar/jantar · cozinha · lavabo · lavanderia · 2 vagas · padrão médio
      </div>

      {/* Breakdown decomposto: preço base → fator complexidade → preço/m² → área → faixas → total */}
      <div style={{ background:"#fafbfc", border:"1px solid #f3f4f6", borderRadius:8, padding:"14px 16px", marginBottom:20 }}>
        <div style={linhaCalc}>
          <span style={linhaCalcLabel}>Preço base ({pctPct}% × CUB R-1 Normal {cubEstado.estado})</span>
          <span style={linhaCalcValor}>{moeda(precoBase)}/m²</span>
        </div>
        <div style={linhaCalc}>
          <span style={linhaCalcLabel}>× Índice de complexidade</span>
          <span style={linhaCalcValor}>{casaCalc.fatorMult.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:3 })}</span>
        </div>
        <div style={{ ...linhaCalc, borderTop:"1px solid #e5e7eb", marginTop:4, paddingTop:9 }}>
          <span style={{ ...linhaCalcLabel, color:"#111", fontWeight:500 }}>= Preço por m² (cheio)</span>
          <span style={{ ...linhaCalcValor, fontWeight:600 }}>{moeda(casaCalc.precoM2)}/m²</span>
        </div>

        <div style={sep} />

        {/* Faixas de desconto progressivo. Casa de 224m² geralmente tem 2 faixas:
            0-200 sem desconto + 200-224 com 30% off (ou só 1 faixa se for ≤200). */}
        {casaCalc.faixas.map((f, i) => (
          <div key={i} style={linhaCalc}>
            <span style={linhaCalcLabel}>
              {f.m2.toLocaleString("pt-BR")}m² × {moeda(f.precoM2Efetivo)}/m²
              {f.desconto > 0 && (
                <span style={{ color:"#9ca3af", fontSize:11.5, marginLeft:6 }}>
                  (excedente: −{(f.desconto * 100).toFixed(0)}%)
                </span>
              )}
            </span>
            <span style={linhaCalcValor}>{moeda(f.subtotal)}</span>
          </div>
        ))}

        <div style={{ ...linhaCalc, borderTop:"1px solid #e5e7eb", marginTop:6, paddingTop:9, fontSize:14 }}>
          <span style={{ color:"#111", fontWeight:600 }}>Honorário total</span>
          <span style={{ color:"#111", fontWeight:700 }}>{moeda(honorarioCalculado)}</span>
        </div>
      </div>

      <div style={{ fontSize:12, color:"#9ca3af", lineHeight:1.55, marginBottom:18 }}>
        Esse é apenas um exemplo — projetos maiores têm desconto progressivo,
        e mais cômodos ou padrão alto aumentam o índice de complexidade.
      </div>

      <div style={{ fontSize:14, color:"#111", marginBottom:12 }}>
        Esse valor está alinhado com o que você cobraria?
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        <Opcao
          label="Sim, esse valor está bom"
          selecionada={aceitouCalculado === true}
          onClick={() => { setAceitouCalculado(true); setValorCalibragem(""); setConfirmandoAbsurdo(false); }}
        />
        <Opcao
          label="Quero ajustar — eu cobraria valor diferente"
          selecionada={aceitouCalculado === false}
          onClick={() => setAceitouCalculado(false)}
        />
      </div>

      {/* Campo de calibragem */}
      {aceitouCalculado === false && (
        <div style={{
          marginTop:18,
          paddingTop:16,
          borderTop:"1px dashed #e5e7eb",
          animation:"vk-onb-fade-in 0.3s ease-out",
        }}>
          <div style={{ fontSize:13, color:"#111", marginBottom:8 }}>
            Quanto você cobraria pela casa de {casaCalc.areaTotal.toLocaleString("pt-BR")}m² descrita acima?
          </div>
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:13, color:"#9ca3af", pointerEvents:"none" }}>R$</span>
            <input
              type="text"
              inputMode="decimal"
              value={valorCalibragem}
              onChange={e => setValorCalibragem(e.target.value)}
              placeholder="20.000,00"
              autoFocus
              style={{
                width:"100%", boxSizing:"border-box",
                border:"1px solid #e5e7eb", borderRadius:8,
                padding:"11px 14px 11px 38px",
                fontSize:14, fontFamily:"inherit", outline:"none",
                fontVariantNumeric:"tabular-nums",
              }}
            />
          </div>

          {/* Análise de absurdo */}
          {analiseCalibragem && !analiseCalibragem.invalido && (analiseCalibragem.muitoBaixo || analiseCalibragem.muitoAlto) && (
            <div style={{
              marginTop:14,
              padding:"12px 14px",
              background: analiseCalibragem.muitoAlto ? "#fffbeb" : "#fef2f2",
              border: analiseCalibragem.muitoAlto ? "1px solid #fde68a" : "1px solid #fecaca",
              borderRadius:8,
            }}>
              <div style={{ fontSize:12.5, fontWeight:600, color: analiseCalibragem.muitoAlto ? "#92400e" : "#991b1b", marginBottom:6 }}>
                {analiseCalibragem.muitoAlto ? "Valor parece muito alto" : "Valor parece muito baixo"}
              </div>
              <div style={{ fontSize:12, color:"#6b7280", lineHeight:1.5, marginBottom:10 }}>
                {moeda(analiseCalibragem.valor)} é {analiseCalibragem.ratio.toFixed(1)}× {analiseCalibragem.muitoAlto ? "maior" : "menor"} que o calculado pelo seu perfil ({moeda(honorarioCalculado)}).
                Equivale a {(analiseCalibragem.pctCalibrado * 100).toFixed(2).replace(".", ",")}% do CUB.
              </div>
              <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:12.5, color:"#111", cursor:"pointer" }}>
                <input
                  type="checkbox"
                  checked={confirmandoAbsurdo}
                  onChange={e => setConfirmandoAbsurdo(e.target.checked)}
                  style={{ cursor:"pointer" }}
                />
                Confirmo que quero usar esse valor mesmo assim
              </label>
            </div>
          )}

          {/* Análise normal (sem aviso) */}
          {analiseCalibragem && !analiseCalibragem.invalido && !analiseCalibragem.muitoBaixo && !analiseCalibragem.muitoAlto && (
            <div style={{ marginTop:12, fontSize:12, color:"#6b7280", lineHeight:1.5 }}>
              {moeda(analiseCalibragem.valor)} equivale a <strong style={{ color:"#111" }}>{(analiseCalibragem.pctCalibrado * 100).toFixed(2).replace(".", ",")}% do CUB</strong>. Esse será o seu novo preço base.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Tela exibida após onboarding concluído com sucesso. Prepara o usuário
// pra próxima etapa (cadastro do escritório) explicando POR QUE essas
// informações são necessárias — caso contrário cadastro parece
// "burocrático demais" e usuário pode pular pela aba.
function TelaTransicao({ usuarioNome, onContinuar }) {
  const primeiroNome = (usuarioNome || "").split(" ")[0] || "";
  return (
    <div style={tela}>
      <div style={{ width:"100%", maxWidth:520, padding:"60px 24px", textAlign:"center" }}>
        {/* Ícone de sucesso (check em círculo preto) */}
        <div style={{
          width:56, height:56, borderRadius:"50%",
          background:"#111", color:"#fff",
          display:"flex", alignItems:"center", justifyContent:"center",
          margin:"0 auto 24px",
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>

        <div style={{ fontSize:22, fontWeight:300, color:"#111", letterSpacing:-0.4, marginBottom:10 }}>
          Tudo certo, {primeiroNome}!
        </div>
        <div style={{ fontSize:14, color:"#6b7280", lineHeight:1.55, marginBottom:36 }}>
          Seu perfil de pricing está configurado. Agora vamos completar o cadastro do seu escritório.
        </div>

        <div style={{
          background:"#fafbfc",
          border:"1px solid #f3f4f6",
          borderRadius:10,
          padding:"20px 22px",
          textAlign:"left",
          marginBottom:32,
        }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>
            Por que isso importa
          </div>
          <div style={{ fontSize:13, color:"#111", lineHeight:1.7 }}>
            Os dados do escritório (logo, endereço, contatos) aparecem nos seus orçamentos, propostas e PDFs enviados aos clientes. É a sua identidade visual no sistema.
          </div>
        </div>

        <button
          onClick={onContinuar}
          style={{
            ...btnPrimario,
            width:"100%", maxWidth:320,
            padding:"13px 20px", fontSize:14,
          }}>
          Continuar para o cadastro →
        </button>
      </div>
    </div>
  );
}

// ── Estilos compartilhados ─────────────────────────────────────
const tela = {
  position:"fixed", inset:0,
  background:"#fafafa",
  fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",
  overflowY:"auto",
  display:"flex", justifyContent:"center", alignItems:"flex-start",
};
const card = {
  background:"#fff", border:"1px solid #e5e7eb", borderRadius:12,
  padding:"32px 32px 24px", maxWidth:420, width:"100%",
  boxShadow:"0 8px 32px rgba(0,0,0,0.06)",
  margin:"40px 20px",
};
const btnPrimario = {
  background:"#111", color:"#fff", border:"none", borderRadius:8,
  padding:"11px 16px", fontSize:13.5, fontWeight:600, cursor:"pointer",
  fontFamily:"inherit",
};
const btnSecundario = {
  background:"transparent", color:"#6b7280", border:"none",
  padding:"8px", fontSize:12, cursor:"pointer", fontFamily:"inherit",
};
const tdLabel = { color:"#6b7280", padding:"4px 0" };
const tdValor = { textAlign:"right", padding:"4px 0", color:"#111" };

// ── Helpers ────────────────────────────────────────────────────
function moeda(v) {
  if (typeof v !== "number" || !isFinite(v)) return "R$ —";
  return v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
}
