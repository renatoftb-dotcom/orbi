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
| 8 | Parede de cima sem parede embaixo: viga de piso sob a parede (VP), no nível do piso, apoiada nos pilares ou vigas que encontrar | NBR 6118 exige caminho de carga verificado; sobre laje pré-fabricada a parede de alvenaria praticamente sempre pede viga | feito |
| 9 | Laje em balanço (beiral de laje além das paredes): espessura ≥ 10 cm, γn = 1,95 − 0,05h, engaste na laje vizinha com a negativa entrando pelo menos o comprimento do balanço; pré-fabricada: faixa do beiral maciçada; flecha com vão equivalente 2ℓ | NBR 6118 13.2.4.1, Tabelas 13.2 e 13.3 | feito |
| 10 | Direção das vigotas pelo menor vão de cada painel (painel = região da laje cercada por vigas; vão teórico entre eixos); a carga da pré-fabricada vai só às vigas onde as vigotas apoiam; maciça com ly/lx ≤ 2 nas duas direções; o usuário pode girar as vigotas da laje (aviso se ficarem no maior vão); vão máximo pela tabela do fabricante | eficiência, flecha e caminho de carga real | feito (vão máximo do fabricante pendente) |
| 11 | Escada: furo na laje sem laje; vigas de borda (VE) nos lados do furo que não caem em viga — cabeceiras primeiro, esticadas até as vigas, lados compridos apoiados nelas; metade da carga da escada na viga onde ela chega; laje da escada com a menor espessura que passa | caminho de carga da escada | feito (caracol: estrutura pronta, fora) |
| 12 | Trecho sem laje, sem parede em cima e sem viga apoiada nele: cinta de 20 cm (o cálculo aumenta se precisar) | não há carga de laje; economia | feito |
| 13 | Vão grande de porta/janela (≥ 2,5 m): pilar nas duas ombreiras; a viga do vão é verificada como as outras | vão livre | feito |
| 14 | Transição inevitável: viga de transição marcada para dimensionamento especial | carga concentrada na viga | aviso feito; dimensionamento pendente |
| 15 | Pilar do pavimento de cima sem pilar embaixo só entra se não houver saída: sobre vão livre não entra (a parede vai na viga de piso e o encontro vira apoio de viga em viga); sobre porta/janela a menos de 1,0 m de um pilar fixo de baixo não entra (fica o de baixo); pilar intermediário tenta a outra ombreira antes de virar transição | evita transição e pilares colados | feito |

## Descida de cargas (etapa 2, primeira versão) — `esDescidaCargas`

Do pavimento de cima para o de baixo:

1. Peso próprio de cada viga (25 kN/m³ × b × h × L).
2. Lajes do pavimento repartidas entre as vigas que as cercam pela área de
   influência (cada ponto da laje vai para a viga mais próxima; empate divide).
   Permanente (g) e uso (q) separados. Telhado só com permanente.
3. Paredes do pavimento de cima sobre as vigas do pavimento (altura da parede
   menos a altura da viga); paredes do térreo sobre os baldrames.
4. Trechos de viga alinhados sem pilar no meio viram um tramo. Pilar de
   transição do pavimento de cima entra como carga concentrada no tramo.
5. Tramo biapoiado: as reações vão para os pilares das pontas; ponta sem pilar
   (viga apoiada em viga) passa a reação para a viga que a apoia.
6. Pilar: reações + peso próprio + pilar de cima no mesmo ponto. O do térreo
   dá a carga na fundação (Nk). Na tela, Nd = 1,4 × Nk × γn.

Atualização: lajes pelo sentido das vigotas (critério 10) e vigas contínuas
(14.6.7.1) — reações dos apoios internos maiores, das pontas menores.
Limitações: maciça em duas direções ainda por área de influência (não pelas
charneiras/tabelas); vigas sem engaste nos pilares de extremidade; sem sobrecarga de manutenção do telhado; aberturas não
descontadas do peso das paredes (a favor da segurança).

## Dimensionamento (etapa 4, primeira versão) — `esDimensionar`

