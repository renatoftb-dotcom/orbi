// ═══════════════════════════════════════════════════════════════
// BRIEFING DO CLIENTE
// ═══════════════════════════════════════════════════════════════
// O formulário que o cliente preenche depois que o projeto é ganho (etapa
// Briefing). Ele abre por um link (/briefing/{token}), sem login; responde
// aos poucos — cada resposta salva sozinha — e envia. O escritório lê o
// resumo, valida (o formulário trava) ou reabre para o cliente ajustar.
//
// Base: pesquisa "Briefing de arquitetura para clientes" (NBR 13532, RIBA
// estágios 0–1, AIA B101, Peña; 12 questionários de escritórios; GOV.UK,
// NN/g, Baymard). Regras que vieram de lá:
//   - o cliente informa o que quer; zoneamento, índices e recuos são
//     levantamento do arquiteto — não se pergunta;
//   - poucas obrigatórias, o essencial primeiro, opcionais no fim;
//   - prioridade por ambiente (essencial / desejável / dispensável) e as
//     3 mais importantes — é o que mais evita retrabalho;
//   - orçamento da obra e o que cortar se não couber;
//   - "não sei" e "envio depois" viram pendência no resumo, não bloqueio;
//   - dados de saúde só com consentimento destacado (LGPD art. 11);
//     crianças por faixa etária, sem nome (art. 14).
//
// Tipos de projeto: CN casa nova · RA reforma/ampliação · AP apartamento ou
// interiores · PC pequeno comercial.
// ═══════════════════════════════════════════════════════════════

const BR_TIPOS = [
  { v: "CN", t: "Casa nova", d: "construção do zero, em terreno" },
  { v: "RA", t: "Reforma ou ampliação de casa", d: "imóvel existente" },
  { v: "AP", t: "Apartamento ou interiores", d: "reforma, marcenaria, decoração" },
  { v: "PC", t: "Pequeno comercial", d: "loja, consultório, escritório, restaurante" },
];
const BR_NAO_SEI = { v: "nao_sei", t: "Não sei" };
const BR_PRIORIDADE = [
  { v: "essencial", t: "Essencial" },
  { v: "desejavel", t: "Desejável" },
  { v: "dispensavel", t: "Não precisa" },
];
const BR_DOC = [
  { v: "tenho", t: "Tenho" },
  { v: "depois", t: "Envio depois" },
  { v: "nao_tenho", t: "Não tenho" },
  { v: "nao_sei", t: "Não sei o que é" },
];

const BR_AMB_RES = [
  ["hall", "Hall de entrada"], ["sala_estar", "Sala de estar"], ["sala_jantar", "Sala de jantar"], ["sala_tv", "Sala de TV / íntima"],
  ["cozinha", "Cozinha"], ["despensa", "Despensa"], ["lavabo", "Lavabo"], ["lavanderia", "Lavanderia / área de serviço"],
  ["home_office", "Home office"], ["closet", "Closet"], ["quarto_hospedes", "Quarto de hóspedes"],
  ["dependencia", "Dependência de serviço"], ["deposito", "Depósito"], ["varanda", "Varanda / terraço"],
  ["gourmet", "Área gourmet / churrasqueira"], ["academia", "Academia"], ["home_theater", "Home theater"],
  ["brinquedoteca", "Brinquedoteca"], ["adega", "Adega"], ["espaco_pet", "Espaço pet"],
];
const BR_AMB_LOTE = [
  ["garagem", "Garagem"], ["piscina", "Piscina"], ["lavabo_lazer", "Lavabo da área de lazer"], ["sauna", "Sauna"], ["mezanino", "Mezanino"],
  ["jardim", "Jardim / horta"], ["edicula", "Edícula"], ["quintal", "Quintal"],
];
const BR_AMB_PC = [
  ["recepcao", "Recepção / espera"], ["vendas", "Área de vendas ou atendimento"], ["provador", "Provador"],
  ["salas_atend", "Salas de atendimento / consultórios"], ["estacoes", "Estações de trabalho"], ["reuniao", "Sala de reunião"],
  ["copa", "Copa / descompressão"], ["cozinha_prod", "Cozinha de produção"], ["estoque", "Estoque / DML"],
  ["sanit_publico", "Sanitários do público"], ["sanit_func", "Sanitários dos funcionários"], ["vestiario", "Vestiário"],
  ["area_tecnica", "Área técnica"],
];
function brAmbientesDoTipo(tipo) {
  if (tipo === "PC") return BR_AMB_PC;
  if (tipo === "CN" || tipo === "RA") return BR_AMB_RES.concat(BR_AMB_LOTE);
  return BR_AMB_RES;
}

const BR_ORCAMENTO = {
  CN: ["Até R$ 300 mil", "R$ 300 a 600 mil", "R$ 600 mil a 1 milhão", "R$ 1 a 2 milhões", "Acima de R$ 2 milhões"],
  RA: ["Até R$ 50 mil", "R$ 50 a 150 mil", "R$ 150 a 300 mil", "R$ 300 a 600 mil", "Acima de R$ 600 mil"],
  AP: ["Até R$ 50 mil", "R$ 50 a 150 mil", "R$ 150 a 300 mil", "R$ 300 a 600 mil", "Acima de R$ 600 mil"],
  PC: ["Até R$ 100 mil", "R$ 100 a 300 mil", "R$ 300 a 600 mil", "Acima de R$ 600 mil"],
};

// Fotos dos estilos: Unsplash (licença Unsplash — uso livre, sem atribuição obrigatória;
// créditos mantidos aqui por cortesia). Arquivos em public/briefing/, 640×420.
//   contemporaneo: Alef Morais — https://unsplash.com/photos/d2hYqpR0YS0
//   minimalista: Pixasquare — https://unsplash.com/photos/4ojhpgKpS68
//   tropical: Alef Morais — https://unsplash.com/photos/u2l_e5YS548
//   rustico: Hanna Lazar — https://unsplash.com/photos/jSvnwYvJ48c
//   industrial: ULISES RAMIREZ — https://unsplash.com/photos/tqCfLSHgaIo
//   classico: Nikita — https://unsplash.com/photos/7RQwfRBD_m4
//   escandinavo: Clay Banks — https://unsplash.com/photos/UTWRDWMMaag
//   natural: Spacejoy — https://unsplash.com/photos/mweDhudGmIc
//   mediterraneo: Frames For Your Heart — https://unsplash.com/photos/_KP6mk2Iz8k
const BR_ESTILOS = [
  { v: "contemporaneo", img: "/briefing/estilo-contemporaneo.jpg", t: "Contemporâneo", d: "linhas retas, grandes vãos, materiais atuais" },
  { v: "minimalista", img: "/briefing/estilo-minimalista.jpg", t: "Minimalista", d: "pouco elemento, cores neutras, tudo guardado" },
  { v: "tropical", img: "/briefing/estilo-tropical.jpg", t: "Moderno brasileiro", d: "madeira, cobogó, varandas, verde por perto" },
  { v: "rustico", img: "/briefing/estilo-rustico.jpg", t: "Rústico / campo", d: "madeira aparente, pedra, aconchego de fazenda" },
  { v: "industrial", img: "/briefing/estilo-industrial.jpg", t: "Industrial", d: "concreto, metal, tijolo, instalações à mostra" },
  { v: "classico", img: "/briefing/estilo-classico.jpg", t: "Clássico", d: "molduras, simetria, acabamentos nobres" },
  { v: "escandinavo", img: "/briefing/estilo-escandinavo.jpg", t: "Escandinavo", d: "claro, madeira clara, simples e acolhedor" },
  { v: "natural", img: "/briefing/estilo-natural.jpg", t: "Natural / boho", d: "fibras, texturas, plantas, tons terrosos" },
  { v: "mediterraneo", img: "/briefing/estilo-mediterraneo.jpg", t: "Mediterrâneo", d: "branco, arcos, cal, azul, luz forte" },
];

// Atalhos de visibilidade. t = { tipo, uso } — r = respostas.
const brRes = (t) => t.tipo !== "PC";
const brMora = (t) => brRes(t) && ["morar", "veraneio", "morar_trabalhar"].indexOf(t.uso) >= 0;
const brTemPrioridade = (r, amb) => {
  const p = ((r.programa || {})[amb]);
  return p === "essencial" || p === "desejavel";
};

