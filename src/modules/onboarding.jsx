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

// Calcula honorário da casa exemplo dado o precoBase (R$/m²) e o padrão.
// Reproduz a fórmula do orcamento-teste.jsx: indiceComodos somado, fator
// multiplicador, faixas de desconto progressivas. INDICE_PADRAO: baixo=-0.1,
// medio=0, alto=+0.1 (mesmos valores do shared.jsx).
function calcularCasaExemplo(precoBase, padrao = "medio") {
  const INDICE_PADRAO = { baixo: -0.1, medio: 0, alto: 0.1 };
  const indicePadrao = INDICE_PADRAO[padrao] ?? 0;

  let indiceComodos = 0;
  let areaBruta = 0;
  for (const c of CASA_EXEMPLO.comodos) {
    indiceComodos += c.indice * c.qtd;
    areaBruta     += c.area   * c.qtd;
  }
  indiceComodos = Math.round(indiceComodos * 1000) / 1000;
  const areaTotal = Math.round(areaBruta * (1 + CASA_EXEMPLO.acrescimoCirk) * 100) / 100;
  const fatorMult = Math.round((1 + indiceComodos + indicePadrao) * 1000) / 1000;
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
    indicePadrao,
    fatorMult,
    padrao,
    precoBase:     Math.round(precoBase * 100) / 100,
    precoM2:       Math.round(precoM2Ef * 100) / 100,
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
    // Carrega os 3 níveis de CUB R-1 (Baixo/Normal/Alto) do estado escolhido.
    // O padrão escolhido pelo usuário define qual será usado na simulação:
    // Baixo→Baixo, Médio→Normal, Alto→Alto. Carrega tudo de uma vez pra que
    // a UI possa alternar entre padrões sem fazer fetch novo.
    Promise.all([
      api.cub.atual(estado, "R-1", "Baixo"),
      api.cub.atual(estado, "R-1", "Normal"),
      api.cub.atual(estado, "R-1", "Alto"),
    ])
      .then(([baixo, normal, alto]) => {
        setCubEstado({ estado, baixo, normal, alto });
      })
      .catch(e => setCubErro(e.message || "Falha ao carregar referência de mercado"));
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

  // Cálculo completo da casa exemplo com o PADRÃO escolhido pelo usuário.
  // CUB usado depende do padrão: Baixo→R-1 Baixo, Médio→Normal, Alto→Alto
  // (refletindo realidade do mercado: alto padrão tem custo unitário maior).
  // Quando o padrão muda, simulação atualiza instantaneamente sem refetch
  // porque cubEstado já tem os 3 níveis carregados.
  const cubAtualPorPadrao = useMemo(() => {
    if (!cubEstado) return null;
    return { baixo: cubEstado.baixo, medio: cubEstado.normal, alto: cubEstado.alto }[padrao || "medio"];
  }, [cubEstado, padrao]);

  const casaCalc = useMemo(() => {
    if (pctMatriz === null || !cubAtualPorPadrao) return null;
    const precoBase = pctMatriz * cubAtualPorPadrao.valor_m2;
    return calcularCasaExemplo(precoBase, padrao || "medio");
  }, [pctMatriz, cubAtualPorPadrao, padrao]);
  const honorarioCalculado = casaCalc?.honorario ?? null;

  // Análise da calibragem: valor digitado vs calculado. Como a fórmula nova
  // tem faixas de desconto não-lineares, o pct_calibrado reverso é encontrado
  // por bisseção (igual ao backend faz). Usa o mesmo padrão+CUB da simulação.
  const analiseCalibragem = useMemo(() => {
    if (aceitouCalculado !== false || !valorCalibragem || !honorarioCalculado || !cubAtualPorPadrao) return null;
    const v = parseFloat(String(valorCalibragem).replace(/[^\d,.-]/g, "").replace(",", "."));
    if (!v || v <= 0) return { invalido: true };

    let lo = 0.001, hi = 0.20;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      const honor = calcularCasaExemplo(mid * cubAtualPorPadrao.valor_m2, padrao || "medio").honorario;
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
  }, [valorCalibragem, honorarioCalculado, aceitouCalculado, cubAtualPorPadrao, padrao]);

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

        {/* ── Cabeçalho — só aparece enquanto questionário ativo ── */}
        {!todasRespondidas && (
          <div style={{ marginBottom:32 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>VICKE</div>
            <div style={{ fontSize:24, fontWeight:300, color:"#111", letterSpacing:-0.5, marginBottom:6 }}>
              Bem-vindo, {(usuario?.nome || "").split(" ")[0]}!
            </div>
            <div style={{ fontSize:14, color:"#6b7280", lineHeight:1.5 }}>
              Configure seu perfil profissional para personalizar seus orçamentos. Vai levar 2 minutos.
            </div>
          </div>
        )}

        {/* ── Questionário (1-7) — escondido quando o resultado aparece ── */}
        {!todasRespondidas && (<>

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
            sub="Usamos os dados do seu estado pra calcular o preço base dos projetos."
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

        </>)}{/* ── fim do questionário condicional ── */}

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
            // Respostas atuais (pra resumo lateral) e setters (pra editar)
            respostas={{ profissao, porte, experiencia, referencia, padrao, capital, estado }}
            setters={{ setProfissao, setPorte, setExperiencia, setReferencia, setPadrao, setCapital, setEstado }}
            matriz={matriz}
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

// ════════════════════════════════════════════════════════════════
// Bloco final: análise digitando + tabela + waterfall + resumo lateral
// ════════════════════════════════════════════════════════════════
function BlocoResultado({
  pctMatriz, cubEstado, cubErro, casaCalc, honorarioCalculado,
  aceitouCalculado, setAceitouCalculado,
  valorCalibragem, setValorCalibragem, analiseCalibragem,
  confirmandoAbsurdo, setConfirmandoAbsurdo,
  respostas, setters, matriz,
}) {
  if (cubErro) {
    return (
      <div style={{ marginTop:32, padding:"16px 18px", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8 }}>
        <div style={{ fontSize:13, color:"#991b1b", fontWeight:600, marginBottom:4 }}>Referência indisponível</div>
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

  return (
    <div style={{
      animation:"vk-onb-fade-in 0.4s ease-out",
    }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:18 }}>
        Resultado da análise
      </div>

      {/* Layout: resumo lateral fininho + texto/tabela à direita */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"minmax(0, 150px) minmax(0, 1fr)",
        gap:20,
        marginBottom:18,
      }} className="vk-onb-grid">
        <ResumoLateral respostas={respostas} setters={setters} matriz={matriz} />
        <AnaliseTexto casaCalc={casaCalc} />
      </div>

      {/* Gráfico waterfall full-width (passa por baixo do resumo lateral) */}
      <Waterfall casaCalc={casaCalc} honorarioCalculado={honorarioCalculado} />

      {/* CSS — animações + responsivo + cursor digitando */}
      <style>{`
        @media (max-width: 720px) {
          .vk-onb-grid { grid-template-columns: 1fr !important; }
        }
        @keyframes vk-bar-grow {
          from { transform: scaleY(0); }
          to   { transform: scaleY(1); }
        }
        @keyframes vk-fade-up {
          from { opacity:0; transform: translateY(6px); }
          to   { opacity:1; transform: translateY(0); }
        }
        @keyframes vk-cursor-blink {
          0%, 49%   { opacity:1; }
          50%, 100% { opacity:0; }
        }
      `}</style>

      <div style={{ fontSize:14, color:"#111", marginBottom:12, marginTop:24 }}>
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

      {aceitouCalculado === false && (
        <div style={{
          marginTop:18, paddingTop:16,
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

          {analiseCalibragem && !analiseCalibragem.invalido && (analiseCalibragem.muitoBaixo || analiseCalibragem.muitoAlto) && (
            <div style={{
              marginTop:14, padding:"12px 14px",
              background: analiseCalibragem.muitoAlto ? "#fffbeb" : "#fef2f2",
              border: analiseCalibragem.muitoAlto ? "1px solid #fde68a" : "1px solid #fecaca",
              borderRadius:8,
            }}>
              <div style={{ fontSize:12.5, fontWeight:600, color: analiseCalibragem.muitoAlto ? "#92400e" : "#991b1b", marginBottom:6 }}>
                {analiseCalibragem.muitoAlto ? "Valor parece muito alto" : "Valor parece muito baixo"}
              </div>
              <div style={{ fontSize:12, color:"#6b7280", lineHeight:1.5, marginBottom:10 }}>
                {moeda(analiseCalibragem.valor)} é {analiseCalibragem.ratio.toFixed(1)}× {analiseCalibragem.muitoAlto ? "maior" : "menor"} que o valor sugerido pela análise ({moeda(honorarioCalculado)}).
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

          {analiseCalibragem && !analiseCalibragem.invalido && !analiseCalibragem.muitoBaixo && !analiseCalibragem.muitoAlto && (
            <div style={{ marginTop:12, fontSize:12, color:"#6b7280", lineHeight:1.5 }}>
              {moeda(analiseCalibragem.valor)} será o seu novo preço de referência.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// ResumoLateral compacto — 7 respostas, fonte e padding reduzidos.
// Cada linha clicável → limpa essa resposta + posteriores (volta o
// questionário àquele ponto, já que !todasRespondidas oculta o resultado).
// ───────────────────────────────────────────────────────────────
function ResumoLateral({ respostas, setters, matriz }) {
  const labelOu = (cat, key, fallback) => {
    if (key === null || key === undefined) return fallback || "—";
    const k = typeof key === "boolean" ? String(key) : key;
    return matriz?.[cat]?.[k]?.label || fallback || String(key);
  };

  const linhas = [
    { campo: "profissao",   label: "Profissão",   valor: labelOu("profissao", respostas.profissao) },
    { campo: "porte",       label: "Porte",       valor: labelOu("porte", respostas.porte) },
    { campo: "experiencia", label: "Experiência", valor: labelOu("experiencia", respostas.experiencia) },
    { campo: "referencia",  label: "Momento",     valor: labelOu("referencia", respostas.referencia) },
    { campo: "padrao",      label: "Padrão",      valor: labelOu("padrao_projetos", respostas.padrao) },
    { campo: "capital",     label: "Localização", valor: labelOu("capital", respostas.capital) },
    { campo: "estado",      label: "Estado",      valor: respostas.estado || "—" },
  ];

  // Limpa a resposta clicada + todas posteriores (cascata).
  const handleEditar = (campo) => {
    const cascata = {
      profissao:   ["setProfissao","setPorte","setExperiencia","setReferencia","setPadrao","setCapital","setEstado"],
      porte:       ["setPorte","setExperiencia","setReferencia","setPadrao","setCapital","setEstado"],
      experiencia: ["setExperiencia","setReferencia","setPadrao","setCapital","setEstado"],
      referencia:  ["setReferencia","setPadrao","setCapital","setEstado"],
      padrao:      ["setPadrao","setCapital","setEstado"],
      capital:     ["setCapital","setEstado"],
      estado:      ["setEstado"],
    };
    (cascata[campo] || []).forEach(s => setters[s] && setters[s](null));
  };

  return (
    <div style={{
      background:"#fafbfc",
      border:"1px solid #f3f4f6",
      borderRadius:10,
      padding:"12px 12px",
      alignSelf:"start",
    }}>
      <div style={{ fontSize:10, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.7, marginBottom:8, padding:"0 4px" }}>
        Suas respostas
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
        {linhas.map((l) => (
          <div key={l.campo}
               onClick={() => handleEditar(l.campo)}
               style={{
                 padding:"5px 6px",
                 borderRadius:5,
                 cursor:"pointer",
                 transition:"background 0.12s",
               }}
               onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
               onMouseLeave={e => e.currentTarget.style.background = "transparent"}
               title="Clique pra refazer a partir desta">
            <div style={{ fontSize:9.5, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.4, fontWeight:600, marginBottom:1 }}>
              {l.label}
            </div>
            <div style={{ fontSize:11.5, color:"#111", lineHeight:1.3, fontWeight:500 }}>
              {l.valor}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// AnaliseTexto: texto curto digitando + tabela compacta da simulação.
// Texto e tabela ficam empilhados na coluna direita do resumo lateral.
// ───────────────────────────────────────────────────────────────
function AnaliseTexto({ casaCalc }) {
  // Texto enxuto — versão B condensada. Detalhes da fórmula vão pra tabela
  // e pro gráfico, não pro texto.
  const textoAnalise = useMemo(() => {
    return `Sua composição de perfil é compatível com escritórios que aplicam ${moeda(casaCalc.precoBase)} por m² como referência. A simulação abaixo mostra como esse valor se comporta numa casa típica:`;
  }, [casaCalc.precoBase]);

  const [chars, setChars] = useState(0);
  const [terminou, setTerminou] = useState(false);

  useEffect(() => {
    setChars(0);
    setTerminou(false);
  }, [textoAnalise]);

  useEffect(() => {
    if (chars >= textoAnalise.length) { setTerminou(true); return; }
    const t = setTimeout(() => setChars(c => c + 1), 22);
    return () => clearTimeout(t);
  }, [chars, textoAnalise]);

  const handleSkip = () => {
    if (!terminou) { setChars(textoAnalise.length); setTerminou(true); }
  };

  return (
    <div>
      {/* Texto digitando */}
      <div
        onClick={handleSkip}
        style={{
          fontSize:14, color:"#111", lineHeight:1.6,
          marginBottom:14,
          cursor: terminou ? "default" : "pointer",
          minHeight: 80,
        }}>
        {textoAnalise.slice(0, chars)}
        {!terminou && (
          <span style={{
            display:"inline-block",
            width:2, height:"1em",
            background:"#111",
            verticalAlign:"text-bottom",
            marginLeft:2,
            animation:"vk-cursor-blink 1s steps(2) infinite",
          }} />
        )}
      </div>

      {/* Tabela compacta da casa exemplo — só aparece depois do texto */}
      {terminou && <TabelaCasaExemplo casaCalc={casaCalc} />}
    </div>
  );
}

// Tabela compacta com a composição e métricas da casa simulada.
function TabelaCasaExemplo({ casaCalc }) {
  const labelPadrao = { baixo: "Baixo", medio: "Médio", alto: "Alto" };

  const linha = (label, valor, opts = {}) => (
    <div style={{
      display:"flex", justifyContent:"space-between", alignItems:"baseline",
      padding:"6px 0",
      fontSize:12.5,
      borderTop: opts.divisor ? "1px solid #e5e7eb" : "none",
      marginTop: opts.divisor ? 4 : 0,
      paddingTop: opts.divisor ? 8 : 6,
      fontVariantNumeric:"tabular-nums",
    }}>
      <span style={{ color: opts.destaque ? "#111" : "#6b7280", fontWeight: opts.destaque ? 600 : 400 }}>{label}</span>
      <span style={{ color:"#111", fontWeight: opts.destaque ? 700 : 500 }}>{valor}</span>
    </div>
  );

  return (
    <div style={{
      background:"#fafbfc",
      border:"1px solid #f3f4f6",
      borderRadius:10,
      padding:"12px 16px",
      animation:"vk-fade-up 0.4s ease-out",
    }}>
      <div style={{ fontSize:10, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.7, marginBottom:6 }}>
        Casa simulada
      </div>
      <div style={{ fontSize:12, color:"#374151", lineHeight:1.5, marginBottom:6 }}>
        3 suítes (1 master) · sala de estar · sala de jantar · cozinha · lavabo · lavanderia · 2 vagas garagem
      </div>

      {linha("Área útil",                  `${casaCalc.areaBruta.toLocaleString("pt-BR")} m²`)}
      {linha("+ 25% circ. + paredes",       `+${(casaCalc.areaTotal - casaCalc.areaBruta).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²`)}
      {linha("Área total",                  `${casaCalc.areaTotal.toLocaleString("pt-BR")} m²`, { divisor: true })}
      {linha("Padrão",                      labelPadrao[casaCalc.padrao] || casaCalc.padrao, { divisor: true })}
      {linha("Preço base",                  `${moeda(casaCalc.precoBase)} / m²`)}
      {linha("Preço por m² (com complexidade)", `${moeda(casaCalc.precoM2)} / m²`)}
      {linha("Honorário total",             moeda(casaCalc.honorario), { divisor: true, destaque: true })}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Waterfall: gráfico SVG full-width animado.
// Etapas: Preço base → +Complexidade → ±Padrão → -Desconto → Total
// Cores modernas: azul #3b82f6 (base/total), verde #22c55e (+), vermelho #ef4444 (−)
// ───────────────────────────────────────────────────────────────
function Waterfall({ casaCalc, honorarioCalculado }) {
  const { areaTotal, indiceComodos, indicePadrao, precoBase } = casaCalc;

  // Honorário em cada estágio (em R$ totais)
  const honorBaseSemFator    = precoBase * areaTotal;                                  // só preço base × área
  const honorComComplexidade = precoBase * (1 + indiceComodos) * areaTotal;            // + complexidade
  const honorComPadrao       = precoBase * (1 + indiceComodos + indicePadrao) * areaTotal; // + padrão (sem desconto)
  const totalDescontoFaixas  = honorComPadrao - honorarioCalculado;

  const parcelaComplexidade = honorComComplexidade - honorBaseSemFator;
  const parcelaPadrao       = honorComPadrao - honorComComplexidade;

  // Steps. Padrão e desconto só aparecem se forem relevantes.
  const steps = [
    { tipo:"base",  label:"Preço base",      sub:`${moeda(precoBase)}/m² × ${areaTotal.toLocaleString("pt-BR")}m²`,
      delta: honorBaseSemFator, acumulado: honorBaseSemFator },
    { tipo:"add",   label:"+ Complexidade",  sub:`${(indiceComodos*100).toFixed(0)}% por ambientes`,
      delta: parcelaComplexidade, acumulado: honorComComplexidade },
    ...(Math.abs(parcelaPadrao) > 1 ? [{
      tipo: parcelaPadrao >= 0 ? "add" : "sub",
      label: parcelaPadrao >= 0 ? "+ Padrão alto" : "− Padrão baixo",
      sub:   parcelaPadrao >= 0 ? "+10% sobre o subtotal" : "−10% sobre o subtotal",
      delta: parcelaPadrao, acumulado: honorComPadrao,
    }] : []),
    ...(totalDescontoFaixas > 1 ? [{
      tipo:"sub",
      label:"− Desconto progressivo",
      sub:`m² acima de 200`,
      delta: -totalDescontoFaixas, acumulado: honorarioCalculado,
    }] : []),
    { tipo:"total", label:"Honorário final", sub:`casa de ${areaTotal.toLocaleString("pt-BR")}m²`,
      delta: honorarioCalculado, acumulado: honorarioCalculado },
  ];

  // Dimensões — full-width, mais alto pra dar espaço aos labels
  const W = 720, H = 360;
  const padTop = 40, padBot = 80, padLeft = 20, padRight = 20;
  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBot;
  const barW = Math.min(80, innerW / steps.length - 20);
  const gap  = (innerW - barW * steps.length) / (steps.length - 1);

  // Escala vertical — usa o maior valor acumulado pra que mesmo o desconto caiba
  const maxValor = Math.max(honorComPadrao, honorarioCalculado, honorBaseSemFator);
  const yScale = (v) => innerH * (v / maxValor);
  const yBase = padTop + innerH;

  // Paleta moderna (apps tipo Linear, Vercel)
  const COR = {
    base:  "#3b82f6",  // azul moderno
    add:   "#22c55e",  // verde moderno
    sub:   "#ef4444",  // vermelho moderno
    total: "#3b82f6",
  };

  // Animação progressiva — 700ms crescimento + 900ms entre barras
  const [stepRevelado, setStepRevelado] = useState(0);
  useEffect(() => {
    setStepRevelado(0);
    let i = 0;
    const tick = () => {
      i++;
      setStepRevelado(i);
      if (i < steps.length) setTimeout(tick, 900);
    };
    setTimeout(tick, 300);
    // eslint-disable-next-line
  }, [casaCalc.honorario]);

  return (
    <div style={{
      background:"#fff",
      border:"1px solid #f3f4f6",
      borderRadius:10,
      padding:"20px 16px",
      animation:"vk-fade-up 0.4s ease-out",
    }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.7, marginBottom:8, padding:"0 4px" }}>
        Como chegamos no valor
      </div>
      <div style={{ width:"100%" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", display:"block" }}>
          {/* Linha de base sutil */}
          <line x1={padLeft} y1={yBase} x2={W - padRight} y2={yBase} stroke="#e5e7eb" strokeWidth="1" />

          {steps.map((s, i) => {
            const x = padLeft + i * (barW + gap);
            const baseY = (s.tipo === "total" || s.tipo === "base") ? yBase : (yBase - yScale(s.acumulado - s.delta));
            const altura = Math.abs(yScale(s.delta));
            const topY = s.tipo === "sub" ? baseY : baseY - altura;
            const cor = COR[s.tipo] || COR.base;
            const visivel = i < stepRevelado;
            const isTotal = s.tipo === "total";

            return (
              <g key={i} style={{
                opacity: visivel ? 1 : 0,
                transition: "opacity 0.35s",
              }}>
                {/* Barra com animação de crescimento (700ms) */}
                <rect
                  x={x}
                  y={topY}
                  width={barW}
                  height={altura}
                  fill={cor}
                  rx={3}
                  style={{
                    transformOrigin: `${x + barW/2}px ${baseY}px`,
                    animation: visivel ? `vk-bar-grow 0.7s cubic-bezier(0.34, 1.4, 0.64, 1)` : "none",
                  }}
                />

                {/* Linha pontilhada conectando topo da barra anterior à atual */}
                {i > 0 && i < steps.length - 1 && visivel && (
                  <line
                    x1={x - gap}
                    y1={isTotal ? yBase - yScale(s.acumulado) : (s.tipo === "sub" ? topY : baseY)}
                    x2={x}
                    y2={isTotal ? yBase - yScale(s.acumulado) : (s.tipo === "sub" ? topY : baseY)}
                    stroke="#9ca3af" strokeWidth="1" strokeDasharray="3,3"
                    style={{ animation: "vk-fade-up 0.4s ease-out 0.5s both" }}
                  />
                )}

                {/* Valor acima ou abaixo da barra (delay pra aparecer depois da barra crescer) */}
                <text
                  x={x + barW/2}
                  y={s.tipo === "sub" ? baseY + altura + 18 : topY - 10}
                  textAnchor="middle"
                  fontSize="13" fontWeight="700"
                  fill={cor}
                  fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
                  style={{ animation: visivel ? `vk-fade-up 0.4s ease-out 0.5s both` : "none", opacity: visivel ? undefined : 0 }}>
                  {s.tipo === "sub" ? "−" : ""}{moeda(Math.abs(s.delta))}
                </text>

                {/* Label da etapa (rótulo embaixo) */}
                <text
                  x={x + barW/2}
                  y={H - 44}
                  textAnchor="middle"
                  fontSize="11.5" fontWeight="600"
                  fill="#374151"
                  fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
                  style={{ animation: visivel ? `vk-fade-up 0.4s ease-out 0.55s both` : "none", opacity: visivel ? undefined : 0 }}>
                  {s.label}
                </text>
                <text
                  x={x + barW/2}
                  y={H - 26}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill="#9ca3af"
                  fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
                  style={{ animation: visivel ? `vk-fade-up 0.4s ease-out 0.6s both` : "none", opacity: visivel ? undefined : 0 }}>
                  {s.sub}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
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