Valores em `ES_DIM` (NBR 6118:2023, a conferir no texto oficial).

**Vigas** (`esDimViga`), por tramo da viga contínua:
- ELU: γf = 1,4 em g e q; sem alternância de q (14.6.7.3, q ≤ 20% do total).
  Positivo nunca menor que o de engaste perfeito (14.6.7.1).
- Flexão: bloco retangular 0,8x, x/d ≤ 0,45 (14.6.4.3), As,min pela Tabela 17.3,
  As ≤ 4% Ac. Negativa nos apoios com a mesma conta. Barras de uma bitola, até 2
  camadas, espaçamento livre ≥ 20 mm, φ e 1,2 dmáx (brita 1); escolha pela menor
  área com preferência por poucas barras e uma camada.
- Cisalhamento: modelo I (17.4.2.2), VRd2 = 0,27 αv2 fcd bw d, Vc = 0,6 fctd bw d,
  taxa mínima 0,2 fctm/fywk, smáx 0,6d ≤ 30 cm (ou 0,3d ≤ 20 cm).
- Flecha: quase permanente (ψ2 = 0,3), Branson com Mr = 1,5 fctm Ic/yt e a
  armadura adotada, Ecs da 8.2.8, fluência αf = 1,32. Limites L/250 total e,
  com parede em cima (ou baldrame), L/500 e 10 mm depois da parede (Tabela 13.3).
- Se não passa, a viga sobe para a menor altura (de 5 em 5 cm, até 80) que passa
  e o cálculo é refeito com o novo peso e a nova rigidez (`esCalcularEstrutura`).
  A tela lista as vigas aumentadas; o fundo novo passa pela verificação de
  porta/janela embaixo.

**Pilares** (`esDimPilar`), por lance:
- Nd = 1,4 γn Nk. Momento mínimo M1d,mín = Nd(0,015 + 0,03h) em cada direção
  (11.3.3.4.3), le = comprimento do lance, λ1 = 35.
- λ > 35: 2ª ordem pelo pilar-padrão com curvatura aproximada (15.8.3.3.2);
  λ > 90 exige método mais preciso (aviso); λ > 140 não pode.
- Flexo-compressão reta, armadura simétrica nas duas faces, domínios de
  deformação (εcu 3,5‰, 2‰ a 3h/7). As,mín = 0,15 Nd/fyd ≥ 0,4% Ac; As ≤ 4% Ac.
- Barras φ ≥ 10 e ≤ b/8, mínimo 4; estribo φ5 (≥ φl/4), s ≤ 20 cm, b e 12φl.
- Se não passa, cresce no comprimento (dentro da parede) de 5 em 5 cm.

**Aço**: kg por bitola com ganchos, ancoragens e negativas estimados
(0,25 L para dentro do tramo). O detalhamento (etapa 5) refaz com comprimentos
de ancoragem e emendas da norma.

**Lajes** (`esDimLaje`), por painel:
- Treliçada: nervura em T (mesa = intereixo × capa), bi-apoiada no vão das
  vigotas; flexão (banzo da treliça admitido 2 φ4,2 CA-60 + barra adicional
  CA-50), cortante sem estribo (VRd1, 19.4.1), flecha com α = 1,2 (seção T) e
  contraflecha até ℓ/350. Se não passa, sugere o enchimento que passa.
- Protendida: o aço vem da fábrica; o resultado é o que se manda ao fabricante
  (vão, carga além do peso próprio, momento por vigota).
- Maciça: placa apoiada nas bordas por diferenças finitas na malha do painel
  (∇²M = −p, ∇²u = −M, ν = 0,2), corrigida para o vão teórico; As nas duas
  direções (mín. 0,67 ρmín), s ≤ 2h e 20 cm, φ ≤ h/8, flecha com Branson.
  Conferido com Timoshenko (placa quadrada: m = 0,0442 q a²).
- Balanço (critério 9) e negativas de continuidade entre painéis: pendentes.