// ── As seções ────────────────────────────────────────────────────
// Cada seção tem telas; cada tela, perguntas. `mostrar(t, r)` decide se a
// pergunta aparece. Tela sem pergunta visível é pulada.
// Tipos: unica · multipla · numero · texto · textolongo · mes · escala
// (itens × níveis) · lista (repetidor) · rank3 · links · consentimento.
const BRIEFING_SECOES = [
  { id: "projeto", titulo: "O projeto", telas: [
    { perguntas: [
      { id: "respondente", tipo: "texto", rotulo: "Quem está respondendo?", obrig: true, ajuda: "Seu nome", auto: "name" },
      { id: "relacao", tipo: "unica", rotulo: "Qual a sua relação com o projeto?", obrig: true,
        opcoes: [{ v: "proprietario", t: "Proprietário(a)" }, { v: "conjuge", t: "Cônjuge ou companheiro(a)" }, { v: "socio", t: "Sócio(a)" }, { v: "outro", t: "Outro" }] },
      { id: "tipo", tipo: "unica", rotulo: "Que tipo de projeto é este?", obrig: true, opcoes: BR_TIPOS, cartoes: true },
    ] },
    { perguntas: [
      { id: "escopo", tipo: "unica", rotulo: "Qual o escopo?", obrig: true, mostrar: (t) => t.tipo !== "CN",
        opcoesPor: (t) => t.tipo === "RA" ? [{ v: "reforma", t: "Reforma" }, { v: "ampliacao", t: "Ampliação" }, { v: "ambas", t: "Reforma e ampliação" }]
          : t.tipo === "AP" ? [{ v: "completa", t: "Reforma completa" }, { v: "interiores", t: "Só interiores e marcenaria" }, { v: "decoracao", t: "Decoração" }]
          : [{ v: "nova", t: "Obra nova" }, { v: "reforma", t: "Reforma do ponto" }, { v: "interiores", t: "Só interiores" }] },
      { id: "uso", tipo: "unica", rotulo: "Qual será o uso do imóvel?", obrig: true, mostrar: brRes,
        opcoes: [{ v: "morar", t: "Morar" }, { v: "veraneio", t: "Veraneio / fim de semana" }, { v: "morar_trabalhar", t: "Morar e trabalhar" }, { v: "alugar", t: "Alugar" }, { v: "vender", t: "Vender" }] },
      { id: "motivos", tipo: "multipla", rotulo: "Quais os principais motivos deste projeto?", obrig: true, outro: true,
        opcoes: [{ v: "espaco", t: "Mais espaço" }, { v: "familia", t: "A família está mudando" }, { v: "sonho", t: "A casa dos sonhos" }, { v: "modernizar", t: "Modernizar" },
          { v: "problemas", t: "Resolver problemas do imóvel" }, { v: "reduzir", t: "Reduzir" }, { v: "investimento", t: "Investimento" }, { v: "negocio", t: "Abrir ou expandir o negócio" }] },
      { id: "sucesso", tipo: "texto", rotulo: "Daqui a dois anos, o que faria você dizer \"o projeto deu certo\"?" },
      { id: "permanencia", tipo: "unica", rotulo: "Por quanto tempo pretende ficar no imóvel?", mostrar: brRes,
        opcoes: [{ v: "ate3", t: "Até 3 anos" }, { v: "3a10", t: "3 a 10 anos" }, { v: "mais10", t: "Mais de 10 anos" }, BR_NAO_SEI] },
    ] },
  ] },

  { id: "pessoas", titulo: "Quem vai usar", mostrar: brRes, telas: [
    { perguntas: [
      { id: "moradores_qtd", tipo: "numero", rotulo: "Quantas pessoas vão morar no imóvel?", obrig: true, mostrar: brMora, min: 1, max: 20 },
      { id: "moradores", tipo: "lista", rotulo: "Conte um pouco de cada morador", mostrar: brMora,
        ajuda: "Só um apelido ou o papel (ex.: \"filha mais velha\") — não precisa do nome.",
        qtdDe: "moradores_qtd", campos: [
          { id: "apelido", tipo: "texto", rotulo: "Como chamamos" },
          { id: "faixa", tipo: "unica", rotulo: "Faixa etária", obrig: true, opcoes: ["0–5", "6–12", "13–17", "18–29", "30–59", "60+"].map((x) => ({ v: x, t: x })) },
          { id: "em_casa", tipo: "unica", rotulo: "Trabalha ou estuda em casa?", opcoes: [{ v: "sim", t: "Sim" }, { v: "as_vezes", t: "Às vezes" }, { v: "nao", t: "Não" }] },
        ] },
      { id: "perfil_comprador", tipo: "texto", rotulo: "Que perfil de inquilino ou comprador você imagina?", mostrar: (t) => brRes(t) && !brMora(t) },
    ] },
    { perguntas: [
      { id: "familia_aumentar", tipo: "unica", rotulo: "Pretendem aumentar a família nos próximos anos?", mostrar: brMora,
        opcoes: [{ v: "sim", t: "Sim" }, { v: "talvez", t: "Talvez" }, { v: "nao", t: "Não" }, { v: "nr", t: "Prefiro não responder" }] },
      { id: "funcionario", tipo: "unica", rotulo: "Há funcionário(a) doméstico(a)?", mostrar: brMora,
        opcoes: [{ v: "nao", t: "Não" }, { v: "diarista", t: "Diarista" }, { v: "mensalista", t: "Mensalista, sem pernoite" }, { v: "dorme", t: "Dorme no imóvel" }] },
      { id: "pets", tipo: "unica", rotulo: "Vocês têm ou pretendem ter animais de estimação?", obrig: true, mostrar: brMora,
        opcoes: [{ v: "sim", t: "Sim" }, { v: "nao", t: "Não" }] },
      { id: "pets_lista", tipo: "lista", rotulo: "Os pets", mostrar: (t, r) => brMora(t) && r.pets === "sim", campos: [
        { id: "especie", tipo: "texto", rotulo: "Espécie" },
        { id: "porte", tipo: "unica", rotulo: "Porte", opcoes: [{ v: "P", t: "P" }, { v: "M", t: "M" }, { v: "G", t: "G" }] },
        { id: "onde", tipo: "unica", rotulo: "Onde fica", opcoes: [{ v: "dentro", t: "Dentro" }, { v: "fora", t: "Fora" }, { v: "ambos", t: "Os dois" }] },
      ] },
      { id: "hospedes", tipo: "unica", rotulo: "Recebem hóspedes que dormem na casa?", mostrar: brMora,
        opcoes: [{ v: "nunca", t: "Nunca" }, { v: "ocasional", t: "Ocasionalmente" }, { v: "frequente", t: "Com frequência" }] },
    ] },
  ] },

  { id: "negocio", titulo: "Negócio e equipe", mostrar: (t) => t.tipo === "PC", telas: [
    { perguntas: [
      { id: "ramo", tipo: "textolongo", rotulo: "Qual o ramo do negócio e o que vocês vendem ou que serviços oferecem?", obrig: true },
      { id: "func_hoje", tipo: "numero", rotulo: "Quantos funcionários trabalharão no local hoje?", obrig: true, min: 0 },
      { id: "func_3anos", tipo: "numero", rotulo: "E quantos esperam ter em 3 anos?", min: 0 },
      { id: "pico", tipo: "numero", rotulo: "Quantas pessoas são atendidas ao mesmo tempo no horário de pico?", obrig: true, min: 0 },
      { id: "marca", tipo: "unica", rotulo: "É franquia ou tem manual de marca a seguir?", opcoes: [{ v: "franquia", t: "Franquia" }, { v: "manual", t: "Tem manual de marca" }, { v: "nao", t: "Não" }] },
      { id: "horario", tipo: "texto", rotulo: "Dias e horário de funcionamento" },
    ] },
    { perguntas: [
      { id: "fluxo", tipo: "textolongo", rotulo: "Descreva o fluxo: da chegada do cliente até a saída, a entrada de mercadoria, o estoque e o descarte", obrig: true },
      { id: "equipamentos", tipo: "multipla", rotulo: "Equipamentos especiais", obrig: true, outro: true,
        opcoes: [{ v: "cozinha_ind", t: "Cozinha industrial" }, { v: "camara_fria", t: "Câmara fria" }, { v: "ti", t: "TI / servidor" }, { v: "saude", t: "Equipamentos de saúde ou estética" }, { v: "maquinario", t: "Maquinário" }, { v: "nenhum", t: "Nenhum" }] },
      { id: "carga", tipo: "unica", rotulo: "Há carga e descarga ou necessidade de estacionamento para clientes?", opcoes: [{ v: "sim", t: "Sim" }, { v: "nao", t: "Não" }, BR_NAO_SEI] },
      { id: "experiencia", tipo: "texto", rotulo: "Que experiência o cliente deve sentir no espaço?" },
    ] },
  ] },

  { id: "rotina", titulo: "Rotina", mostrar: brMora, telas: [
    { perguntas: [
      { id: "visitas_freq", tipo: "unica", rotulo: "Com que frequência recebem visitas?", obrig: true,
        opcoes: [{ v: "raro", t: "Raramente" }, { v: "mensal", t: "Uma vez por mês" }, { v: "semanal", t: "Toda semana" }] },
      { id: "visitas_qtd", tipo: "unica", rotulo: "Quantas pessoas costumam vir?", opcoes: ["Até 6", "7 a 15", "16 a 30", "Mais de 30"].map((x) => ({ v: x, t: x })) },
      { id: "receber_onde", tipo: "multipla", rotulo: "Onde preferem receber?",
        opcoes: [{ v: "sala", t: "Sala" }, { v: "cozinha", t: "Cozinha" }, { v: "gourmet", t: "Área gourmet" }, { v: "externa", t: "Área externa / piscina" }] },
      { id: "cozinham", tipo: "unica", rotulo: "Com que frequência cozinham em casa?", obrig: true,
        opcoes: [{ v: "raro", t: "Quase nunca" }, { v: "as_vezes", t: "Às vezes" }, { v: "diario", t: "Todo dia" }] },
      { id: "cozinham_juntos", tipo: "unica", rotulo: "Costuma haver mais de uma pessoa cozinhando junto?", opcoes: [{ v: "sim", t: "Sim" }, { v: "nao", t: "Não" }] },
    ] },
    { perguntas: [
      { id: "trabalho_casa", tipo: "numero", rotulo: "Quantas pessoas trabalham em casa?", min: 0 },
      { id: "videochamadas", tipo: "unica", rotulo: "Fazem videochamadas com frequência?", mostrar: (t, r) => Number(r.trabalho_casa) > 0, opcoes: [{ v: "sim", t: "Sim" }, { v: "nao", t: "Não" }] },
      { id: "hobbies", tipo: "multipla", rotulo: "Hobbies, esportes ou coleções que precisam de espaço ou de lugar para guardar", outro: true,
        opcoes: [{ v: "bike", t: "Bicicletas" }, { v: "pranchas", t: "Pranchas" }, { v: "instrumentos", t: "Instrumentos musicais" }, { v: "livros", t: "Livros" }, { v: "ferramentas", t: "Ferramentas" }, { v: "jardinagem", t: "Jardinagem" }, { v: "esporte", t: "Equipamento esportivo" }] },
      { id: "hoje_gosta", tipo: "texto", rotulo: "No imóvel onde vivem hoje, o que mais gostam?" },
      { id: "hoje_incomoda", tipo: "texto", rotulo: "E o que mais incomoda?" },
      { id: "dia_tipico", tipo: "textolongo", rotulo: "Descreva um dia típico da casa, do acordar ao dormir", ajuda: "Opcional, mas ajuda muito o projeto." },
    ] },
  ] },

  { id: "imovel", titulo: "Terreno ou imóvel", telas: [
    { perguntas: [
      { id: "endereco_obra", tipo: "texto", rotulo: "Endereço da obra", auto: "street-address" },
      // CN
      { id: "terreno_proprio", tipo: "unica", rotulo: "O terreno já é seu?", obrig: true, mostrar: (t) => t.tipo === "CN",
        opcoes: [{ v: "sim", t: "Sim" }, { v: "negociacao", t: "Em negociação" }, { v: "procurando", t: "Ainda procurando" }] },
      { id: "condominio", tipo: "unica", rotulo: "Fica em condomínio ou loteamento fechado com regras próprias de construção?", obrig: true, mostrar: (t) => t.tipo === "CN",
        opcoes: [{ v: "sim", t: "Sim" }, { v: "nao", t: "Não" }, BR_NAO_SEI] },
      { id: "pavimentos", tipo: "unica", rotulo: "Quantos pavimentos aceita?", obrig: true, mostrar: (t) => t.tipo === "CN",
        opcoes: [{ v: "terrea", t: "Só térrea" }, { v: "terrea_mezanino", t: "Térrea com mezanino" }, { v: "terrea_sobrado", t: "Térrea ou sobrado" }, { v: "tres", t: "Três ou mais" }, { v: "tanto_faz", t: "Sem preferência" }] },
      { id: "terreno_dimensoes", tipo: "texto", rotulo: "Medidas do terreno, se souber", mostrar: (t) => t.tipo === "CN", ajuda: "Ex.: 12 × 30 m. Se já tiver levantamento topográfico, pode pular." },
      { id: "terreno_esquina", tipo: "unica", rotulo: "O terreno é de esquina?", mostrar: (t) => t.tipo === "CN", opcoes: [{ v: "sim", t: "Sim" }, { v: "nao", t: "Não" }] },
      { id: "vistas", tipo: "texto", rotulo: "Há vistas a valorizar ou a esconder, ruídos, árvores que deseja manter?", mostrar: (t) => t.tipo === "CN" || t.tipo === "RA" },
      { id: "privacidade", tipo: "unica", rotulo: "A casa deve ser aberta para a rua ou mais reservada?", mostrar: (t) => t.tipo === "CN",
        opcoes: [{ v: "aberta", t: "Aberta" }, { v: "equilibrio", t: "Equilíbrio" }, { v: "reservada", t: "Reservada" }] },
      // RA
      { id: "idade_imovel", tipo: "unica", rotulo: "Idade aproximada do imóvel", obrig: true, mostrar: (t) => t.tipo === "RA",
        opcoes: [{ v: "ate10", t: "Até 10 anos" }, { v: "10a30", t: "10 a 30" }, { v: "30a50", t: "30 a 50" }, { v: "mais50", t: "Mais de 50" }, BR_NAO_SEI] },
      { id: "averbada", tipo: "unica", rotulo: "A área construída está averbada na matrícula?", mostrar: (t) => t.tipo === "RA",
        opcoes: [{ v: "sim", t: "Sim" }, { v: "nao", t: "Não" }, BR_NAO_SEI] },
      { id: "problemas", tipo: "multipla", rotulo: "Problemas que o imóvel tem hoje", obrig: true, mostrar: (t) => t.tipo === "RA", outro: true,
        opcoes: [{ v: "umidade", t: "Infiltração / umidade" }, { v: "trincas", t: "Trincas" }, { v: "eletrica", t: "Elétrica antiga" }, { v: "hidraulica", t: "Hidráulica" }, { v: "telhado", t: "Telhado" }, { v: "cupim", t: "Cupim" }, { v: "nenhum", t: "Nenhum" }] },
      { id: "manter", tipo: "texto", rotulo: "O que precisa ser mantido?", mostrar: (t) => t.tipo === "RA" },
      { id: "demolir", tipo: "texto", rotulo: "Há algo que já sabe que quer demolir?", mostrar: (t) => t.tipo === "RA" },
      { id: "ampliacao_dir", tipo: "unica", rotulo: "A ampliação seria térrea (para o lado) ou para cima?", obrig: true,
        mostrar: (t, r) => t.tipo === "RA" && (r.escopo === "ampliacao" || r.escopo === "ambas"),
        opcoes: [{ v: "lado", t: "Para o lado" }, { v: "cima", t: "Para cima" }, { v: "tanto_faz", t: "Sem preferência" }] },
      // AP
      { id: "situacao_ap", tipo: "unica", rotulo: "Situação do imóvel", obrig: true, mostrar: (t) => t.tipo === "AP",
        opcoes: [{ v: "planta", t: "Na planta ou em obra" }, { v: "contrapiso", t: "Entregue no contrapiso" }, { v: "acabado", t: "Entregue com acabamento" }, { v: "usado", t: "Usado" }] },
      { id: "entrega_ap", tipo: "mes", rotulo: "Previsão de entrega", mostrar: (t, r) => t.tipo === "AP" && r.situacao_ap === "planta" },
      { id: "restricoes_ap", tipo: "multipla", rotulo: "Restrições do condomínio que você já conhece", mostrar: (t) => t.tipo === "AP", outro: true,
        opcoes: [{ v: "sacada", t: "Fechamento de sacada" }, { v: "piso", t: "Troca de piso" }, { v: "horario", t: "Horário de obra" }, { v: "fachada", t: "Fachada" }, BR_NAO_SEI] },
      { id: "sindico", tipo: "texto", rotulo: "Contato do síndico ou da administradora", mostrar: (t) => t.tipo === "AP" },
      { id: "moveis_manter", tipo: "textolongo", rotulo: "Móveis e eletrodomésticos que serão mantidos (com medidas, se tiver)", mostrar: (t) => t.tipo === "AP" || t.tipo === "RA" },
      // PC
      { id: "ponto_proprio", tipo: "unica", rotulo: "O imóvel é próprio ou alugado?", obrig: true, mostrar: (t) => t.tipo === "PC",
        opcoes: [{ v: "proprio", t: "Próprio" }, { v: "alugado", t: "Alugado" }] },
      { id: "contrato_permite", tipo: "texto", rotulo: "O que o contrato de aluguel permite alterar?", mostrar: (t, r) => t.tipo === "PC" && r.ponto_proprio === "alugado" },
      { id: "shopping", tipo: "unica", rotulo: "Fica em shopping, galeria ou condomínio com regras de fachada e letreiro?", obrig: true, mostrar: (t) => t.tipo === "PC",
        opcoes: [{ v: "sim", t: "Sim" }, { v: "nao", t: "Não" }, BR_NAO_SEI] },
      { id: "licencas", tipo: "escala", rotulo: "Situação das licenças", mostrar: (t) => t.tipo === "PC",
        itens: [["alvara", "Alvará de funcionamento"], ["avcb", "AVCB / CLCB (bombeiros)"], ["visa", "Vigilância Sanitária"]],
        niveis: [{ v: "tenho", t: "Tenho" }, { v: "nao_tenho", t: "Não tenho" }, { v: "nao_sei", t: "Não sei se preciso" }] },
      // morar/funcionar durante a obra
      { id: "durante_obra", tipo: "unica", rotulo: "Vão morar no imóvel durante a obra?", obrig: true,
        mostrar: (t, r) => t.tipo === "RA" || (t.tipo === "AP" && r.situacao_ap === "usado"),
        opcoes: [{ v: "sim", t: "Sim" }, { v: "parcial", t: "Parcialmente" }, { v: "nao", t: "Não" }] },
      { id: "funcionando_obra", tipo: "unica", rotulo: "O negócio precisa continuar funcionando durante a obra?", obrig: true,
        mostrar: (t, r) => t.tipo === "PC" && r.escopo !== "nova", opcoes: [{ v: "sim", t: "Sim" }, { v: "nao", t: "Não" }] },
    ] },
    { titulo: "Documentos e fotos", perguntas: [
      { id: "documentos", tipo: "escala", rotulo: "Quais destes documentos você tem?", obrig: true, niveis: BR_DOC,
        ajuda: "Marque a situação de cada um. Não precisa enviar agora — o escritório combina com você.",
        itensPor: (t) => t.tipo === "CN" ? [["matricula", "Matrícula atualizada"], ["iptu", "IPTU / cadastro municipal"], ["topografia", "Levantamento topográfico"], ["sondagem", "Sondagem do solo"], ["regulamento", "Regulamento do condomínio"]]
          : t.tipo === "RA" ? [["planta", "Planta ou projeto aprovado"], ["habite_se", "Habite-se"], ["matricula", "Matrícula"]]
          : t.tipo === "AP" ? [["plantas", "Plantas da construtora"], ["instalacoes", "Projetos de instalações (elétrica, hidráulica, ar)"], ["regulamento", "Regulamento / regras de reforma do condomínio"]]
          : [["plantas", "Plantas do ponto"], ["contrato", "Contrato de aluguel"], ["regras", "Regras do shopping ou condomínio"]] },
      { id: "links_imovel", tipo: "links", rotulo: "Fotos, vídeos ou plantas do imóvel", ajuda: "Cole o link de uma pasta (Google Drive, iCloud, WhatsApp Web, Dropbox) — um por linha." },
    ] },
  ] },

  { id: "programa", titulo: "Ambientes", telas: [
    { titulo: "O que você deseja no projeto",
      nota: (t) => t.tipo === "RA" || t.tipo === "AP"
        ? "Pense no imóvel depois da reforma: conte o total, somando o que já existe e vai continuar com o que será construído."
        : "Pense no imóvel que vocês querem — não no lugar onde moram hoje.",
      perguntas: [
      { id: "quartos", tipo: "numero", rotulo: "Quantos quartos você deseja?", obrig: (t) => t.tipo === "CN" || t.tipo === "RA", mostrar: brRes, min: 0 },
      { id: "suites", tipo: "numero", rotulo: "Destes, quantas suítes você deseja?", mostrar: brRes, min: 0 },
      { id: "banheiros", tipo: "numero", rotulo: "Quantos banheiros você deseja, sem contar lavabo?", mostrar: brRes, min: 0 },
      { id: "vagas", tipo: "numero", rotulo: "Quantas vagas de carro você deseja?", obrig: (t) => t.tipo === "CN" || t.tipo === "RA", mostrar: brRes, min: 0 },
    ] },
    { titulo: "Ambientes que você deseja", nota: "Marque pensando no projeto que você deseja, não no imóvel de hoje.", perguntas: [
      { id: "programa", tipo: "escala", rotulo: "Para cada ambiente que você deseja no projeto, marque o quanto ele é importante", obrig: true, niveis: BR_PRIORIDADE,
        ajuda: "O que ficar sem marcar conta como \"não precisa\".", itensPor: (t) => brAmbientesDoTipo(t.tipo), outro: true, minMarcados: 1 },
    ] },
    { titulo: "Detalhes dos ambientes", nota: "Só para os ambientes que você marcou. Tudo opcional — responda o que já souber.", perguntas: [
      { id: "amb_sala_estar_lugares", grupo: "Sala de estar", tipo: "numero", rotulo: "Quantos lugares para sentar?", mostrar: (t, r) => brTemPrioridade(r, "sala_estar"), min: 0 },
      { id: "amb_sala_estar_tv", grupo: "Sala de estar", tipo: "unica", rotulo: "TV na sala?", mostrar: (t, r) => brTemPrioridade(r, "sala_estar"), opcoes: [{ v: "sim", t: "Sim" }, { v: "nao", t: "Não" }] },
      { id: "amb_sala_jantar_lugares", grupo: "Sala de jantar", tipo: "numero", rotulo: "Quantos lugares à mesa?", mostrar: (t, r) => brTemPrioridade(r, "sala_jantar"), min: 0 },
      { id: "amb_sala_jantar_moveis", grupo: "Sala de jantar", tipo: "multipla", rotulo: "Também na sala de jantar", mostrar: (t, r) => brTemPrioridade(r, "sala_jantar"),
        opcoes: [{ v: "aparador", t: "Aparador / buffet" }, { v: "cristaleira", t: "Cristaleira" }, { v: "adega", t: "Adega / bar" }] },
      { id: "amb_cozinha_tipo", grupo: "Cozinha", tipo: "unica", rotulo: "A cozinha deve ser", mostrar: (t, r) => brTemPrioridade(r, "cozinha"),
        opcoes: [{ v: "aberta", t: "Aberta" }, { v: "semiaberta", t: "Semiaberta" }, { v: "fechada", t: "Fechada" }] },
      { id: "amb_cozinha_ilha", grupo: "Cozinha", tipo: "unica", rotulo: "Ilha ou bancada para refeições?", mostrar: (t, r) => brTemPrioridade(r, "cozinha"),
        opcoes: [{ v: "ilha", t: "Ilha" }, { v: "bancada", t: "Bancada" }, { v: "nao", t: "Não" }] },
      { id: "amb_cozinha_equip", grupo: "Cozinha", tipo: "multipla", rotulo: "Equipamentos", mostrar: (t, r) => brTemPrioridade(r, "cozinha"), outro: true,
        opcoes: [{ v: "fogao", t: "Fogão" }, { v: "cooktop", t: "Cooktop" }, { v: "cinco_bocas", t: "5 bocas ou mais" }, { v: "forno", t: "Forno de embutir" }, { v: "micro", t: "Micro-ondas de embutir" },
          { v: "coifa", t: "Coifa" }, { v: "lava_loucas", t: "Lava-louças" }, { v: "geladeira_grande", t: "Geladeira side-by-side / duplex" }, { v: "freezer", t: "Freezer" },
          { v: "cuba_dupla", t: "Cuba dupla" }, { v: "adega", t: "Adega climatizada" }, { v: "filtro", t: "Filtro" }, { v: "reciclagem", t: "Lixeira de reciclagem" }] },
      { id: "amb_gourmet_churrasqueira", grupo: "Área gourmet", tipo: "unica", rotulo: "Churrasqueira", mostrar: (t, r) => brTemPrioridade(r, "gourmet"),
        opcoes: [{ v: "carvao", t: "A carvão (alvenaria)" }, { v: "coifa", t: "Gourmet com coifa e grill" }, { v: "eletrica", t: "Elétrica" }, { v: "gas", t: "A gás" }, { v: "nao", t: "Sem churrasqueira" }] },
      { id: "amb_gourmet_lugares", grupo: "Área gourmet", tipo: "numero", rotulo: "Quantas pessoas sentadas?", mostrar: (t, r) => brTemPrioridade(r, "gourmet"), min: 0 },
      { id: "amb_gourmet_extras", grupo: "Área gourmet", tipo: "multipla", rotulo: "Também na área gourmet", mostrar: (t, r) => brTemPrioridade(r, "gourmet"),
        opcoes: [{ v: "forno_pizza", t: "Forno de pizza" }, { v: "forno_lenha", t: "Forno a lenha" }, { v: "fogao_lenha", t: "Fogão a lenha" }, { v: "cooktop", t: "Fogão / cooktop" },
          { v: "geladeira", t: "Geladeira / cervejeira" }, { v: "tv", t: "TV" }, { v: "banheiro", t: "Banheiro com chuveiro" }] },
      { id: "amb_office_pessoas", grupo: "Home office", tipo: "numero", rotulo: "Para quantas pessoas?", mostrar: (t, r) => brTemPrioridade(r, "home_office"), min: 0 },
      { id: "amb_office_extras", grupo: "Home office", tipo: "multipla", rotulo: "Precisa de", mostrar: (t, r) => brTemPrioridade(r, "home_office"),
        opcoes: [{ v: "acustica", t: "Isolamento acústico" }, { v: "clientes", t: "Receber clientes" }, { v: "hospedes", t: "Servir também de quarto de hóspedes" }] },
      { id: "amb_lavanderia_local", grupo: "Lavanderia", tipo: "unica", rotulo: "Onde fica melhor?", mostrar: (t, r) => brTemPrioridade(r, "lavanderia"),
        opcoes: [{ v: "cozinha", t: "Perto da cozinha" }, { v: "quartos", t: "Perto dos quartos" }, { v: "externa", t: "Externa" }] },
      { id: "amb_lavanderia_secagem", grupo: "Lavanderia", tipo: "multipla", rotulo: "O que precisa ter", mostrar: (t, r) => brTemPrioridade(r, "lavanderia"),
        opcoes: [{ v: "tanque", t: "Tanque" }, { v: "maquina", t: "Máquina de lavar / lava e seca" }, { v: "secadora", t: "Secadora" }, { v: "varal_int", t: "Varal interno" },
          { v: "varal_ext", t: "Varal externo" }, { v: "armario", t: "Armário" }] },
      { id: "amb_garagem_coberta", grupo: "Garagem", tipo: "unica", rotulo: "Coberta ou descoberta?", mostrar: (t, r) => brTemPrioridade(r, "garagem"),
        opcoes: [{ v: "coberta", t: "Coberta" }, { v: "descoberta", t: "Descoberta" }, { v: "parte", t: "Parte coberta" }] },
      { id: "amb_garagem_guardar", grupo: "Garagem", tipo: "multipla", rotulo: "Guardar também", mostrar: (t, r) => brTemPrioridade(r, "garagem"),
        opcoes: [{ v: "bikes", t: "Bicicletas" }, { v: "pranchas", t: "Pranchas" }, { v: "ferramentas", t: "Ferramentas" }, { v: "jardinagem", t: "Jardinagem" }, { v: "moto", t: "Moto" }] },
      { id: "amb_piscina_uso", grupo: "Piscina", tipo: "unica", rotulo: "Uso principal", mostrar: (t, r) => brTemPrioridade(r, "piscina"),
        opcoes: [{ v: "lazer", t: "Lazer" }, { v: "raia", t: "Nadar (raia)" }, { v: "infantil", t: "Crianças" }] },
      { id: "amb_piscina_aquecida", grupo: "Piscina", tipo: "unica", rotulo: "Aquecida?", mostrar: (t, r) => brTemPrioridade(r, "piscina"),
        opcoes: [{ v: "sim", t: "Sim" }, { v: "nao", t: "Não" }, BR_NAO_SEI] },
      { id: "amb_piscina_extras", grupo: "Piscina", tipo: "multipla", rotulo: "Também na piscina", mostrar: (t, r) => brTemPrioridade(r, "piscina"),
        opcoes: [{ v: "spa", t: "Spa / hidro" }, { v: "prainha", t: "Prainha" }, { v: "deck", t: "Deck de madeira" }, { v: "cascata", t: "Cascata" }, { v: "espelho", t: "Espelho d'água" }] },
      { id: "amb_pc_estacoes", grupo: "Estações de trabalho", tipo: "numero", rotulo: "Quantas estações?", mostrar: (t, r) => brTemPrioridade(r, "estacoes"), min: 0 },
      { id: "amb_pc_salas", grupo: "Salas de atendimento", tipo: "numero", rotulo: "Quantas salas?", mostrar: (t, r) => brTemPrioridade(r, "salas_atend"), min: 0 },
    ] },
    { titulo: "Detalhes dos quartos", perguntas: [
      { id: "amb_suite_closet", grupo: "Suíte principal", tipo: "unica", rotulo: "Closet para", mostrar: (t, r) => brRes(t) && Number(r.suites) > 0,
        opcoes: [{ v: "1", t: "1 pessoa" }, { v: "2", t: "2 pessoas" }, { v: "nao", t: "Sem closet" }] },
      { id: "amb_closet_portas", grupo: "Suíte principal", tipo: "numero", rotulo: "Quantas portas tem o guarda-roupa que vocês usam hoje?", min: 0,
        mostrar: (t, r) => brRes(t) && Number(r.suites) > 0 && r.amb_suite_closet !== "nao", ajuda: "Serve de referência para o tamanho do closet." },
      { id: "amb_suite_cama", grupo: "Suíte principal", tipo: "unica", rotulo: "Tamanho da cama", mostrar: (t, r) => brRes(t) && Number(r.suites) > 0,
        opcoes: [{ v: "casal", t: "Casal (1,40 m)" }, { v: "queen", t: "Queen (1,60 m)" }, { v: "king", t: "King (1,93 m ou mais)" }] },
      { id: "amb_suite_moveis", grupo: "Suíte principal", tipo: "multipla", rotulo: "No quarto", mostrar: (t, r) => brRes(t) && Number(r.suites) > 0,
        opcoes: [{ v: "comoda", t: "Cômoda" }, { v: "penteadeira", t: "Penteadeira" }, { v: "poltrona", t: "Poltrona de leitura" }, { v: "tv", t: "TV" }, { v: "home_office", t: "Cantinho de trabalho" }] },
      { id: "amb_suite_extras", grupo: "Suíte principal", tipo: "multipla", rotulo: "No banheiro da suíte", mostrar: (t, r) => brRes(t) && Number(r.suites) > 0,
        opcoes: [{ v: "duas_cubas", t: "Duas cubas" }, { v: "ducha_dupla", t: "Dois chuveiros" }, { v: "banheira", t: "Banheira" }, { v: "vaso_separado", t: "Vaso em área separada" }, { v: "ducha_higienica", t: "Ducha higiênica / bidê" }] },
      { id: "amb_quartos_camas", grupo: "Outros quartos", tipo: "multipla", rotulo: "Que camas vão nos outros quartos?", mostrar: (t, r) => brRes(t) && Number(r.quartos) > 1,
        opcoes: [{ v: "solteiro", t: "Solteiro" }, { v: "dois_solteiros", t: "Duas de solteiro" }, { v: "beliche", t: "Beliche / bicama" }, { v: "casal", t: "Casal" }, { v: "queen", t: "Queen" }] },
      { id: "amb_quartos_extras", grupo: "Outros quartos", tipo: "multipla", rotulo: "Os outros quartos terão", mostrar: (t, r) => brRes(t) && Number(r.quartos) > 1,
        opcoes: [{ v: "suite", t: "Banheiro próprio (suíte)" }, { v: "closet", t: "Closet" }, { v: "estudo", t: "Bancada de estudo" }, { v: "tv", t: "TV" }] },
    ] },
    { titulo: "Como os ambientes se relacionam", perguntas: [
      { id: "integracao", tipo: "unica", rotulo: "Os ambientes sociais devem ser integrados?", mostrar: brRes,
        opcoes: [{ v: "tudo", t: "Tudo integrado (salas e cozinha)" }, { v: "salas", t: "Só as salas integradas" }, { v: "cozinha_jantar", t: "Cozinha integrada à sala de jantar" }, { v: "separados", t: "Ambientes separados" }] },
      { id: "gourmet_relacao", tipo: "multipla", rotulo: "A área gourmet deve ser", mostrar: (t, r) => brTemPrioridade(r, "gourmet"),
        opcoes: [{ v: "integrada", t: "Integrada com a casa" }, { v: "separada", t: "Separada da casa" }, { v: "perto_cozinha", t: "Perto da cozinha" }, { v: "aberta", t: "Aberta" }, { v: "fechada_vidro", t: "Fechada com vidro" }, { v: "mais_usada", t: "O ambiente mais usado da casa" }] },
      { id: "ambiencia", tipo: "multipla", rotulo: "Que tipo de ambiente vocês gostam?", mostrar: brRes,
        opcoes: [{ v: "abertos", t: "Abertos e integrados" }, { v: "reservados", t: "Mais reservados e privados" }, { v: "vidro", t: "Claros, com muito vidro" }, { v: "jardim_interno", t: "Com jardim interno" }, { v: "verde", t: "Muito verde por perto" }] },
      { id: "juntos_separados", tipo: "texto", rotulo: "Há ambientes que precisam ficar juntos ou bem separados?", ajuda: "Ex.: \"quarto do bebê perto da suíte\", \"home office longe da sala\"." },
    ] },
    { titulo: "Prioridades", perguntas: [
      { id: "top3", tipo: "rank3", rotulo: "Das coisas que você marcou, quais são as 3 mais importantes?", obrig: true, ajuda: "Toque na ordem: a primeira é a mais importante." },
      { id: "padrao", tipo: "unica", rotulo: "Padrão de acabamento esperado", obrig: true,
        opcoes: [{ v: "economico", t: "Econômico" }, { v: "medio", t: "Médio" }, { v: "alto", t: "Alto" }, { v: "muito_alto", t: "Muito alto" }] },
      { id: "area_imaginada", tipo: "numero", rotulo: "Você tem ideia da área total que imagina? (m²)", mostrar: (t) => t.tipo !== "AP", min: 0, decimal: true, ajuda: "Deixe em branco se não souber." },
    ] },
  ] },

  { id: "orcamento", titulo: "Orçamento e prazos", telas: [
    { perguntas: [
      { id: "investimento", tipo: "unica", rotulo: "Quanto pretende investir na obra?", obrig: true,
        opcoesPor: (t) => (BR_ORCAMENTO[t.tipo] || BR_ORCAMENTO.CN).map((x) => ({ v: x, t: x })).concat([{ v: "nao_sei", t: "Ainda não sei, preciso de orientação" }]) },
      { id: "inclui_moveis", tipo: "unica", rotulo: "Esse valor inclui móveis, marcenaria e decoração?", obrig: true,
        opcoes: [{ v: "sim", t: "Sim" }, { v: "nao", t: "Não" }, { v: "parcial", t: "Parcialmente" }] },
      { id: "recurso", tipo: "unica", rotulo: "De onde virá o recurso?",
        opcoes: [{ v: "proprio", t: "Próprio" }, { v: "financiamento", t: "Financiamento bancário" }, { v: "programa", t: "Programa habitacional" }, { v: "misto", t: "Misto" }, { v: "indefinido", t: "Ainda não definido" }] },
      { id: "se_estourar", tipo: "unica", rotulo: "Se o projeto ficar acima do orçamento, o que prefere?", obrig: true,
        opcoes: [{ v: "etapas", t: "Fazer em etapas" }, { v: "area", t: "Reduzir a área" }, { v: "padrao", t: "Reduzir o padrão de acabamento" }, { v: "aumentar", t: "Aumentar o orçamento" }] },
    ] },
    { perguntas: [
      { id: "inicio_obra", tipo: "mes", rotulo: "Quando gostaria de começar a obra?", obrig: true, naoSei: true },
      { id: "data_limite", tipo: "mes", rotulo: "Há uma data-limite para mudança ou inauguração?", naoSei: true },
      { id: "data_rigidez", tipo: "unica", rotulo: "Essa data é", obrig: true,
        opcoes: [{ v: "rigida", t: "Rígida" }, { v: "flexivel", t: "Flexível em até 3 meses" }, { v: "sem_data", t: "Sem data definida" }] },
      { id: "datas_importantes", tipo: "texto", rotulo: "Há eventos ou datas importantes a considerar?", ajuda: "Casamento, nascimento, safra, temporada…" },
      { id: "decisor", tipo: "texto", rotulo: "Quem é o contato principal para decisões? Há outros decisores?", obrig: true },
      { id: "participacao", tipo: "unica", rotulo: "Como prefere participar?",
        opcoes: [{ v: "cada", t: "Quero aprovar cada escolha" }, { v: "fechadas", t: "Prefiro receber propostas fechadas" }, { v: "meio", t: "Meio-termo" }] },
    ] },
  ] },

  { id: "estilo", titulo: "Estilo", telas: [
    { perguntas: [
      { id: "estilos", tipo: "multipla", rotulo: "Quais estilos mais combinam com você?", obrig: true, opcoes: BR_ESTILOS, cartoes: true, max: 4, ajuda: "Escolha até 4." },
      { id: "estilos_nao", tipo: "multipla", rotulo: "E algum que você não gostaria de jeito nenhum?", opcoes: BR_ESTILOS.map((o) => ({ v: o.v, t: o.t })), max: 4, excluirDe: "estilos" },
      { id: "percepcao", tipo: "multipla", rotulo: "Como você quer que o imóvel seja percebido?", max: 3, ajuda: "Escolha até 3.",
        opcoes: [{ v: "sofisticado", t: "Sofisticado" }, { v: "aconchegante", t: "Aconchegante" }, { v: "discreto", t: "Discreto" }, { v: "imponente", t: "Imponente" },
          { v: "moderno", t: "Inovador" }, { v: "tradicional", t: "Tradicional" }, { v: "urbano", t: "Urbano" }, { v: "natural", t: "Natural" }] },
    ] },
    { perguntas: [
      { id: "paleta", tipo: "multipla", rotulo: "Quais paletas de cor mais combinam com você?", max: 2, ajuda: "Escolha até 2. É só para entender seu gosto.", paleta: true,
        opcoes: [{ v: "claros", t: "Neutros claros", cores: ["#f5f1ea", "#e4ddd1", "#c9bfae", "#ffffff"] },
          { v: "terrosos", t: "Terrosos", cores: ["#c68b59", "#a0603d", "#e3c9a8", "#6b4f3a"] },
          { v: "pb", t: "Preto e branco", cores: ["#111111", "#ffffff", "#8a8a8a", "#d6d6d6"] },
          { v: "madeira_verde", t: "Madeira e verde", cores: ["#9c6b43", "#5f7f52", "#d9c7a7", "#2f4a33"] },
          { v: "concreto", t: "Cinzas e concreto", cores: ["#9a9a95", "#c8c7c2", "#5d5d5a", "#e9e8e4"] },
          { v: "vivas", t: "Cores vivas", cores: ["#1f6fb2", "#e8b228", "#d4553b", "#2e9c79"] }] },
      { id: "materiais_gosta", tipo: "multipla", rotulo: "Materiais que você adora", outro: true,
        opcoes: [{ v: "madeira", t: "Madeira" }, { v: "ripado", t: "Painel ripado" }, { v: "pedra", t: "Pedra natural" }, { v: "concreto", t: "Concreto / cimento queimado" }, { v: "tijolo", t: "Tijolo" },
          { v: "vazado", t: "Elemento vazado (cobogó)" }, { v: "corten", t: "Aço corten" }, { v: "metal", t: "Metal" }, { v: "vidro", t: "Vidro" }, { v: "molduras", t: "Molduras clássicas" }] },
      { id: "materiais_evita", tipo: "multipla", rotulo: "E os que você evita", outro: true, excluirDe: "materiais_gosta",
        opcoes: [{ v: "madeira", t: "Madeira" }, { v: "pedra", t: "Pedra" }, { v: "concreto", t: "Concreto aparente" }, { v: "tijolo", t: "Tijolo" }, { v: "metal", t: "Metal" }, { v: "vidro", t: "Vidro" },
          { v: "branco", t: "Branco total" }, { v: "vivas", t: "Cores vivas" }, { v: "escuros", t: "Tons escuros" }] },
    ] },
    { titulo: "A linguagem da casa", nota: "Tudo opcional — marque só o que já tiver opinião.", perguntas: [
      { id: "elementos", tipo: "multipla", rotulo: "Elementos que você gostaria de ter", mostrar: (t) => t.tipo === "CN" || t.tipo === "RA",
        opcoes: [{ v: "pergolado", t: "Pergolado" }, { v: "varanda", t: "Varanda" }, { v: "sacada", t: "Sacada" }, { v: "marquise", t: "Marquise" }, { v: "portico", t: "Pórtico de entrada" },
          { v: "espelho_agua", t: "Espelho d'água" }, { v: "jardim_interno", t: "Jardim interno" }, { v: "pe_direito", t: "Pé-direito duplo" }] },
      { id: "esquadrias", tipo: "unica", rotulo: "Janelas e portas de preferência",
        opcoes: [{ v: "aluminio", t: "Alumínio" }, { v: "pvc", t: "PVC" }, { v: "madeira", t: "Madeira" }, { v: "tanto_faz", t: "Sem preferência" }] },
      { id: "piso_interno", tipo: "unica", rotulo: "Piso interno",
        opcoes: [{ v: "porcelanato", t: "Porcelanato em tudo" }, { v: "misto", t: "Porcelanato no social, madeira nos quartos" }, { v: "madeira", t: "Madeira / vinílico, porcelanato só nas áreas molhadas" }, BR_NAO_SEI] },
      { id: "paisagismo", tipo: "unica", rotulo: "Paisagismo", mostrar: (t) => t.tipo === "CN" || t.tipo === "RA",
        opcoes: [{ v: "alto", t: "Mais alto (árvores, privacidade)" }, { v: "baixo", t: "Mais baixo (gramado, forrações)" }, { v: "misto", t: "Misto" }, { v: "minimo", t: "O mínimo de manutenção" }] },
      { id: "links_referencia", tipo: "links", rotulo: "Links de referência", ajuda: "Pinterest, Instagram, sites — um por linha." },
      { id: "nao_pode_faltar", tipo: "texto", rotulo: "O que não pode faltar de jeito nenhum?" },
      { id: "marca_cores", tipo: "texto", rotulo: "Valores da marca e cores do logotipo", mostrar: (t) => t.tipo === "PC" },
    ] },
  ] },

  { id: "conforto", titulo: "Conforto e tecnologia", opcional: true, telas: [
    { perguntas: [
      { id: "ar_condicionado", tipo: "multipla", rotulo: "Ar-condicionado em quais ambientes?",
        opcoes: [{ v: "quartos", t: "Quartos" }, { v: "sala", t: "Sala" }, { v: "escritorio", t: "Escritório" }, { v: "todos", t: "Todos" }, { v: "preparar", t: "Só deixar preparado" }, { v: "nenhum", t: "Nenhum" }] },
      { id: "agua_quente", tipo: "unica", rotulo: "Aquecimento de água", mostrar: brRes,
        opcoes: [{ v: "solar", t: "Solar" }, { v: "gas", t: "Gás" }, { v: "eletrico", t: "Elétrico" }, { v: "bomba", t: "Bomba de calor" }, BR_NAO_SEI] },
      { id: "sustentabilidade", tipo: "escala", rotulo: "Sustentabilidade e conforto", niveis: BR_PRIORIDADE,
        itens: [["fotovoltaica", "Energia solar fotovoltaica"], ["aquec_solar", "Aquecimento solar"], ["chuva", "Captação ou reúso de água de chuva"], ["ventilacao", "Ventilação natural cruzada"],
          ["luz", "Muita luz natural"], ["acustica", "Isolamento acústico"], ["compostagem", "Compostagem"], ["carregador", "Carregador de carro elétrico"]] },
      { id: "preocupa_conforto", tipo: "texto", rotulo: "Há ruídos, falta de privacidade ou calor excessivo que te preocupam?" },
    ] },
    { perguntas: [
      { id: "tecnologia", tipo: "escala", rotulo: "Tecnologia e segurança", niveis: BR_PRIORIDADE,
        itens: [["automacao", "Automação de luz, cortinas ou clima"], ["cameras", "Câmeras"], ["alarme", "Alarme"], ["portao", "Portão automático / cerca elétrica"], ["fechadura", "Fechadura digital"],
          ["videoporteiro", "Vídeo-porteiro"], ["rede", "Wi-Fi com cabeamento"], ["som", "Som ambiente"]] },
      { id: "eletrica_especial", tipo: "texto", rotulo: "Necessidades elétricas ou de rede especiais (equipamentos de alta potência, servidor, PDV)", mostrar: (t) => t.tipo === "PC" },
    ] },
  ] },

  { id: "saude", titulo: "Acessibilidade", opcional: true, mostrar: brRes, telas: [
    { perguntas: [
      { id: "consentimento_saude", tipo: "consentimento", rotulo: "Autorizo o uso destas informações exclusivamente neste projeto",
        ajuda: "As próximas perguntas são opcionais e podem envolver informações de saúde. Servem só para adaptar o projeto. Você pode pular esta parte ou retirar a autorização quando quiser." },
      { id: "acessibilidade", tipo: "unica", rotulo: "Algum morador ou visitante frequente tem, ou poderá ter, mobilidade reduzida ou outra necessidade especial?",
        mostrar: (t, r) => r.consentimento_saude === true,
        opcoes: [{ v: "hoje", t: "Sim, hoje" }, { v: "futuro", t: "Sim, no futuro" }, { v: "nao", t: "Não" }, { v: "nr", t: "Prefiro não informar" }] },
      { id: "adaptacoes", tipo: "multipla", rotulo: "Que adaptações imagina?", outro: true,
        mostrar: (t, r) => r.consentimento_saude === true && (r.acessibilidade === "hoje" || r.acessibilidade === "futuro"),
        opcoes: [{ v: "quarto_terreo", t: "Quarto no térreo" }, { v: "banheiro", t: "Banheiro acessível" }, { v: "elevador", t: "Prever elevador" }, { v: "portas", t: "Portas largas" }, { v: "barras", t: "Barras de apoio" }, { v: "piso", t: "Piso antiderrapante" }] },
      { id: "alergias", tipo: "texto", rotulo: "Alguém tem alergia ou sensibilidade a algum material (poeira, mofo, madeira, tintas)?",
        mostrar: (t, r) => r.consentimento_saude === true },
    ] },
  ] },

  { id: "futuro", titulo: "Futuro e manutenção", opcional: true, telas: [
    { perguntas: [
      { id: "ampliar_futuro", tipo: "multipla", rotulo: "Pretende ampliar no futuro? Devemos deixar previsto:", mostrar: (t) => t.tipo === "CN" || t.tipo === "RA",
        opcoes: [{ v: "quarto", t: "Quarto extra" }, { v: "piscina", t: "Piscina" }, { v: "edicula", t: "Edícula" }, { v: "pavimento", t: "Segundo pavimento" }, { v: "elevador", t: "Elevador" }, { v: "nenhum", t: "Nada" }] },
      { id: "revenda", tipo: "unica", rotulo: "Quanto a revenda deve pesar nas decisões?", mostrar: brRes,
        opcoes: [{ v: "muito", t: "Muito" }, { v: "pouco", t: "Pouco" }, { v: "nada", t: "Nada" }] },
      { id: "baixa_manutencao", tipo: "unica", rotulo: "Prefere materiais de baixa manutenção, mesmo que custem mais?",
        opcoes: [{ v: "sim", t: "Sim" }, { v: "depende", t: "Depende" }, { v: "nao", t: "Não" }] },
      { id: "quem_cuida", tipo: "unica", rotulo: "Quem cuidará da limpeza, do jardim e da piscina?", mostrar: brRes,
        opcoes: [{ v: "familia", t: "A família" }, { v: "diarista", t: "Diarista" }, { v: "empresa", t: "Empresa" }] },
    ] },
  ] },

  { id: "fechamento", titulo: "Para fechar", telas: [
    { perguntas: [
      { id: "preocupacao", tipo: "texto", rotulo: "Qual sua maior preocupação com este projeto ou com a obra?" },
      { id: "faltou", tipo: "textolongo", rotulo: "Tem algo importante que não perguntamos?" },
      { id: "facilidade", tipo: "unica", rotulo: "Este questionário foi fácil de responder?",
        opcoes: [{ v: "1", t: "1" }, { v: "2", t: "2" }, { v: "3", t: "3" }, { v: "4", t: "4" }, { v: "5", t: "5" }], linha: true,
        extremos: ["Muito difícil", "Muito fácil"] },
    ] },
  ] },
];

