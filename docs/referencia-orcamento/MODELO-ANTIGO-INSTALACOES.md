# Como o modelo antigo (`Base Orçamento Obra.xlsm`) tratava instalações, louças e portas

Leitura de referência, **não é spec**. As fórmulas e preços daqui não entram no
VICKE; o que importa é a mecânica de entrada e a estrutura dos itens.

Mecânica geral: formulários VBA (`HIDRO`, `HIDRO_ITENS`, `HIDRO_CONEXOES`,
`ELÉTRICA_*`, `LOUCAS_TORNEIRAS`, `PORTAS_INTERNAS`, `AMBIENTES`, …) gravam
nas abas de cada disciplina; botões "Gravar parcial/final" consolidam tudo em
`RESUMO TOTAL` (Item · Unidade · Qtd · Preço · Total · Etapa). Etapas usadas:
`Bruto - Esgoto e pluvial`, `Bruto - Hidráulica`, `Bruto - Elétrica`,
`Equipamentos - Aquecimento e pressurização casa`, `Acabamentos - Louças, Metais
e cubas`, `Acabamentos - Portas internas`, `Acabamentos - Acabamento elétrico e
luminárias`, `Acabamentos - Forros`, `Acabamentos - Soleiras e Peitoris`,
`Acabamentos - Bancadas`.

## 1. PVC — item a item, mas com montador de nome

Quatro sistemas, escolhidos por botão: **Esgoto**, **Alimentação Água Fria**,
**Água Quente** e **SISTEMAS** (equipamentos de aquecimento/pressurização).

- **Tubos** (`HIDRO_ITENS`): escolhe a bitola numa lista e digita a quantidade
  (até 7 tubos por sistema).
- **Conexões** (`HIDRO_CONEXOES`): não se digita o nome — o usuário escolhe a
  família num botão e o formulário libera só os campos que fazem sentido
  (Tipo, Grau, Complemento, Bitola) e monta o nome no padrão do cadastro:
  `"PVC - " & sistema & " - " & família & [grau] & [tipo] & [complemento] & bitola`
  → ex.: `PVC - Esgoto - Joelho 90° 100mm`, `PVC - Alimentação Água Fria - Luva
  25mm C/ Bucha latão`.

Famílias e opções por sistema (as listas do formulário):

| Família | Esgoto | Água fria | Água quente |
|---|---|---|---|
| Tubo | 40/50/75/100/150 | 20/25/32/50 | 22/28 |
| Joelho | 45°/90°; 40, 40x38, 50, 75, 100, 150; compl. "C/ Anel" | 45°/90°; 25, 32, 50, 25x20, 25x50; compl. "C/ Bucha latão" | 45°/90°; 22, 28; tipo Normal/Transição |
| Curva | Curta/Longa; 45°/90°; 40…150 | Curta/Longa; 45°/90°; 25, 32, 50 | "Curva de Transposição" 22/28 |
| Tê | 50, 75, 100, 150, 100x50, 100x75, 150x100 | 25, 32, 50, 25x50, 32x25, 50x25; compl. "C/ Bucha latão" | 22, 28 |
| Luva | 50…150 | 25, 25x20, 25x50, 32, 50; compl. "C/ Bucha latão"/"Roscável" | 22, 28; tipo Simples/Transição |
| Junção / União | Junção 40, 50, 100, 150, 100x75, 150x100 | União 20, 25, 32, 50 | — |
| Bucha | Redução 32x25, 50x40 | Curta/Longa 25x20, 32x25 | 28x22 |
| Redução excêntrica | 50x75, 75x50, 100x50, 100x75, 150x100 | — | — |
| Anel de vedação | 40…150 | — | — |
| Caixas | Gordura/Sifonada/Inspeção/Prolongador; 30, 40, 50 cm, 100x100x50, 150x150x50, 150x185x50, 30x30, 60x60, 80x80 | — | — |
| Adaptador | — | 20, 25, 32, 50; Bol/Rosca ou C/ Flange | — |
| Cap | — | 20, 25, 32, 50 | 22, 28 |
| Conector | — | — | 22, 28 |

Etapa: esgoto → `Bruto - Esgoto e pluvial`; água fria e quente → `Bruto -
Hidráulica`; sistemas → `Equipamentos - Aquecimento e pressurização casa`.

## 2. Elétrica — três formulários, quantidades digitadas

- **Cabos** (`ELÉTRICA_CABOS`): grade bitola × cor. Bitolas 1,5 · 2,5 · 4 · 6 ·
  10 · 16 · 25 · 35 · 50 mm²; cores preto, azul, vermelho, verde, amarelo,
  branco, cinza; metros por célula; total por bitola = soma das cores. Item
  emitido: `Elétrica - Cabo Flex Cobre 2.5mm` (Mts).
- **Eletrodutos e caixas** (`ELÉTRICA_ELETRODUTOS`): corrugado Kanaflex 3'',
  2'', 1.1/2'', 1.1/4'', 1''; corrugado laranja 1'' e ¾''; corrugado amarelo ¾''
  (Mts); caixas 4x2'', 4x4'', octogonal (Unidade).
