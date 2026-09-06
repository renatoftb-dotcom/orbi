# SPEC — Cronograma de obra

Prazo, rede de etapas, produtividade e físico-financeiro da obra, na tela
Gestão de obra → Cronograma (`CronogramaObraView`, botão do painel da obra;
lê `obra.projeto` e `obra.orcamento`, e manda preencher o orçamento quando
não há projeto). Complementa `SPEC-ORCAMENTO-OBRA.md`; a análise que motivou o
desenho está em `referencia-orcamento/ANALISE-CRONOGRAMA.md`.

Arquivos: `src/modules/cronograma-seed.jsx` (tabelas editáveis),
`src/modules/cronograma-obra.jsx` (motor puro + UI), `cronograma-obra.test.mjs`.
O Gantt que já existia no VICKE é de projetos de arquitetura; este é de obra.

## 1. Dois jeitos de dar prazo, uma rede só

**Simplificado.** O prazo total vem da tabela área construída × tipologia do
modelo antigo (`PRAZO_TABELA_SEED`: 60 m² 6,6 meses … 400 m² 22; sobrado
+1,5), ou de um prazo-alvo digitado na obra. As etapas têm uma
*duração-base* em meses (pesos herdados do modelo antigo) e um fator único,
achado por bisseção, escala todas até o caminho crítico fechar exatamente no
prazo. Três distorções do modelo antigo corrigidas: a área é interpolada
entre as linhas da tabela (125 m² → 13,8, não 14,3 da faixa de 150) e
extrapolada acima de 400 m²; o fator não é mais `prazo/10 × 0,85` com
arredondamento para meses inteiros — é calibrado no próprio caminho crítico;
e cada etapa pode ter várias predecessoras.

**Por produtividade.** Cada etapa soma as horas-homem dos serviços que a
compõem: quantidade medida da obra × horas por unidade por ofício
(`PRODUTIVIDADE_SEED`, composições analíticas SINAPI base SP jul/2026, com o
código de origem em `fonte`). A duração é a do ofício mais carregado:
`HH ÷ (equipe × 8 h × eficiência)`, em dias úteis, mínimo 1. Etapa sem
serviço medido (pré-obra, impermeabilizações, acabamento final, limpeza) usa
a duração paramétrica do modo simplificado. Eficiência padrão 75% (obra
residencial rende menos que a referência SINAPI); o escritório calibra com o
realizado.

**Prazo → equipe.** Dado o prazo-alvo, um multiplicador único sobre a equipe
é achado por bisseção até o caminho crítico caber no prazo; a equipe
necessária é o arredondamento para cima por ofício (só dos ofícios com
horas) e o prazo é recalculado com ela. "Usar essa equipe" copia para a
configuração. Se nem 20× a equipe fecha o prazo, as etapas paramétricas são
o limite — aviso.

## 2. Medições (`medicoesCronograma`)

Nada é digitado a mais: as quantidades saem dos mesmos campos do orçamento
(`normalizarProjeto`). Por etapa: fundação (m de broca, m³ de vala no
perímetro, m³ de concreto, kg de aço convertido dos metros por bitola, m² de
fôrma das faces do baldrame), alvenaria (m² por pavimento, m de vergas,
pilares: concreto, aço e fôrma pelo perímetro × 2,80 m), lajes (m²
treliçada, viga de respaldo), cobertura (área inclinada por tipo de telha via
`calcularTelhado`, madeiramento), instalações (pontos de luz e tomada dos
`ambientes` × `AMBIENTES_TIPOS`, conjuntos hidráulicos/esgoto por banheiro =
1 e cozinha/lavanderia = 0,5), reboco e pintura (mesmas faces do orçamento),
contrapisos, calçadas, muro de divisa (alvenaria + duas faces de reboco),
arrimo, piscina, revestimentos (azulejo do projeto, piso = área construída),
forro de gesso (área construída — zerar o serviço se não houver), esquadrias
(Σ qtd × L × H) e portas (cômodos com kit de porta). Cada medição carrega
`nota` quando é uma aproximação. Aba "Serviços medidos" mostra tudo.

## 3. Rede e CPM