// ── Dicas (ícone "i" no canto de cada pergunta) ──────────────────
// Uma frase do que preencher e por que importa — só onde a pergunta pode
// gerar dúvida (termo técnico, "para que serve", o que contar). Perguntas
// óbvias (nome, gosta/incomoda, cores) ficam sem, para o ícone não virar ruído.
const BR_DICAS = {
  tipo: "Já marcamos pelo que foi contratado. Corrija se não for o seu caso.",
  escopo: "Reforma muda o que já existe; ampliação aumenta a área construída.",
  uso: "Muda as próximas perguntas: para alugar ou vender, não perguntamos sobre a rotina da família.",
  motivos: "Pode marcar mais de um. Mostra ao arquiteto o que é sucesso para vocês.",
  sucesso: "Ex.: \"a família inteira cabe na mesa\", \"a casa fica fresca sem ar-condicionado\".",
  permanencia: "Quem fica pouco tempo costuma priorizar a revenda; quem fica muito, conforto e durabilidade.",
  moradores_qtd: "Conte quem mora o ano todo, incluindo as crianças.",
  moradores: "A faixa etária ajuda a pensar quartos, segurança e acessibilidade. Não precisa do nome.",
  funcionario: "Define se o projeto precisa de dependência, banheiro de serviço ou área de apoio.",
  pets: "Influencia piso, quintal, portões e onde os animais ficam.",
  visitas_freq: "Define o tamanho da sala, da mesa e da área gourmet.",
  visitas_qtd: "Pense nas ocasiões mais cheias que acontecem com alguma frequência.",
  cozinham: "Quem cozinha todo dia precisa de mais bancada, armazenamento e exaustão.",
  trabalho_casa: "Conte quem trabalha em casa pelo menos alguns dias por semana.",
  hobbies: "Coisas que precisam de lugar para guardar ou de espaço para usar.",
  dia_tipico: "Horários, quem sai cedo, onde a família passa mais tempo. Escreva do seu jeito.",
  condominio: "Condomínios costumam ter regras de recuo, altura e fachada que o projeto precisa seguir.",
  pavimentos: "Casa térrea facilita a acessibilidade; sobrado aproveita melhor terrenos pequenos.",
  idade_imovel: "Imóveis mais antigos costumam precisar de revisão de elétrica, hidráulica e telhado.",
  averbada: "Averbada = a área construída está registrada na matrícula, no cartório. Se não souber, marque \"Não sei\" — o escritório verifica.",
  problemas: "Tudo o que você já percebeu: manchas, rachaduras, disjuntor que cai, telhado que pinga…",
  manter: "Ex.: um piso que você gosta, uma árvore, um ambiente que deve continuar igual.",
  situacao_ap: "Contrapiso = entregue sem piso e sem acabamento.",
  restricoes_ap: "Regras do condomínio que limitam a obra. O escritório confirma no regulamento.",
  durante_obra: "Muda o planejamento: a ordem dos serviços e a proteção dos ambientes em uso.",
  funcionando_obra: "Se sim, a obra é planejada em etapas, com horários e áreas isoladas.",
  licencas: "AVCB/CLCB é o certificado dos bombeiros. Vigilância Sanitária vale para alimentação, saúde e estética.",
  documentos: "Matrícula: certidão do cartório de imóveis. Habite-se: documento da prefeitura que libera o uso do imóvel. Se não souber, marque \"Não sei o que é\".",
  links_imovel: "Um link de pasta compartilhada com fotos dos ambientes, das fachadas e do terreno.",
  quartos: "Conte todos os quartos, incluindo as suítes.",
  vagas: "Vagas de carro cobertas ou descobertas, no total.",
  programa: "Essencial: não pode faltar. Desejável: se couber no orçamento. Não precisa: pode ficar de fora.",
  top3: "O que mais importa para vocês se for preciso escolher.",
  padrao: "Econômico: materiais simples e duráveis. Médio: bom custo-benefício. Alto: materiais nobres. Muito alto: exclusivos e sob medida.",
  area_imaginada: "Área construída total do imóvel. Se não souber, deixe em branco.",
  investimento: "Valor da obra (material e mão de obra), sem os honorários do projeto. Serve para o projeto caber no seu bolso.",
  inclui_moveis: "Marcenaria e móveis costumam ser uma parte grande do custo total.",
  recurso: "Financiamento e programas habitacionais têm exigências que o projeto precisa atender.",
  se_estourar: "Ajuda o escritório a propor os ajustes do jeito que você prefere.",
  inicio_obra: "O mês aproximado. Se não souber, marque \"Não sei\".",
  data_limite: "Ex.: fim do aluguel atual, casamento, inauguração.",
  data_rigidez: "Rígida = não pode passar dessa data.",
  decisor: "Quem aprova as decisões do projeto. Se forem duas pessoas, cite as duas.",
  participacao: "Define com que frequência o escritório vai te consultar durante o projeto.",
  estilos: "Não precisa saber o nome certo — escolha pelo que a descrição lembra.",
  percepcao: "A primeira impressão de quem chega. Ajuda a definir fachada, entrada e proporções.",
  paleta: "Não precisa ser exatamente estas cores — é para entender se você prefere tons claros, terrosos, contrastantes…",
  integracao: "Integrar amplia o espaço e a convivência; separar dá mais privacidade e controle de cheiro e barulho.",
  elementos: "Elementos que mudam o desenho da fachada e das áreas externas.",
  piso_interno: "Define parte do custo e do conforto (madeira e vinílico são mais quentes; porcelanato, mais fácil de limpar).",
  links_referencia: "Pastas do Pinterest ou posts do Instagram com imagens de que você gosta.",
  agua_quente: "Se não souber, o escritório indica a melhor opção para o seu caso.",
  sustentabilidade: "Essencial: não pode faltar. Desejável: se couber no orçamento. Não precisa: pode ficar de fora.",
  tecnologia: "Mesmo o que for só desejável já fica previsto na tubulação e na elétrica.",
  ampliar_futuro: "Deixar previsto evita quebra-quebra depois (ex.: estrutura para um segundo andar).",
  baixa_manutencao: "Ex.: porcelanato em vez de madeira no piso externo.",
  ramo: "Conte o que o negócio faz — ajuda a entender os fluxos e as exigências legais.",
  pico: "Quantos clientes ao mesmo tempo no momento mais cheio do dia.",
  marca: "Franquias costumam ter manual com cores, materiais e layout obrigatórios.",
  fluxo: "Ex.: o cliente entra, espera, é atendido, paga e sai; a mercadoria chega pelos fundos e vai para o estoque.",
  equipamentos: "Equipamentos que pedem instalação elétrica, hidráulica ou exaustão especial.",
};