- **Disjuntores e quadros** (`ELÉTRICA_DISJUNTORES_QUADROS`): disjuntor 20A
  unipolar (2 linhas), 32A e 40A bipolar, 50A/80A/125A tripolar; quadro 100A
  embutir N disjuntores (N escolhido em combo — 18/28/34…), quadro de dados
  30x30, quadro 10x10, poste padrão C1 bipolar cabo 16 disj. 63A.
- Tudo em `Bruto - Elétrica`. **Luminárias** entram por outro caminho: "Pontos
  de iluminação" na aba GERAL vira `Elétrica - Luminárias` × preço unitário, e
  `Elétrica - Interruptores e tomadas` é uma verba em unidades — ambos em
  `Acabamentos - Acabamento elétrico e luminárias`.

## 3. Louças e metais — matriz ambiente × item, com padrão Médio/Alto

O usuário só escolhe os **ambientes da casa** (lista fixa de 44: WC Dorm 1–5,
WC Social 1–3, Lavabo, Lavabo Lazer, Cozinha, Lavanderia, Área de lazer,
Louceiro, Sauna, Jardim 1–6, Varal/A. Técnica…, cada um marcado Seca/Molhada) e
o **padrão** (`Médio` ou `Alto`, o mesmo "Padrão Revestimento" da aba GERAL). A
aba `Louças e Metais` tem uma matriz fixa ambiente × 22 itens; a quantidade
final de cada item é a soma dos ambientes escolhidos.

Kits (padrão Médio; entre parênteses o que muda no Alto):

- **WC Dorm / WC Social**: 2 registros gaveta · 1 válvula descarga + acabamento ·
  1 misturador chuveiro + acabamento (Alto: monocomando em vez de misturador;
  WC Dorm 1 leva 2) · 1 chuveiro · 1 ducha higiênica · 1 torneira WC (WC Dorm 1
  Alto: 2) · 1 sanitário · 1 cuba louça (WC Dorm 1 Alto: 2) · 1 sifão flexível
  (Alto: sifão metálico) · 1 box · (Alto: + 1 ralo oculto).
- **Lavabo**: 2 registros gaveta · válvula + acabamento · ducha higiênica ·
  torneira WC · sanitário · cuba louça (sem chuveiro, sem box).
- **Lavabo Lazer**: igual a WC (com chuveiro e box).
- **Cozinha / Área de lazer**: 2 registros gaveta · 1 torneira cozinha/lazer ·
  1 cuba metal (Alto: 2) · sifão flexível (Alto: metálico); cozinha ainda leva
  1 torneira lavanderia/jardim.
- **Lavanderia**: 2 registros gaveta · 1 tanque (Alto: 2). **Varal/A. Técnica**:
  1 tanque. **Louceiro**: 2 registros · cuba metal · sifão.
- **Jardim N**: 1 torneira lavanderia/jardim. **Sauna**: só ralo oculto no Alto.

Itens da matriz (nomes do cadastro): base misturador chuveiro 3/4, base registro
pressão 3/4, base registro monocomando chuveiro 3/4, base registro gaveta 3/4,
base válvula descarga, sifão metálico, sifão flexível, acabamento registro
pressão, acabamento misturador chuveiro, acabamento monocomando, acabamento
válvula descarga, chuveiro, ducha higiênica, torneira cozinha e lazer, torneira
WC, torneira lavanderia e jardim, ralo oculto, cuba metal, sanitário, cuba
louça, tanque, box banho. Etapa `Acabamentos - Louças, Metais e cubas`.

O formulário `LOUCAS_TORNEIRAS` ainda permite ajustar à mão a quantidade de
torneiras, sifões, sanitários, cubas, chuveiros e acabamentos de registro por
ambiente (combos 0–9) antes de gravar.

## 4. Portas internas — por ambiente, precificadas por tipo

`PORTAS_INTERNAS`: para cada ambiente, tipo (**PORTA GIRO** ou **PORTA
CORRER**), abertura (Direita/Esquerda), quantidade, altura, largura, espessura.
No resumo vira uma linha por tipo (`PORTA GIRO`, Unidades, qtd × preço unitário
fixo por tipo — ex.: R$ 1.100) em `Acabamentos - Portas internas`; a instalação
é o prestador "Marceneiro Portas" (qtd = nº de portas, em m²… na verdade
unidades).

## 5. O que mais vinha da aba GERAL (e o NOVO MODELO também não tem)

Forros (gesso m², madeira m² com padrão), soleiras e bancadas (m² por material,
ex. "Soleira Verde Ubatuba"), pontos de iluminação, revestimento externo em
pedra/madeira, deck, calçada, impermeabilização de áreas molhadas
(Vedatop por m² molhado), locação de container e betoneira, caçambas de
entulho, e prestadores extras (Gesseiro, Ar Condicionado, Equipamentos Casa).
