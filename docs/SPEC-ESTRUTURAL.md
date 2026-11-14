# SPEC — Projeto estrutural no Projetar

Estrutura de concreto armado concebida e verificada dentro do VICKE, a partir
da arquitetura desenhada no Projetar, seguindo as NBRs.

O motor fica em `src/modules/estrutural.jsx` (JS puro, sem React) e é testado por
`estrutural.test.mjs` (`node estrutural.test.mjs`). A tela fica em
`teste-projeto.jsx`.

## Princípios

1. **Todo valor normativo mora em `ES_NBR`**, com o item da norma ao lado. Nada
   de número de norma espalhado pela tela.
2. **O que é escolha de concepção mora em `ES_PADRAO`.** Isso inclui o vão
   máximo entre pilares, as seções padrão e a classe de agressividade adotada.
   A tela mostra essas escolhas como escolhas, nunca como exigência da norma.
3. **Cada aviso diz o tipo.** `nbr` quer dizer que não atende a norma, `compat`
   é conflito com a arquitetura e `atencao` é ponto a revisar. Quando o aviso
   vem de norma, ele cita o item.
4. **Responsabilidade técnica.** O resultado é apoio ao projeto. A estrutura
   executada exige projeto de engenheiro com ART (Lei 6.496/77), e a tela diz
   isso.
5. **Valores conferidos na norma.** Cada valor de `ES_NBR` precisa estar
   conferido no texto oficial da ABNT da versão vigente antes de sair do modo
   teste. A coluna "Conferido" abaixo registra isso.

## Etapas

| Etapa | Conteúdo | Normas |
|---|---|---|
| 1 | Lançamento de pilares, vigas, baldrames e lajes. Dimensões mínimas, durabilidade e compatibilização com portas, janelas e pavimentos. Concreto e fôrma. | NBR 6118 (6.4, 7.4, 13.2) |
| 1b | Edição de cada elemento: mover pilar, mudar seção, apagar ou criar viga. A estrutura é refeita sem perder o que foi editado. | — |
| 2 | Ações e combinações: peso próprio, revestimentos, alvenaria sobre vigas, cargas de uso por ambiente, combinações ELU/ELS. | NBR 6120:2019, NBR 8681:2003 |
| 3 | Análise: lajes (charneiras ou grelha) e pórtico espacial de vigas e pilares. Vento quando couber. | NBR 6118 (14, 15), NBR 6123 |
| 4 | Dimensionamento: vigas (flexão, cisalhamento, flecha, fissuração), lajes e pilares (flexo-compressão e efeitos de 2ª ordem). | NBR 6118 (17, 19, 15), NBR 7480 |
| 5 | Detalhamento e quantitativo de aço por bitola, integrado ao orçamento de obra. | NBR 6118 (18, 20), NBR 7480 |
| 6 | Fundações: cargas nos pilares e pré-dimensionamento de sapatas ou estacas. | NBR 6122 |

## Valores da etapa 1 (`ES_NBR`)

| Valor | Item | Conferido |
|---|---|---|
| Classes de agressividade I a IV | NBR 6118:2023, 6.4.2, Tabela 6.1 | a conferir |
| Classe mínima do concreto C20/C25/C30/C40 e a/c 0,65/0,60/0,55/0,45 | Tabela 7.1 | a conferir |
| Cobrimento nominal: laje 20/25/35/45 mm, viga e pilar 25/30/40/50 mm, Δc = 10 mm | Tabela 7.2 | a conferir |
| Viga com largura mínima de 12 cm (10 cm em caso excepcional) | 13.2.2 | a conferir |
| Pilar com menor dimensão de 19 cm, 14 a 19 cm com γn = 1,95 − 0,05b, área mínima de 360 cm² | 13.2.3, Tabela 13.1 | a conferir |
| Laje maciça com espessura mínima: cobertura 7, piso 8, balanço 10, veículos até 30 kN 10, acima de 30 kN 12 cm | 13.2.4.1 | a conferir |