`ETAPAS_CRONOGRAMA_SEED`: 25 etapas em três grupos (Bruto, Acabamento,
Externa), cada uma com `predecessoras` (`FS` = começa quando a anterior
termina, `lag` em dias úteis, pode ser negativo; `SS` = começa quando a
anterior atingiu `avanco` da duração), `condicao` (sobrado, arrimo, muro,
piscina, pavimentacao) e o mapeamento de custo (`custoOrdens` /
`custoEtapas` → linhas do orçamento). Etapa que não existe na obra sai da
rede e suas predecessoras passam às sucessoras (`resolverRedeCronograma`).
`cpmCronograma` faz a ordenação topológica, passagem à frente (ES/EF), para
trás (LS/LF), folga e caminho crítico; detecta ciclo.

Calendário: dias úteis a partir da data de início, sem fins de semana nem
feriados nacionais (fixos + carnaval, sexta santa e Corpus Christi pela
Páscoa). `DIAS_UTEIS_MES = 21` converte meses ↔ dias.

## 4. Físico-financeiro

O custo de cada etapa do orçamento (por `etapa`, depois por `ordem`; o nome
vence porque "Contrapiso Interno Pav 1" compartilha a ordem do térreo) é
distribuído por dia útil ao longo da etapa no cronograma; prestadores e
itens sem etapa são diluídos pela obra inteira. Saída: desembolso por mês,
acumulado e % (curva S). Ainda não realimenta as locações por mês do
orçamento (próximo passo) nem cruza com o realizado do P&L.

## 4b. Mão de obra de referência (HH × R$/h)

`PRECO_HORA_SEED`: preço da hora por ofício das composições SINAPI "<ofício>
com encargos complementares" (SP jul/2026, desonerado e onerado; gesseiro =
montador de forro 88278). `maoDeObraReferencia` multiplica as HH de cada
serviço medido pelo R$/h do ofício e agrupa pelo prestador do orçamento que
executa aquele serviço (`PRESTADOR_POR_ETAPA` vence `PRESTADOR_POR_SERVICO`:
muro, arrimo, piscina e pavimentação têm o seu pedreiro; forro não tem
prestador). Saída na aba "Mão de obra (SINAPI)": por prestador, HH, custo
SINAPI (produtividade de referência), custo com a eficiência da equipe
(÷ eficiência), valor contratado no orçamento (linha "Prestadores de
serviços" pelo nome do insumo em `INSUMO_PRESTADOR`) e a diferença; total e
R$/m². Regime por obra (`cronograma.regimeHora`) ou padrão do escritório; R$/h
do escritório por ofício em Insumos → Composições → Produtividade
(`escritorio.cronograma.precoHora`). É referência: o empreiteiro embute lucro
e risco, e elétrica/hidráulica só medem pontos por ambiente.

## 5. Configuração e persistência

Na obra (`obra.cronograma`, gravado por "Salvar cronograma"): `dataInicio`,
`modo`, `prazoAlvoMeses` (0 = tabela), `equipe {oficio: n}`, `eficiencia`,
mais o resumo `prazoMeses / dataFim / geradoEm`. O bloco recalcula ao vivo a
partir de `obra.projeto` e `obra.orcamento`.

No escritório (`data.escritorio.cronograma`, editado em Insumos →
Composições): `prazoTabela` e `sobradoExtra` (aba Cronograma), `etapas
{id: {duracaoBase}}` (aba Cronograma) e `servicos {id: {horas}}` (aba
Produtividade, com Restaurar). Só o que foi editado é gravado; o resto vem
da semente.

## 6. Testes

`cronograma-obra.test.mjs` (31): tabela interpolada e do escritório; rede
térrea × sobrado e integridade da semente; CPM (FS, SS, lag negativo, folga,
crítico); calendário (7 de setembro, carnaval, sexta santa); medições
(alvenaria, aço em kg, conjuntos hidráulicos, telhado por tipo, esquadrias);
simplificado fecha no prazo da tabela e no prazo-alvo; produtividade
(HH, equipe necessária cumpre o alvo, equipe maior/eficiência menor);
overrides do escritório; físico-financeiro (mapeamento de custo, soma,
curva monotônica) com o orçamento real do motor; mão de obra (preço da hora para todo ofício, prestador por serviço/etapa, HH × R$/h, onerado > desonerado, R$/h do escritório, comparação com o prestador orçado).

## 7. Próximos passos

Realimentar locações, gestão de obra e caçambas por mês a partir do prazo;
baseline × realizado (datas reais por etapa, % executado) e curva S
realizada com o P&L; lista de compras por mês; calibração da eficiência e
das durações-base com as obras entregues.