// ── Regras (puras) ───────────────────────────────────────────────
// Tipo de projeto a partir do orçamento: o subtipo "Reforma" vira RA; tipo
// comercial vira PC; apartamento/interiores vira AP; o resto é casa nova.
function tipoBriefingDoProjeto(ctx) {
  const t = String((ctx && ctx.tipo) || "").toLowerCase(), s = String((ctx && ctx.subtipo) || "").toLowerCase();
  if (/comerc|cl[ií]nica|loja|escrit|galp|restaur|consult/.test(t)) return "PC";
  if (/apart|interior/.test(t + " " + s)) return "AP";
  if (/reforma|amplia/.test(s)) return "RA";
  return "CN";
}
function contextoDoBriefing(respostas, padrao) {
  const r = respostas || {};
  return { tipo: r.tipo || padrao || "CN", uso: r.uso || (r.tipo === "PC" ? "" : "morar") };
}
function brVisivel(item, t, r) { return !item.mostrar || !!item.mostrar(t, r); }
function brObrigatoria(p, t) { return typeof p.obrig === "function" ? !!p.obrig(t) : !!p.obrig; }
function opcoesDaPergunta(p, t) { return p.opcoesPor ? p.opcoesPor(t) : (p.opcoes || []); }
function itensDaEscala(p, t) { return p.itensPor ? p.itensPor(t) : (p.itens || []); }

