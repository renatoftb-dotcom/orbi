# SPEC — Instalações, louças e portas no orçamento de obra

Cobre o que a planilha de quantitativos nunca cobriu: hidráulica (água fria e
quente), esgoto, elétrica, louças e metais, aquecimento/pressurização e portas
internas. Complementa `SPEC-ORCAMENTO-OBRA.md`.

## 1. Dois graus de estimativa, o projeto substitui o kit

O mercado trabalha em três graus: paramétrico (R$/m²), preliminar por
ambientes e pontos (composições paramétricas — é o que o SINAPI publica desde
2022/2023: "conjunto de pontos hidráulicos de água fria para banheiro" 104660,
esgoto 104676, ponto de tomada 104475, ponto de luz 104473…) e analítico
(levantamento do projeto executivo). O VICKE implementa os dois últimos com
o mesmo catálogo de Insumos:

- **Estimativa por ambientes** (`instalacoesPorAmbiente`): a obra informa
  quantos ambientes de cada tipo tem (`projeto.ambientes`), o padrão
  Médio/Alto, o aquecimento e se há pressurizador (`projeto.instalacoes`).
  Cada tipo de ambiente puxa kits por disciplina; cada cômodo tem um número
  padrão de pontos elétricos; sistemas entram por obra.
- **Itens do projeto** (`itensProjeto`): a lista do projeto de engenharia,
  colada ou digitada. Ao marcar a disciplina em
  `projeto.instalacoes.doProjeto`, a estimativa por kits daquela disciplina
  sai do orçamento. Se a lista existe e a disciplina não está marcada, a UI
  avisa "soma com o projeto".

## 2. Kits (composições)

`src/modules/composicoes-seed.jsx`: `COMPOSICOES_SEED` (kits), `AMBIENTES_TIPOS`
(tipos de cômodo com kits, pontos e se é molhado), `PONTOS_ELETRICOS`,
`SISTEMAS_AQUECIMENTO`, `COMPOSICOES_DISCIPLINAS`. Kit =
`{ nome, disciplina, base: "ambiente"|"ponto"|"obra", fonte, requer?, itens: [{ nome, qtd, unidade }] }`.
Sufixo `_ALTO` = variante escolhida automaticamente no padrão Alto.
`requer: "aquecimento"` = só entra quando há aquecimento central (gás/solar).

Quantidades de partida: SINAPI adaptado para residência unifamiliar (o ramal
de 40 mm do prédio virou 25/32 mm), louças/metais da matriz do modelo antigo,
portas por cômodo fechado. **As quantidades do SINAPI já incluem perdas — o
motor não aplica PERDA em cima.** Circuitos: 1 disjuntor 10A a cada 8 pontos
de luz, 1 de 20A a cada 6 tomadas gerais (calculados, não são kit).

Nomes dos itens = nomes do cadastro do escritório (101 dos 103 existem; os
dois do aquecedor a gás entram sem preço até serem cadastrados). Louças e
metais genéricos seguem o **padrão da obra** (MCMV/Baixo/Médio/Alto/Altíssimo):
o item do kit leva o marcador `{padrão}` no nome ("Louças - Sanitário padrão
{padrão}") e o motor (`nomeItemKit`) troca pelo padrão em vigor; a semente tem
um insumo por padrão (LOU-101…150: sanitário, cuba, tanque, torneira de
lavatório, torneira de cozinha, chuveiro, ducha higiênica, acabamento de
registro e de válvula, acabamento do chuveiro), com preço de referência de
mercado e o Médio igual ao modelo antigo. Abaixo de Alto o chuveiro é
misturador (base LOU-043 + acabamento); nos kits `_ALTO` (Alto e Altíssimo),
monocomando (base LOU-048 + acabamento). Box, sifões e bases mantêm o preço
do cadastro. A compra real atualiza o genérico quando lançada com o nome
dele como alias.

## 3. Edição pelo escritório

Insumos → **Composições**: aba Kits (por disciplina; nome com autocompletar do
catálogo, quantidade, unidade; status "não está em Insumos" / código + preço;
Restaurar padrão) e aba Pontos elétricos por cômodo. Tudo gravado em
`data.escritorio.composicoes = { kits: { id: { itens } }, ambientes: { id: { pontos } } }`
— só o que foi editado; o resto continua vindo da semente (`composicoesAtivas`,
`ambientesAtivos`). Não há tabela nova no Postgres.

## 4. Saída

Uma linha por item por disciplina, somando todos os ambientes
(`subEtapa: "Estimativa por ambientes"`), nas etapas de projeto (ordens
18–24: Hidráulica, Esgoto, Elétrica, Louças e metais, Aquecimento, Outros,
Portas internas). Metros arredondados para 0,1; unidades para cima. Preço pelo
catálogo como qualquer item; sem cadastro → R$ 0 e "preços que merecem atenção".

## 5. Testes

`orcamento-obra.test.mjs` (41): integridade semente ↔ ambientes ↔ pontos;
casa de referência (soma por item, 3 sanitários, 10 registros, 7 portas, 21
dobradiças, 2 circuitos de chuveiro); padrão Alto e solar/pressurizador;
disciplina "do projeto"; kit editado vence a semente.
`insumos.test.mjs` (34): semente 127.

## 6. Próximos passos naturais

Calibrar os kits com o realizado das obras (comparar estimado × comprado por
disciplina), pluvial (calhas já estão na cobertura; condutores não), e
padrão de acabamento único entre revestimentos, esquadrias e instalações.