## Concepção adotada na etapa 1 (`ES_PADRAO`, não é norma)

- O pilar entra nos cantos, nos encontros em T e cruz e nas pontas soltas de
  parede. Duas paredes alinhadas (desvio de até 10°) ou dois trechos da mesma
  curva não pedem pilar.
- Quando o trecho entre pilares passa do vão adotado, o padrão é 5,00 m. Nesse
  caso entram pilares intermediários igualmente espaçados. O pilar que cairia
  numa porta ou janela vai para a ombreira mais próxima.
- A viga fica sobre cada parede, entre os pilares, com o topo no topo da
  parede. No pavimento mais baixo entram baldrames sob as mesmas paredes.
- As lajes são as que o arquiteto desenhou no pavimento.
- As seções padrão são pilar 19 × 19 (mínimo da norma sem γn), viga 14 × 40,
  baldrame 14 × 30 e laje de 10 cm, com C25 e CAA II (urbana).

## Compatibilização (avisos `compat`)

- Pilar dentro de porta, janela ou vão.
- Fundo da viga abaixo do topo de porta ou janela da parede que está embaixo dela.
- Pilar mais grosso que a parede (fica aparente). Este aviso é do tipo `atencao`.
- Pilar sem pilar embaixo, que vira transição sobre viga. Também é do tipo `atencao`.

## Critérios de lançamento (o que o engenheiro faria) — regras do motor

Cada critério diz se já está no motor (feito) ou pendente. Origem: análise da
CASA TESTE (Márcio Viezzer, 2 pavimentos) em 14/11/2026.

| # | Critério | Por quê | Situação |
|---|---|---|---|
| 1 | Pilar na seção mínima da norma (19 × 19) | NBR 6118 13.2.3 sem γn | feito |
| 2 | Pilar nos cantos, encontros e pontas; intermediário pelo vão adotado | concepção usual de casa em alvenaria de vedação | feito |
| 3 | Pilar nunca em porta, janela ou vão (desliza até a ombreira) | compatibilização com a arquitetura | feito |
| 4 | Fachada: face de fora alinhada; sobra para dentro | fachada lisa | feito |
| 5 | Pilar contínuo entre pavimentos (sobe e desce onde há parede) | evita transição, carga desce direto à fundação | feito |
| 6 | Pilar contínuo na altura: do fundo do baldrame ao piso de cima, sem interrupção na laje | é assim que se executa e calcula | feito |
| 7 | Viga com topo no piso de cima (a laje apoia em cima) | é assim que se executa | feito |
| 8 | Parede de cima sem parede embaixo: viga de apoio no piso, sob a parede (ou verificar a laje para a carga linear) | parede apoiada só na laje treliçada/protendida pede verificação; normalmente vai viga | pendente |
| 9 | Laje em balanço (beiral de laje além das paredes): espessura ≥ 10 cm e engaste na laje vizinha; pré-fabricada em balanço só com armadura negativa | NBR 6118 13.2.4.1 (maciça); detalhe de balanço | pendente |
| 10 | Direção das vigotas pelo menor vão de cada painel; vão máximo por tipo de laje (do fabricante) | eficiência e flecha | pendente |
| 11 | Escada: apoio do patamar e do lance (viga de apoio ou laje da escada nas vigas) e furo da laje com borda apoiada | caminho de carga da escada | pendente |
| 12 | Elementos sem laje (muro, jardineira): cinta de amarração em vez de viga de 40 | não há carga de laje; economia | pendente |
| 13 | Vão grande de porta/janela (≥ 2,5 m): viga sobre o vão verificada para flecha e pilares nas ombreiras | vão livre | pendente |
| 14 | Transição inevitável: viga de transição marcada para dimensionamento especial | carga concentrada na viga | aviso feito; dimensionamento pendente |