// As telas que o cliente vai ver, já filtradas (seção e pergunta).
function telasDoBriefing(respostas, tipoPadrao) {
  const r = respostas || {}, t = contextoDoBriefing(r, tipoPadrao);
  const out = [];
  const secoes = BRIEFING_SECOES.filter((s) => brVisivel(s, t, r));
  secoes.forEach((s, is) => s.telas.forEach((tela, it) => {
    const perguntas = tela.perguntas.filter((p) => brVisivel(p, t, r));
    if (perguntas.length) out.push({ secao: s, nSecao: is + 1, totalSecoes: secoes.length, tela, perguntas, chave: s.id + ":" + it });
  }));
  return out;
}

function brVazio(v) {
  if (v == null || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v).filter((k) => !brVazio(v[k])).length === 0;
  return false;
}
// O que falta numa pergunta obrigatória ("" quando está ok).
function faltaNaPergunta(p, t, r) {
  if (!brObrigatoria(p, t)) return "";
  const v = r[p.id];
  if (p.tipo === "lista") {
    const lista = Array.isArray(v) ? v : [];
    const obr = (p.campos || []).filter((c) => c.obrig);
    return lista.some((x) => obr.some((c) => brVazio((x || {})[c.id]))) ? "Complete a faixa etária de cada morador." : "";
  }
  if (p.tipo === "escala") {
    const marcados = Object.keys(v || {}).filter((k) => !brVazio((v || {})[k]) && k !== "_outro");
    if (p.minMarcados && marcados.filter((k) => p.niveis !== BR_PRIORIDADE || v[k] !== "dispensavel").length < p.minMarcados) return "Marque ao menos um ambiente como essencial ou desejável.";
    if (!p.minMarcados && marcados.length < itensDaEscala(p, t).length) return "Marque uma opção em cada linha.";
    return "";
  }
  if (p.tipo === "rank3") {
    const opc = opcoesDoRank(t, r);
    return opc.length && brVazio(v) ? "Escolha ao menos uma prioridade." : "";
  }
  if (p.tipo === "multipla") {
    const x = v || {};
    return (Array.isArray(x.sel) && x.sel.length) || !brVazio(x.outro) ? "" : "Escolha ao menos uma opção.";
  }
  return brVazio(v) ? "Esta pergunta é obrigatória." : "";
}
function pendenciasDaTela(tela, r, tipoPadrao) {
  const t = contextoDoBriefing(r, tipoPadrao), out = {};
  tela.perguntas.forEach((p) => { const f = faltaNaPergunta(p, t, r); if (f) out[p.id] = f; });
  return out;
}
function pendenciasDoBriefing(r, tipoPadrao) {
  const out = [];
  telasDoBriefing(r, tipoPadrao).forEach((tl) => {
    const f = pendenciasDaTela(tl, r, tipoPadrao);
    Object.keys(f).forEach((id) => out.push({ id, secao: tl.secao.titulo, chave: tl.chave, msg: f[id],
      rotulo: (tl.perguntas.find((p) => p.id === id) || {}).rotulo || id }));
  });
  return out;
}

// As opções do "top 3": o que foi marcado como essencial ou desejável.
function opcoesDoRank(t, r) {
  const prog = r.programa || {};
  const base = brAmbientesDoTipo(t.tipo).filter(([k]) => prog[k] === "essencial" || prog[k] === "desejavel").map(([v, tt]) => ({ v, t: tt }));
  const outros = String(prog._outro || "").split(/[,;\n]/).map((x) => x.trim()).filter(Boolean).map((x) => ({ v: "outro:" + x, t: x }));
  return base.concat(outros);
}