**Orçamento de obra** (`esParaOrcamento` → `tpComEstrutura`): com a estrutura
lançada, o Projetar grava nos campos que o orçamento já lê: pilares
(`engenharia.colunasTerreo/colunasPav1`: quantidade por largura, concreto e
metros de barra por bitola), vigas (`terreo/pav1.vigaRespaldo` e
`concretoVigaRespaldo`) e baldrames (`engenharia.fundacao` baldrames). Sapatas,
estacas e lajes continuam como estavam. Retirar a estrutura limpa só o que o
cálculo escreveu. φ20 e φ25 não existem na lista do orçamento (aviso).

**Desempenho**: lançamento na hora; cargas e dimensionamento 0,3 s depois da
última alteração. Painéis de laje e placas ficam em cache.

## Fundação (etapa 6, primeira versão) — `esFundacaoObra` / `esDimFundacao`

- Estacas escavadas (brocas) com bloco, ou sapatas. A carga admissível vem da
  sondagem (NBR 6122); sem ela, estimativa para orçamento: só atrito lateral
  30 kPa, FS 2, sem a ponta (fundo da broca manual mal limpo) — ~1 t por metro
  em Ø20–25, como a regra de obra; sapata 150 kPa. A tela avisa que é
  estimativa e que solo poroso/colapsível, comum no interior de SP, só a
  sondagem mostra.
- Um diâmetro para a obra toda (o de menor volume com até 4 estacas por bloco),
  a partir do mínimo informado. Estacas a 3Ø, 15 cm da estaca à face.
- Blocos pelo método das bielas (Blévot), biela a 45°: Rs = (Nd/n)(r − c)/d,
  majorado 1,15; 1 estaca: fretagem 0,25 Nd (1 − ap/B)/fyd.
- Sapata rígida h ≥ (A − ap)/3, abas iguais, tirante Nd (A − ap)/(8d).
- Estaca: armadura de ligação 4 φ10 × 2,5 m e estribo φ5 c/20 (construtiva).
- Arranques do pilar com 40φ de emenda.
- Orçamento: qtdEstacas, profEstacas, ferro e concreto de estacas, blocos
  (campo "sapatas" do orçamento) e arranques.

## Lajes — negativas entre maciças (14.7.6.2)

Cada painel engastado na viga comum dá k·p·ℓ²/12; o apoio fica com o maior
entre 0,8 do maior e a média; barras 0,25 do maior vão para cada lado.

## Etapa 1 — lançar e alterar à mão
- Alterações guardadas em `estrutura.edicoes[pavimento]`, por posição (pilar+, pilar-, pilar~, pilarSec, viga+, viga-, vigaSec), reaplicadas sobre o lançamento automático a cada cálculo; a que perde o alvo vira aviso.
- Numeração estável: nomes saem do lançamento automático antes das alterações; viga dividida por pilar novo vira V3a/V3b; pilar novo ganha o próximo número.
- Altura de viga digitada fica fixa (`hFixo`): o cálculo não aumenta nem iguala; avisa se não passar.

## Etapa 2 — vento (NBR 6123) e estabilidade global (NBR 6118, 15.5.3)
- Vk = V0·S1·S2·S3, S2 da Tabela 2 (classe A/B), q = 0,613 Vk², F = Ca·q·faixa de fachada por nível + empena do telhado. Parâmetros: V0 (padrão 45 m/s, conferir isopletas), categoria (IV), Ca (1,2, conferir Fig. 4).
- Rigidez lateral pelo método de Muto com 0,8 EI nos pilares e 0,4 EI nas vigas (15.7.3); base sem baldrame rotulada; alvenaria desprezada.
- γz com 1,4(G + 0,5Q) e 1,4W: ≤ 1,1 nós fixos; ≤ 1,3 vento ×0,95γz; > 1,3 não atende.
- Serviço: vento frequente ψ1 = 0,3, rigidez bruta — topo H/1700, andar hi/850.
- Pilares: duas combinações (uso + 0,6 vento; vento + 0,5 uso), M1d = máx(M1d,mín; Md,vento), mais a 2ª ordem local.
- Pendente (etapa 3): momento do vento nas vigas e na fundação (baldrames).