// ── Resumo para o escritório ─────────────────────────────────────
function textoDaResposta(p, v, t, r) {
  if (brVazio(v) && p.tipo !== "consentimento") return "";
  const rot = (lista, x) => { const o = lista.find((y) => y.v === x); return o ? o.t : String(x); };
  switch (p.tipo) {
    case "unica": return p.extremos ? `${v} de ${opcoesDaPergunta(p, t).length} (1 = ${p.extremos[0].toLowerCase()}, ${opcoesDaPergunta(p, t).length} = ${p.extremos[1].toLowerCase()})` : rot(opcoesDaPergunta(p, t), v);
    case "multipla": {
      const x = v || {}, partes = (x.sel || []).map((s) => rot(opcoesDaPergunta(p, t), s));
      if (!brVazio(x.outro)) partes.push(x.outro);
      return partes.join(", ");
    }
    case "numero": return String(v).replace(".", ",");
    case "mes": return v === "nao_sei" ? "Não sei" : String(v).split("-").reverse().join("/");
    case "consentimento": return v === true ? "Autorizado" : "";
    case "links": return String(v).split(/\s+/).filter(Boolean).join("\n");
    case "rank3": {
      const opc = opcoesDoRank(t, r);
      return (v || []).map((x, i) => `${i + 1}. ${rot(opc, x)}`).join("  ");
    }
    case "lista": return (v || []).map((x, i) => {
      const xs = (p.campos || []).map((c) => { const y = (x || {})[c.id]; return brVazio(y) ? "" : (c.tipo === "unica" ? rot(c.opcoes, y) : y); }).filter(Boolean);
      return `${i + 1}) ${xs.join(" · ")}`;
    }).join("\n");
    case "escala": {
      const itens = itensDaEscala(p, t), niveis = p.niveis || [];
      const por = {};
      itens.forEach(([k, nome]) => { const n = (v || {})[k]; if (n) (por[n] = por[n] || []).push(nome); });
      const linhas = niveis.filter((n) => por[n.v]).map((n) => `${n.t}: ${por[n.v].join(", ")}`);
      if (!brVazio((v || {})._outro)) linhas.push(`Outros: ${v._outro}`);
      return linhas.join("\n");
    }
    default: return String(v);
  }
}
function resumoDoBriefing(respostas, tipoPadrao) {
  const r = respostas || {}, t = contextoDoBriefing(r, tipoPadrao);
  const secoes = [];
  telasDoBriefing(r, tipoPadrao).forEach((tl) => {
    let s = secoes.find((x) => x.id === tl.secao.id);
    if (!s) { s = { id: tl.secao.id, titulo: tl.secao.titulo, itens: [] }; secoes.push(s); }
    tl.perguntas.forEach((p) => {
      if (p.id === "programa") return;            // vai para o quadro do programa
      const txt = textoDaResposta(p, r[p.id], t, r);
      if (txt) s.itens.push({ id: p.id, rotulo: (p.grupo ? p.grupo + " · " : "") + p.rotulo, valor: txt });
    });
  });
  const prog = r.programa || {};
  const programa = { essencial: [], desejavel: [], outros: String(prog._outro || "").trim() };
  brAmbientesDoTipo(t.tipo).forEach(([k, nome]) => { if (prog[k] === "essencial") programa.essencial.push(nome); else if (prog[k] === "desejavel") programa.desejavel.push(nome); });
  // Pendências para a reunião: o que o cliente não sabia ou vai mandar depois
  const atencao = [];
  const docs = r.documentos || {};
  Object.keys(docs).forEach((k) => { if (docs[k] === "depois") atencao.push(`Documento a receber: ${k.replace(/_/g, " ")}`); });
  if (r.investimento === "nao_sei") atencao.push("Orçamento da obra ainda indefinido — orientar o cliente.");
  if (r.inicio_obra === "nao_sei") atencao.push("Início da obra sem data.");
  if (r.data_rigidez === "rigida") atencao.push("Data-limite rígida" + (r.data_limite && r.data_limite !== "nao_sei" ? ` (${textoDaResposta({ tipo: "mes" }, r.data_limite)})` : "") + ".");
  if (r.padrao === "economico" && programa.essencial.length >= 10) atencao.push("Muitos ambientes essenciais com padrão econômico — confrontar com o orçamento.");
  return { tipo: t.tipo, secoes: secoes.filter((s) => s.itens.length), programa, atencao };
}

// ── Rede ─────────────────────────────────────────────────────────
async function brPublico(method, token, body) {
  const res = await fetch(`${_API_URL}/api/briefing-publico/${encodeURIComponent(token)}`, {
    method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch (e) { throw new Error("Sem conexão com o servidor"); }
  if (!json.ok) { const e = new Error(json.error || "Erro"); e.status = res.status; throw e; }
  return json.data;
}

// UI — daqui para baixo é tela (JSX). Os testes cortam neste marcador.
const BR_AZUL = "#0474f4";
const brS = {
  pagina: { minHeight: "100vh", background: "#f6f7f9", fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", color: "#1f2937" },
  caixa: { maxWidth: 640, margin: "0 auto", padding: "16px 16px 120px" },
  rotulo: { fontSize: 15, fontWeight: 600, color: "#111827", lineHeight: 1.35, marginBottom: 8, display: "block" },
  ajuda: { fontSize: 13, color: "#6b7280", marginTop: -4, marginBottom: 10, lineHeight: 1.45 },
  input: { width: "100%", boxSizing: "border-box", fontSize: 16, padding: "12px 14px", border: "1.5px solid #d1d5db", borderRadius: 10, background: "#fff", color: "#111827", fontFamily: "inherit", outline: "none" },
  chip: (on) => ({ minHeight: 44, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${on ? BR_AZUL : "#d1d5db"}`, background: on ? "#eef5ff" : "#fff",
    color: on ? "#0b4fb3" : "#1f2937", fontSize: 14.5, fontWeight: on ? 600 : 500, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }),
  btn: { minHeight: 48, padding: "12px 20px", borderRadius: 12, border: "none", background: BR_AZUL, color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  btnSec: { minHeight: 48, padding: "12px 16px", borderRadius: 12, border: "1.5px solid #d1d5db", background: "#fff", color: "#1f2937", fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" },
  erro: { fontSize: 13, color: "#b91c1c", marginTop: 6 },
};

// O "i" no canto da pergunta: passa o mouse (ou toca, no celular) e aparece
// a explicação. Fecha ao sair, ao tocar de novo ou ao tocar fora.
function BrDica({ texto }) {
  const [aberta, setAberta] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!aberta) return;
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberta(false); };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberta]);
  return (
    <span ref={ref} data-br-dica style={{ position: "absolute", top: 0, right: 0 }}
      onPointerEnter={(e) => { if (e.pointerType === "mouse") setAberta(true); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") setAberta(false); }}>
      <button type="button" aria-label="O que preencher" aria-expanded={aberta} onClick={(e) => setAberta((x) => (e.nativeEvent && e.nativeEvent.pointerType === "mouse") ? true : !x)}
        style={{ width: 26, height: 26, borderRadius: 13, border: "1.5px solid #c7d2fe", background: aberta ? BR_AZUL : "#fff", color: aberta ? "#fff" : BR_AZUL,
          fontSize: 13, fontWeight: 700, fontFamily: "Georgia, serif", fontStyle: "italic", cursor: "pointer", padding: 0, lineHeight: "22px" }}>i</button>
      {aberta && (
        <span role="tooltip" style={{ position: "absolute", top: 32, right: 0, zIndex: 20, width: "min(280px, 78vw)", background: "#111827", color: "#fff",
          fontSize: 13, lineHeight: 1.45, fontWeight: 400, padding: "9px 11px", borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,0.18)", textAlign: "left" }}>
          {texto}
        </span>
      )}
    </span>
  );
}

function BrPergunta({ p, t, r, valor, mudar, erro }) {
  const obrig = brObrigatoria(p, t);
  const dica = p.dica || BR_DICAS[p.id];
  const rotulo = (
    <label style={{ ...brS.rotulo, ...(dica ? { paddingRight: 36 } : {}) }}>{obrig && <span style={{ color: "#b91c1c" }} aria-hidden="true">* </span>}{p.rotulo}{!obrig && p.tipo !== "consentimento" && <span style={{ color: "#9ca3af", fontWeight: 400 }}> (opcional)</span>}</label>
  );
  const ajuda = p.ajuda ? <div style={brS.ajuda}>{p.ajuda}</div> : null;
  let corpo = null;
  if (p.tipo === "texto") {
    corpo = <input style={brS.input} value={valor || ""} onChange={(e) => mudar(e.target.value)} autoComplete={p.auto || "off"} aria-required={obrig} />;
  } else if (p.tipo === "textolongo" || p.tipo === "links") {
    corpo = <textarea style={{ ...brS.input, minHeight: p.tipo === "links" ? 90 : 120, resize: "vertical" }} value={valor || ""} onChange={(e) => mudar(e.target.value)}
      autoCorrect={p.tipo === "links" ? "off" : undefined} autoCapitalize={p.tipo === "links" ? "off" : undefined} placeholder={p.tipo === "links" ? "https://…" : ""} aria-required={obrig} />;
  } else if (p.tipo === "numero") {
    corpo = <input style={{ ...brS.input, maxWidth: 160 }} inputMode={p.decimal ? "decimal" : "numeric"} value={valor == null ? "" : String(valor)}
      onChange={(e) => { const s = e.target.value.replace(p.decimal ? /[^\d,]/g : /\D/g, ""); if (s === "") return mudar(""); const n = Number(s.replace(",", ".")); mudar(p.max != null ? Math.min(n, p.max) : n); }} aria-required={obrig} />;
  } else if (p.tipo === "mes") {
    const naoSei = valor === "nao_sei";
    corpo = (
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input type="month" style={{ ...brS.input, maxWidth: 220 }} value={naoSei ? "" : (valor || "")} onChange={(e) => mudar(e.target.value)} disabled={naoSei} />
        {p.naoSei !== false && <button type="button" style={brS.chip(naoSei)} onClick={() => mudar(naoSei ? "" : "nao_sei")}>Não sei</button>}
      </div>
    );
  } else if (p.tipo === "unica") {
    const opc = opcoesDaPergunta(p, t);
    corpo = (
      <div style={{ display: "inline-block", maxWidth: "100%" }}>
        <div role="radiogroup" style={{ display: p.cartoes ? "grid" : "flex", gridTemplateColumns: "1fr", flexWrap: "wrap", gap: 8 }}>
          {opc.map((o) => (
            <button key={o.v} type="button" role="radio" aria-checked={valor === o.v} style={{ ...brS.chip(valor === o.v), ...(p.linha ? { minWidth: 52, textAlign: "center" } : {}) }}
              onClick={() => mudar(valor === o.v && !obrig ? "" : o.v)}>
              {o.t}{o.d && <div style={{ fontSize: 12.5, color: "#6b7280", fontWeight: 400, marginTop: 2 }}>{o.d}</div>}
            </button>
          ))}
        </div>
        {p.extremos && (
          <div data-br-extremos style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#6b7280", marginTop: 6 }}>
            <span>{p.extremos[0]}</span><span>{p.extremos[1]}</span>
          </div>
        )}
      </div>
    );
  } else if (p.tipo === "multipla") {
    const x = valor || {}, sel = x.sel || [];
    // "o que evita" não oferece o que já foi escolhido como "o que gosta"
    const jaEscolhidos = p.excluirDe ? (((r || {})[p.excluirDe] || {}).sel || []) : [];
    const tocar = (v) => {
      let n = sel.indexOf(v) >= 0 ? sel.filter((y) => y !== v) : sel.concat([v]);
      if (p.max && n.length > p.max) return;
      if (v === "nenhum" && n.indexOf("nenhum") >= 0) n = ["nenhum"]; else n = n.filter((y) => y !== "nenhum" || v === "nenhum");
      mudar({ ...x, sel: n });
    };
    corpo = (
      <div>
        <div style={{ display: p.cartoes ? "grid" : "flex", flexWrap: "wrap", gap: 8,
          gridTemplateColumns: opcoesDaPergunta(p, t).some((o) => o.img) ? "repeat(auto-fill, minmax(150px, 1fr))" : "1fr" }}>
          {opcoesDaPergunta(p, t).filter((o) => jaEscolhidos.indexOf(o.v) < 0 || sel.indexOf(o.v) >= 0).map((o) => (
            <button key={o.v} type="button" role="checkbox" aria-checked={sel.indexOf(o.v) >= 0}
              style={{ ...brS.chip(sel.indexOf(o.v) >= 0), ...(o.img ? { padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-start", alignItems: "stretch" } : {}) }} onClick={() => tocar(o.v)}>
              {o.img && <img src={o.img} alt="" loading="lazy" style={{ display: "block", width: "100%", aspectRatio: "16 / 10.5", objectFit: "cover", background: "#eef0f3" }} />}
              <div style={o.img ? { padding: "10px 14px" } : null}>
                {o.cores && (
                  <div aria-hidden="true" style={{ display: "flex", marginBottom: 6, borderRadius: 6, overflow: "hidden", border: "1px solid #e5e7eb", width: 120 }}>
                    {o.cores.map((c) => <span key={c} style={{ flex: 1, height: 22, background: c }} />)}
                  </div>
                )}
                {sel.indexOf(o.v) >= 0 ? "✓ " : ""}{o.t}{o.d && <div style={{ fontSize: 12.5, color: "#6b7280", fontWeight: 400, marginTop: 2 }}>{o.d}</div>}
              </div>
            </button>
          ))}
        </div>
        {p.outro && <input style={{ ...brS.input, marginTop: 10 }} placeholder="Outro (opcional)" value={x.outro || ""} onChange={(e) => mudar({ ...x, outro: e.target.value })} />}
      </div>
    );
  } else if (p.tipo === "escala") {
    const v = valor || {}, niveis = p.niveis || BR_PRIORIDADE;
    corpo = (
      <div style={{ display: "grid", gap: 10 }}>
        {itensDaEscala(p, t).map(([k, nome]) => (
          <div key={k} data-br-item={k} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 8 }}>{nome}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {niveis.map((n) => (
                <button key={n.v} type="button" style={{ ...brS.chip(v[k] === n.v), minHeight: 40, padding: "8px 12px", fontSize: 13.5 }}
                  onClick={() => mudar({ ...v, [k]: v[k] === n.v ? "" : n.v })}>{n.t}</button>
              ))}
            </div>
          </div>
        ))}
        {p.outro && <input style={brS.input} placeholder="Outro ambiente que precisa ter (opcional)" value={v._outro || ""} onChange={(e) => mudar({ ...v, _outro: e.target.value })} />}
      </div>
    );
  } else if (p.tipo === "rank3") {
    const opc = opcoesDoRank(t, r), lista = Array.isArray(valor) ? valor : [];
    corpo = opc.length === 0 ? <div style={brS.ajuda}>Marque os ambientes na tela anterior para escolher as prioridades.</div> : (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {opc.map((o) => {
          const i = lista.indexOf(o.v);
          return (
            <button key={o.v} type="button" style={brS.chip(i >= 0)} onClick={() => mudar(i >= 0 ? lista.filter((y) => y !== o.v) : (lista.length >= 3 ? lista : lista.concat([o.v])))}>
              {i >= 0 && <span style={{ display: "inline-block", minWidth: 22, height: 22, borderRadius: 11, background: BR_AZUL, color: "#fff", fontSize: 12.5, textAlign: "center", lineHeight: "22px", marginRight: 6 }}>{i + 1}</span>}
              {o.t}
            </button>
          );
        })}
      </div>
    );
  } else if (p.tipo === "lista") {
    const lista = Array.isArray(valor) ? valor : [];
    const qtd = p.qtdDe ? Math.max(0, Math.min(20, Number(r[p.qtdDe]) || 0)) : null;
    const itens = qtd != null ? Array.from({ length: qtd }, (_, i) => lista[i] || {}) : lista;
    const mudarItem = (i, campo, y) => { const n = itens.slice(); n[i] = { ...(n[i] || {}), [campo]: y }; mudar(n); };
    corpo = (
      <div style={{ display: "grid", gap: 10 }}>
        {qtd === 0 && <div style={brS.ajuda}>Informe quantas pessoas na pergunta acima.</div>}
        {itens.map((x, i) => (
          <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b style={{ fontSize: 13.5, color: "#374151" }}>{qtd != null ? `Pessoa ${i + 1}` : `${i + 1}`}</b>
              {qtd == null && <button type="button" style={{ ...brS.btnSec, minHeight: 36, padding: "4px 10px", fontSize: 13 }} onClick={() => mudar(itens.filter((_, j) => j !== i))}>Remover</button>}
            </div>
            {(p.campos || []).map((c) => (
              <div key={c.id}>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>{c.obrig && <span style={{ color: "#b91c1c" }}>* </span>}{c.rotulo}</div>
                {c.tipo === "unica"
                  ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{c.opcoes.map((o) => (
                      <button key={o.v} type="button" style={{ ...brS.chip((x || {})[c.id] === o.v), minHeight: 40, padding: "8px 12px", fontSize: 13.5 }} onClick={() => mudarItem(i, c.id, o.v)}>{o.t}</button>))}</div>
                  : <input style={brS.input} value={(x || {})[c.id] || ""} onChange={(e) => mudarItem(i, c.id, e.target.value)} />}
              </div>
            ))}
          </div>
        ))}
        {qtd == null && <button type="button" style={{ ...brS.btnSec, justifySelf: "start" }} onClick={() => mudar(itens.concat([{}]))}>+ Adicionar</button>}
      </div>
    );
  } else if (p.tipo === "consentimento") {
    corpo = (
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={valor === true} onChange={(e) => mudar(e.target.checked)} style={{ width: 22, height: 22, accentColor: BR_AZUL, marginTop: 1, flexShrink: 0 }} />
        <span style={{ fontSize: 14.5, lineHeight: 1.45 }}>{p.rotulo}</span>
      </label>
    );
    return <div data-br-pergunta={p.id} style={{ marginBottom: 26 }}>{ajuda}{corpo}</div>;
  }
  return (
    <div data-br-pergunta={p.id} style={{ marginBottom: 26, position: "relative" }}>
      {dica && <BrDica texto={dica} />}
      {rotulo}{ajuda}{corpo}
      {erro && <div style={brS.erro} role="alert">{erro}</div>}
    </div>
  );
}

function BrCabecalho({ ctx }) {
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
        {ctx.logo && <img src={ctx.logo} alt="" style={{ height: 34, maxWidth: 120, objectFit: "contain" }} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "#111827" }}>{ctx.escritorio || "Briefing do projeto"}</div>
          <div style={{ fontSize: 12.5, color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Briefing{ctx.referencia ? " · " + ctx.referencia : ""}</div>
        </div>
      </div>
    </div>
  );
}

// ── A página do cliente: /briefing/{token} ───────────────────────
function BriefingPublico({ token: tokenProp }) {
  const token = tokenProp || (typeof window !== "undefined" ? decodeURIComponent((window.location.pathname.split("/briefing/")[1] || "").split("/")[0]) : "");
  const [estado, setEstado] = useState({ carregando: true, erro: "", status: "", ctx: {}, enviadoEm: null });
  const [r, setR] = useState({});
  const [passo, setPasso] = useState(-1);          // -1 boas-vindas · n tela · "revisao" · "fim"
  const [erros, setErros] = useState({});
  const [salvo, setSalvo] = useState("");          // "", "salvando", "salvo", "falhou"
  const [confirmou, setConfirmou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const pendente = useRef(null), timer = useRef(null), topo = useRef(null);

  useEffect(() => {
    let vivo = true;
    brPublico("GET", token).then((d) => {
      if (!vivo) return;
      const tipo = tipoBriefingDoProjeto(d.contexto);
      const resp = { ...(d.respostas || {}) };
      if (!resp.tipo) resp.tipo = tipo;
      setR(resp);
      setEstado({ carregando: false, erro: "", status: d.status, ctx: d.contexto || {}, enviadoEm: d.enviadoEm, tipoPadrao: tipo });
      if (d.status === "enviado" || d.status === "validado") setPasso("fim");
    }).catch((e) => vivo && setEstado({ carregando: false, erro: e.message || "Não foi possível abrir o link." }));
    return () => { vivo = false; };
  }, [token]);

  const somenteLeitura = estado.status === "validado";
  function gravar(resp, extra) {
    pendente.current = null;
    setSalvo("salvando");
    return brPublico("PUT", token, { respostas: resp, respondente: resp.respondente || "", ...(extra || {}) })
      .then((d) => { setSalvo("salvo"); return d; })
      .catch((e) => { setSalvo("falhou"); if (e.status === 409) setEstado((x) => ({ ...x, status: "validado" })); throw e; });
  }
  function agendar(resp) {
    pendente.current = resp;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (pendente.current) gravar(pendente.current).catch(() => {}); }, 1200);
  }
  useEffect(() => {
    const sair = () => { if (pendente.current) gravar(pendente.current).catch(() => {}); };
    window.addEventListener("pagehide", sair);
    return () => { window.removeEventListener("pagehide", sair); clearTimeout(timer.current); };
  }, []);
  function mudar(id, v) {
    if (somenteLeitura) return;
    setR((atual) => { const n = { ...atual, [id]: v }; agendar(n); return n; });
    setErros((e) => (e[id] ? { ...e, [id]: "" } : e));
  }

  const telas = telasDoBriefing(r, estado.tipoPadrao);
  const t = contextoDoBriefing(r, estado.tipoPadrao);
  useEffect(() => { try { topo.current && topo.current.scrollIntoView({ block: "start" }); window.scrollTo(0, 0); } catch (e) {} }, [passo]);

  if (estado.carregando) return <div style={brS.pagina}><div style={{ ...brS.caixa, paddingTop: 60, textAlign: "center", color: "#6b7280" }}>Abrindo…</div></div>;
  if (estado.erro) return (
    <div style={brS.pagina}><div style={{ ...brS.caixa, paddingTop: 60, textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Não foi possível abrir este link</div>
      <div style={{ color: "#6b7280" }}>{estado.erro}. Peça um novo link ao escritório.</div>
    </div></div>
  );

  const ctx = estado.ctx || {};
  function irPara(n) {
    if (pendente.current) gravar(pendente.current).catch(() => {});
    setErros({}); setPasso(n);
  }
  function continuar() {
    const tela = telas[passo];
    const f = pendenciasDaTela(tela, r, estado.tipoPadrao);
    if (Object.keys(f).length) {
      setErros(f);
      const prim = document.querySelector(`[data-br-pergunta="${Object.keys(f)[0]}"]`);
      if (prim) prim.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    irPara(passo + 1 >= telas.length ? "revisao" : passo + 1);
  }
  async function enviar() {
    if (!confirmou || enviando) return;
    setEnviando(true);
    clearTimeout(timer.current);
    try {
      const d = await gravar(r, { enviar: true, confirmou: true });
      setEstado((x) => ({ ...x, status: d.status, enviadoEm: d.enviadoEm }));
      setPasso("fim");
    } catch (e) { setErros({ _envio: e.message || "Não foi possível enviar. Tente de novo." }); }
    setEnviando(false);
  }

  const rodape = (filhos) => (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "#fff", borderTop: "1px solid #e5e7eb", padding: "10px 16px calc(10px + env(safe-area-inset-bottom))", zIndex: 10 }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", gap: 10, alignItems: "center" }}>{filhos}</div>
    </div>
  );
  const indicador = (
    <div aria-live="polite" style={{ fontSize: 12.5, color: salvo === "falhou" ? "#b91c1c" : "#6b7280", minHeight: 18 }}>
      {salvo === "salvando" ? "Salvando…" : salvo === "salvo" ? "✓ Salvo — você pode parar e continuar depois pelo mesmo link" : salvo === "falhou" ? "Sem conexão — suas respostas serão salvas quando voltar" : ""}
    </div>
  );

  // Boas-vindas
  if (passo === -1) {
    const secoes = BRIEFING_SECOES.filter((s) => brVisivel(s, t, r));
    const jaComecou = Object.keys(r).filter((k) => k !== "tipo").length > 0;
    return (
      <div style={brS.pagina} data-br-tela="inicio">
        <BrCabecalho ctx={ctx} />
        <div style={brS.caixa}>
          <h1 style={{ fontSize: 22, margin: "18px 0 8px", lineHeight: 1.25 }}>{ctx.cliente ? `Olá, ${String(ctx.cliente).split(" ")[0]}!` : "Olá!"}</h1>
          <p style={{ fontSize: 15.5, lineHeight: 1.55, color: "#374151", margin: "0 0 14px" }}>
            Este questionário ajuda {ctx.escritorio || "o escritório"} a entender o que vocês precisam antes de começar o projeto.
            O essencial leva <b>cerca de 15 minutos</b>. Cada resposta é salva na hora: dá para parar e continuar depois pelo mesmo link.
          </p>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "6px 14px", marginBottom: 14 }}>
            {secoes.map((s, i) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderTop: i ? "1px solid #f3f4f6" : "none", fontSize: 14.5 }}>
                <span>{i + 1}. {s.titulo}</span>{s.opcional && <span style={{ color: "#9ca3af", fontSize: 13 }}>opcional</span>}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: "#6b7280", lineHeight: 1.5 }}>
            Privacidade: suas respostas ficam guardadas com {ctx.escritorio || "o escritório"} e são usadas somente para este projeto.
            Perguntas sobre saúde são opcionais e só aparecem com a sua autorização. Moradores são identificados por apelido e faixa etária.
          </p>
          {somenteLeitura && <p style={{ fontSize: 14, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: 10 }}>Este briefing já foi validado pelo escritório. Para mudar alguma resposta, fale com eles.</p>}
        </div>
        {rodape(<button style={{ ...brS.btn, flex: 1 }} onClick={() => {
          if (!jaComecou) return irPara(0);
          // volta para a primeira tela que ainda tem obrigatória em aberto
          const i = telas.findIndex((tl) => Object.keys(pendenciasDaTela(tl, r, estado.tipoPadrao)).length > 0);
          irPara(i >= 0 ? i : "revisao");
        }}>{jaComecou ? "Continuar de onde parei" : "Começar"}</button>)}
      </div>
    );
  }

  // Revisão
  if (passo === "revisao") {
    const pend = pendenciasDoBriefing(r, estado.tipoPadrao);
    const res = resumoDoBriefing(r, estado.tipoPadrao);
    return (
      <div style={brS.pagina} data-br-tela="revisao">
        <BrCabecalho ctx={ctx} />
        <div style={brS.caixa} ref={topo}>
          <h1 style={{ fontSize: 21, margin: "18px 0 6px" }}>Revise suas respostas</h1>
          <p style={{ fontSize: 14.5, color: "#4b5563", margin: "0 0 14px" }}>Toque em "Alterar" para corrigir. Depois, envie ao escritório.</p>
          {pend.length > 0 && (
            <div role="alert" style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 14 }}>
              <b>Faltam {pend.length} {pend.length === 1 ? "resposta obrigatória" : "respostas obrigatórias"}:</b>
              {pend.map((x) => (
                <div key={x.id} style={{ marginTop: 6 }}>
                  {x.secao} — {x.rotulo}{" "}
                  <button style={{ background: "none", border: "none", color: BR_AZUL, fontWeight: 600, cursor: "pointer", padding: 0, fontSize: 14 }} onClick={() => irPara(telas.findIndex((tl) => tl.chave === x.chave))}>Responder</button>
                </div>
              ))}
            </div>
          )}
          <BrResumoBlocos res={res} aoAlterar={(secaoId) => irPara(telas.findIndex((tl) => tl.secao.id === secaoId))} />
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginTop: 16, cursor: "pointer" }}>
            <input type="checkbox" checked={confirmou} onChange={(e) => setConfirmou(e.target.checked)} style={{ width: 22, height: 22, accentColor: BR_AZUL, flexShrink: 0 }} data-br-confirmo />
            <span style={{ fontSize: 14.5, lineHeight: 1.45 }}>Confirmo que estas respostas representam o que desejamos para o projeto.</span>
          </label>
          {erros._envio && <div style={brS.erro}>{erros._envio}</div>}
        </div>
        {rodape(<>
          <button style={brS.btnSec} onClick={() => irPara(telas.length - 1)}>Voltar</button>
          <button style={{ ...brS.btn, flex: 1, opacity: !confirmou || pend.length || enviando ? 0.5 : 1 }} disabled={!confirmou || pend.length > 0 || enviando} onClick={enviar} data-br-enviar>
            {enviando ? "Enviando…" : "Enviar ao escritório"}
          </button>
        </>)}
      </div>
    );
  }

  // Enviado / validado
  if (passo === "fim") {
    return (
      <div style={brS.pagina} data-br-tela="fim">
        <BrCabecalho ctx={ctx} />
        <div style={{ ...brS.caixa, textAlign: "center", paddingTop: 40 }}>
          <div style={{ fontSize: 44, color: "#16a34a" }}>✓</div>
          <h1 style={{ fontSize: 21, margin: "8px 0" }}>{estado.status === "validado" ? "Briefing validado" : "Briefing enviado"}</h1>
          <p style={{ fontSize: 15, color: "#4b5563", lineHeight: 1.55 }}>
            {estado.status === "validado" ? `${ctx.escritorio || "O escritório"} já validou o briefing. Para mudar alguma resposta, fale com eles.`
              : `Obrigado! ${ctx.escritorio || "O escritório"} recebeu suas respostas e vai conversar com você sobre elas. Enquanto não for validado, você ainda pode ajustar.`}
          </p>
          {estado.status !== "validado" && <button style={{ ...brS.btnSec, marginTop: 10 }} onClick={() => irPara("revisao")}>Ver ou ajustar respostas</button>}
        </div>
      </div>
    );
  }

  const tela = telas[passo];
  if (!tela) { setTimeout(() => setPasso("revisao"), 0); return null; }
  let grupoAnterior = "";
  return (
    <div style={brS.pagina} data-br-tela={tela.chave}>
      <BrCabecalho ctx={ctx} />
      <div style={brS.caixa} ref={topo}>
        <div style={{ fontSize: 13, color: "#6b7280", margin: "14px 0 4px" }}>Seção {tela.nSecao} de {tela.totalSecoes}{tela.secao.opcional ? " · opcional" : ""}</div>
        <h1 style={{ fontSize: 21, margin: tela.tela.nota ? "0 0 8px" : "0 0 18px" }}>{tela.tela.titulo || tela.secao.titulo}</h1>
        {tela.tela.nota && <p data-br-nota style={{ fontSize: 14.5, color: "#374151", lineHeight: 1.5, background: "#eef5ff", border: "1px solid #cfe1ff", borderRadius: 10, padding: "10px 12px", margin: "0 0 20px" }}>{typeof tela.tela.nota === "function" ? tela.tela.nota(t) : tela.tela.nota}</p>}
        {tela.perguntas.map((p) => {
          const cab = p.grupo && p.grupo !== grupoAnterior ? <div key={p.id + "_g"} style={{ fontSize: 13, fontWeight: 700, color: BR_AZUL, textTransform: "uppercase", letterSpacing: 0.5, margin: "6px 0 10px" }}>{p.grupo}</div> : null;
          grupoAnterior = p.grupo || "";
          return <div key={p.id}>{cab}<BrPergunta p={p} t={t} r={r} valor={r[p.id]} mudar={(v) => mudar(p.id, v)} erro={erros[p.id]} /></div>;
        })}
        {indicador}
      </div>
      {rodape(<>
        <button style={brS.btnSec} onClick={() => irPara(passo === 0 ? -1 : passo - 1)}>Voltar</button>
        <button style={{ ...brS.btn, flex: 1 }} onClick={continuar} data-br-continuar>{tela.secao.opcional && tela.perguntas.every((p) => brVazio(r[p.id])) ? "Pular" : "Continuar"}</button>
      </>)}
    </div>
  );
}

// Os blocos do resumo — usados na revisão do cliente e na tela do escritório.
function BrResumoBlocos({ res, aoAlterar }) {
  const caixa = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 14px", marginBottom: 12 };
  const prog = res.programa || {};
  return (
    <div data-br-resumo>
      {(prog.essencial.length > 0 || prog.desejavel.length > 0 || prog.outros) && (
        <div style={caixa}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <b style={{ fontSize: 15 }}>Programa</b>
            {aoAlterar && <button style={{ background: "none", border: "none", color: BR_AZUL, fontWeight: 600, cursor: "pointer", fontSize: 14 }} onClick={() => aoAlterar("programa")}>Alterar</button>}
          </div>
          {prog.essencial.length > 0 && <div style={{ fontSize: 14, marginTop: 4 }}><b style={{ color: "#166534" }}>Essencial:</b> {prog.essencial.join(", ")}</div>}
          {prog.desejavel.length > 0 && <div style={{ fontSize: 14, marginTop: 4 }}><b style={{ color: "#1e40af" }}>Desejável:</b> {prog.desejavel.join(", ")}</div>}
          {prog.outros && <div style={{ fontSize: 14, marginTop: 4 }}><b>Outros:</b> {prog.outros}</div>}
        </div>
      )}
      {res.secoes.map((s) => (
        <div key={s.id} style={caixa}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <b style={{ fontSize: 15 }}>{s.titulo}</b>
            {aoAlterar && <button style={{ background: "none", border: "none", color: BR_AZUL, fontWeight: 600, cursor: "pointer", fontSize: 14 }} onClick={() => aoAlterar(s.id)}>Alterar</button>}
          </div>
          {s.itens.map((x) => (
            <div key={x.id} style={{ padding: "6px 0", borderTop: "1px solid #f3f4f6", fontSize: 14 }}>
              <div style={{ color: "#6b7280", fontSize: 12.5 }}>{x.rotulo}</div>
              <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{x.valor}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Lado do escritório: o briefing de um projeto ─────────────────
const BR_STATUS = {
  sem: { t: "Briefing não enviado", c: "#6b7280", bg: "#f3f4f6" },
  aguardando: { t: "Briefing: link criado", c: "#92400e", bg: "#fef3c7" },
  preenchendo: { t: "Cliente preenchendo", c: "#1e40af", bg: "#dbeafe" },
  enviado: { t: "Briefing recebido", c: "#166534", bg: "#dcfce7" },
  validado: { t: "Briefing validado ✓", c: "#fff", bg: "#16a34a" },
};
function linkDoBriefing(token) {
  const base = typeof window !== "undefined" ? window.location.origin : "https://www.vicke.com.br";
  return `${base}/briefing/${token}`;
}
function BriefingStatusChip({ briefing }) {
  const st = BR_STATUS[(briefing && briefing.status) || "sem"] || BR_STATUS.sem;
  return <span data-br-status={(briefing && briefing.status) || "sem"} style={{ display: "inline-block", fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 10, color: st.c, background: st.bg }}>{st.t}</span>;
}

function BriefingDoProjeto({ projeto, cliente, briefing, aoMudar, aoFechar, aoAvancar }) {
  const [ocupado, setOcupado] = useState("");
  const [aviso, setAviso] = useState("");
  const tipoPadrao = tipoBriefingDoProjeto(projeto);
  const b = briefing || null;
  const res = b && b.respostas ? resumoDoBriefing(b.respostas, tipoPadrao) : null;
  const temResposta = !!(b && b.respostas && Object.keys(b.respostas).filter((k) => k !== "tipo").length);
  const link = b ? linkDoBriefing(b.token) : "";
  const nome = (cliente && cliente.nome) || "";
  const fone = String((cliente && (cliente.telefone || cliente.whatsapp || cliente.celular)) || "").replace(/\D/g, "");
  const msg = `Olá${nome ? ", " + nome.split(" ")[0] : ""}! Para começarmos o projeto${projeto.referencia ? " (" + projeto.referencia + ")" : ""}, preencha este briefing — leva uns 15 minutos e salva sozinho, dá para parar e continuar depois: ${link}`;

  async function criar() {
    setOcupado("criar"); setAviso("");
    try { aoMudar(await api.briefings.criar(projeto.orcId)); } catch (e) { setAviso(e.message || "Não foi possível criar o link."); }
    setOcupado("");
  }
  async function acao(qual) {
    if (qual === "zerar") {
      const ok = await dialogo.confirmar({
        titulo: "Apagar este briefing?",
        mensagem: "As respostas são apagadas, o link atual deixa de funcionar e o projeto volta a \"Briefing não enviado\". Para mandar ao cliente, gere um link novo. Não dá para desfazer.",
        confirmar: "Apagar briefing", destrutivo: true,
      });
      if (!ok) return;
    }
    setOcupado(qual); setAviso("");
    try { const nb = await api.briefings.acao(b.token, qual); aoMudar(nb); if (qual === "validar" && aoAvancar) aoAvancar(); }
    catch (e) { setAviso(e.message || "Não foi possível."); }
    setOcupado("");
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(link); setAviso("Link copiado."); } catch (e) { setAviso(link); }
  }
  const fmt = (iso) => iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  const btn = { padding: "8px 12px", borderRadius: 8, border: "1.5px solid #d1d5db", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "#111827" };
  const btnAzul = { ...btn, background: BR_AZUL, borderColor: BR_AZUL, color: "#fff" };

  return (
    <div onClick={aoFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 12px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} data-br-painel style={{ background: "#f6f7f9", borderRadius: 16, width: "100%", maxWidth: 720, boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ background: "#fff", borderRadius: "16px 16px 0 0", padding: "16px 18px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Briefing do cliente</div>
            <div style={{ fontSize: 12.5, color: "#6b7280" }}>{nome || "—"}{projeto.referencia ? " · " + projeto.referencia : ""}</div>
            <div style={{ marginTop: 6 }}><BriefingStatusChip briefing={b} /></div>
          </div>
          <button onClick={aoFechar} aria-label="Fechar" style={{ background: "none", border: "none", fontSize: 22, color: "#9ca3af", cursor: "pointer", alignSelf: "flex-start" }}>×</button>
        </div>
        <div style={{ padding: 16 }}>
          {!b ? (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 10 }}>
                Gere o link e mande para o cliente. Ele responde pelo celular, sem login, com as perguntas certas para o tipo de projeto
                ({(BR_TIPOS.find((x) => x.v === tipoPadrao) || {}).t}). Cada resposta salva sozinha.
              </div>
              <button style={btnAzul} disabled={!!ocupado} onClick={criar} data-br-criar>{ocupado ? "Gerando…" : "Gerar link do briefing"}</button>
            </div>
          ) : (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 4 }}>Link do cliente</div>
              <div data-br-link style={{ fontSize: 13, fontFamily: "ui-monospace, monospace", background: "#f3f4f6", borderRadius: 8, padding: "8px 10px", overflowWrap: "anywhere", marginBottom: 10 }}>{link}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={btn} onClick={copiar}>Copiar link</button>
                <a style={{ ...btn, textDecoration: "none", display: "inline-block" }} target="_blank" rel="noreferrer"
                  href={`https://wa.me/${fone ? (fone.length <= 11 ? "55" + fone : fone) : ""}?text=${encodeURIComponent(msg)}`}>Enviar pelo WhatsApp</a>
                <a style={{ ...btn, textDecoration: "none", display: "inline-block" }} target="_blank" rel="noreferrer" href={link}>Abrir como o cliente</a>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 10, lineHeight: 1.5 }}>
                {b.enviadoEm ? `Enviado pelo cliente em ${fmt(b.enviadoEm)}${b.respondente ? " por " + b.respondente : ""}.` : b.atualizadoClienteEm ? `Última resposta em ${fmt(b.atualizadoClienteEm)}.` : "O cliente ainda não abriu."}
                {b.validadoEm ? ` Validado em ${fmt(b.validadoEm)}${b.validadoPor ? " por " + b.validadoPor : ""}.` : ""}
              </div>
            </div>
          )}
          {aviso && <div style={{ fontSize: 13, color: "#374151", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 10px", marginBottom: 12, overflowWrap: "anywhere" }}>{aviso}</div>}

          {res && temResposta && (
            <>
              {res.atencao.length > 0 && (
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 13.5 }}>
                  <b>Para a reunião</b>
                  {res.atencao.map((x, i) => <div key={i} style={{ marginTop: 4 }}>• {x}</div>)}
                </div>
              )}
              {b.status !== "enviado" && b.status !== "validado" && (
                <div style={{ fontSize: 12.5, color: "#1e40af", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "8px 10px", marginBottom: 12 }}>O cliente ainda está respondendo — o resumo abaixo é parcial.</div>
              )}
              <BrResumoBlocos res={res} />
            </>
          )}
        </div>
        {b && (
          <div style={{ background: "#fff", borderTop: "1px solid #e5e7eb", borderRadius: "0 0 16px 16px", padding: "12px 16px", display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button style={{ ...btn, color: "#b91c1c", marginRight: "auto" }} disabled={!!ocupado} onClick={() => acao("zerar")} data-br-zerar>{ocupado === "zerar" ? "Apagando…" : "Apagar briefing"}</button>
            {temResposta && <button style={btn} onClick={() => window.print()}>Imprimir</button>}
            {b.status === "validado"
              ? <button style={btn} disabled={!!ocupado} onClick={() => acao("reabrir")} data-br-reabrir>{ocupado === "reabrir" ? "Reabrindo…" : "Reabrir para o cliente"}</button>
              : <>
                  {b.status === "enviado" && <button style={btn} disabled={!!ocupado} onClick={() => acao("reabrir")}>Pedir ajustes ao cliente</button>}
                  <button style={{ ...btnAzul, opacity: b.status === "enviado" ? 1 : 0.6 }} disabled={!!ocupado || !temResposta} onClick={() => acao("validar")} data-br-validar
                    title={b.status === "enviado" ? "" : "O cliente ainda não enviou — validar mesmo assim trava o formulário"}>
                    {ocupado === "validar" ? "Validando…" : aoAvancar ? "Validar e passar para Estudo Preliminar" : "Validar briefing"}
                  </button>
                </>}
          </div>
        )}
      </div>
    </div>
  );
}

// Expõe para main.jsx (rota /briefing/{token}, fora do app logado)
if (typeof window !== "undefined") {
  window.BriefingPublico = BriefingPublico;
}
