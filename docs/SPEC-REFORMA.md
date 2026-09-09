# Reforma no quantitativo da obra

Antes, "Reforma" existia como opção no bloco Geral mas não mudava uma linha
do cálculo — o quantitativo saía inteiro pelo modelo de construção nova.

## As duas obras dentro de uma reforma

**A parte nova** (ampliação, laje nova, telhado novo) usa os blocos de
sempre, sem nenhuma mudança: são metros quadrados que não existiam e se
comportam como obra nova.

**A parte existente** ganhou o bloco **Construção existente**, que só aparece
quando `tipoObra = "reforma"`. Ali não há modelo de prédio nenhum: entra o
que o arquiteto mediu na visita, numa matriz de duas colunas.

## A matriz

Uma linha por elemento, duas colunas — **Demolir / Desmontar** e
**Construir / Instalar**. O mesmo item aparece dos dois lados porque é assim
que a reforma se mede: "arranco 30 m² de piso e assento 30 m² de piso novo".

| linha | demolir | construir | unidade |
|---|:-:|:-:|---|
| Contrapiso | • | • | m² |
| Paredes de alvenaria | • | • | m² |
| Paredes de drywall | • | • | m² |
| Forros | • | • | m² |
| Piso | • | • | m² |
| Revestimento de parede | • | • | m² |
| Calçada | • | • | m² |
| Banheiros | • | • | un |
| Esquadrias | • | • | un |
| Chapisco e reboco | | • | m² |
| Pintura de parede | | • | m² |

Reboco e pintura não têm coluna de demolir: não se derruba reboco por conta
própria — ele sai junto com a parede ou com o revestimento. Na tela essas
células são um placeholder tracejado, não um campo desabilitado.

**`ITENS_EXISTENTE` é a fonte única.** A mesma tabela desenha o formulário e
dirige o cálculo: acrescentar um elemento novo à reforma é acrescentar uma
linha nela, e ela já aparece na tela, no entulho e no orçamento.

```
projeto.existente = {
  contrapiso: { remover, executar },
  alvenaria:  { remover, executar },
  drywall:    { remover, executar },
  forro:      { remover, executar, tipo },   // tipo: gesso, PVC, madeira
  piso:       { remover, executar },
  revestimento: { remover, executar },
  calcada:    { remover, executar },
  banheiro:   { remover, executar },
  esquadria:  { remover, executar },
  reboco:     { executar },
  pintura:    { executar },
}
```

`reboco.executar` vazio herda `alvenaria.executar` — parede nova sempre leva
chapisco e reboco, e obrigar a digitar duas vezes a mesma medida só gera
divergência.

O bloco nasceu com um campo por serviço (`paredeDemolir`, `pisoAssentar`) e
virou esta matriz. `migrarExistente()` lê as duas formas, então projeto salvo
antes da mudança não perde o que já estava digitado; onde as duas existem, a
matriz vence.

## Ordem no orçamento

`ORD.demolicao = -2` e `ORD.entulho = -1` são **negativos** de propósito: na
obra, derrubar vem antes de levantar, e o orçamento é lido na ordem em que
a obra acontece. `ORD.existente = 27` fecha a lista, depois de todas as
etapas da parte nova.

## Coeficientes: os mesmos do resto do motor

Reforma não muda a física da construção — muda o que é feito, não como.
Parede de 20 cm continua com 40 tijolos por m²; chapisco de 5 mm e reboco
de 25 mm; contrapiso de 10 cm com tela; argamassa e rejunte pelo formato da
peça do padrão. Cada coeficiente foi reaproveitado do bloco equivalente da
obra nova, não reescrito, para as duas partes de uma reforma nunca darem
números diferentes para o mesmo serviço.

## Entulho

Sai sozinho do que foi marcado para demolir, por volume gerado por m²:

| demolição | m³ por m² |
|---|---|
| parede (20 cm com reboco dos dois lados) | 0,25 |
| contrapiso | 0,07 |
| revestimento de parede | 0,03 |
| piso | 0,02 |
| forro | 0,01 |
| drywall | 0,05 |
| calçada | 0,12 |

E por unidade: 0,30 m³ por banheiro desmontado (vaso, cuba e acessórios) e
0,05 m³ por esquadria retirada.

## Drywall e calçada

Drywall usa os consumos de parede simples com montante de 70 mm a cada 60 cm:
uma placa por face (2 m² de placa por m² de parede), montante e guia em
barras de 3 m, 30 parafusos por m², 2,5 m de junta e 0,6 kg de massa. Os
perfis de parede e a massa de junta entraram na semente (GES-901..903); a
placa, o parafuso e a fita já existiam, usados no forro.

Calçada usa os mesmos coeficientes do contrapiso externo — laje de 10 cm com
tela. A forma de madeira **não** entra: depende do perímetro, que esta tela
não mede.

## Banheiro é a unidade, não a peça

Desmontagem e montagem são contadas **por banheiro**, não por louça ou
metal. É como o empreiteiro cobra e como o arquiteto conta na visita:
"dois banheiros" se responde na hora, "onze peças" exige contar vaso,
lavatório, torneira, ducha, registros e acessórios um a um — e ninguém
confere esse número depois. Um banheiro completo é o conjunto todo.

Sobre o total incide **empolamento de 1,4**: entulho quebrado ocupa mais
espaço do que o material ocupava íntegro na parede. Só então divide por
5 m³ e arredonda para cima — caçamba é indivisível.

## Preço dos serviços

Demolição, remoção, instalação de louças e caçamba são mão de obra e
serviço, não material. O preço vem do **catálogo de Insumos** quando o
serviço está cadastrado (PRE-018 a PRE-026, já na semente); sem cadastro,
vale a referência de `SERVICOS_REFORMA`, e a memória de cálculo diz
qual das duas foi usada. Os valores de referência são ponto de partida da
região, não verdade: a primeira cotação com o empreiteiro substitui cada um.

## O que ainda não faz

- Proteção de obra ocupada (lona, tapume interno, limpeza diária) — o
  cliente morando no imóvel muda o custo e ainda não entra.
- Recuperação do existente (estucar parede velha, tratar trinca, reforço
  em abertura de vão).
- Remanejamento de instalações no existente: hoje elétrica e hidráulica só
  são calculadas pelo modelo da obra nova.

## Nada sai com valor negativo

`emitir()` recusa quantidade ≤ 0. Não existe "menos três sacos de cimento":
quando uma conta dá negativo é erro de dado, e o número entraria **subtraindo
do total**, escondendo o problema em vez de mostrá-lo. A linha é suprimida e
o caso vira um aviso vermelho no resultado, nomeando os itens.

Dois casos reais que davam negativo, corrigidos na origem:

- **Pintura.** `internas − revestimento` sem piso em zero. Com a parede
  interna em branco (comum em reforma) e os cômodos estimando revestimento,
  a subtração ficava negativa e a massa corrida saía com quantidade −3. Agora
  a sobra de parede é `Math.max(0, …)`, e a memória de cálculo avisa quando o
  revestimento passou da parede.
- **Cumeeira.** Telhado digitado mais largo que comprido fazia `comp − larg`
  negativo, e daí telhas negativas.

O teste `nenhum projeto de teste produz linha negativa` roda obra nova cheia,
reforma cheia e projeto zerado conferindo quantidade, preço e total de cada
linha — é ele que guarda a regra para o que vier depois.

## O nome do insumo é o do catálogo, letra por letra

O preço de cada linha é achado pelo **nome do item**. Uma string solta:
escrever `"Tijolos 6 Furos"` em vez de `"Cerâmicas - Tijolo - Bloco  6 Furos"`
(com o espaço duplo que o cadastro tem) não quebra nada — o item sai com
**R$ 0,00** e ninguém percebe até somar o total à mão. Foi o que aconteceu
com o tijolo da reforma, e junto com ele a argamassa, o rejunte e a tinta.

Ao emitir um item, copie o nome do bloco equivalente da obra nova, não
invente. Os nomes certos:

| o que é | nome no catálogo |
|---|---|
| tijolo de 6 furos | `Cerâmicas - Tijolo - Bloco  6 Furos` (dois espaços) |
| argamassa de porcelanato | `Argamassa AC 3 GF - 20kg` |
| argamassa de cerâmica | `Argamassa AC 2 - 20kg` |
| rejunte | `Rejunte - 5kg` (embalagem de 5 kg, não quilos) |
| tinta | `Tintas - Tintas 18L` |

`precos-quantitativo.test.mjs` é a trava: roda obra nova e reforma inteiras
contra a semente e exige que **toda** linha ache preço maior que zero.
Rodado contra o código anterior, ele acusa exatamente os quatro itens.

## A tela e o motor têm que ler a mesma coisa

`normalizarProjeto()` migra o projeto para o motor; o formulário lê o
projeto **cru** de `obra.projeto`. Quando só o motor migrava, um projeto
salvo antes da matriz mostrava a construção existente **em branco** e mesmo
assim gerava demolição, entulho e material — o formulário procurava
`existente.alvenaria.remover` (inexistente) e o motor lia
`existente.paredeDemolir` (40 m²). Linhas no orçamento sem nenhum campo
correspondente na tela.

`projetoParaFormulario()` faz no rascunho da tela as mesmas migrações que o
motor faz (cômodos e matriz), e é ela que `OrcamentoObraView` usa ao abrir.
Como devolve só o formato novo, os campos antigos somem do projeto no
próximo save — a divergência não volta.

**Regra:** toda migração nova em `normalizarProjeto` precisa de par em
`projetoParaFormulario`, senão a tela e o orçamento passam a discordar em
silêncio.

## Banheiro montado: mão de obra E peças

A linha "Banheiros / Instalar" gera duas coisas:

- **Montagem de banheiro** — mão de obra, um por banheiro (prestador).
- **As peças** — o mesmo kit `LOUCAS_BANHEIRO` da obra nova, aplicado uma vez
  por banheiro, na sub-etapa "Banheiros — louças e metais".

O **padrão é de cada banheiro**, não da obra: a suíte costuma ser de padrão
mais alto que o social, e cobrar o mesmo dos dois falseia o total.
`existente.banheiro.padroes` é uma lista que acompanha a quantidade — posição
sem escolha herda o padrão da obra. O padrão troca o kit (Alto usa
monocomando e ralo oculto, Médio usa misturador) e entra no nome do produto,
então três banheiros "Alto, Médio, Médio" saem como 1 sanitário Alto e 2
Médio, com o Box somando 3.

## Parede nova: pintar, e de que lado

Tique na linha "Paredes de alvenaria" com três escopos: só a face interna,
só a externa, ou as duas. A área entra somada à linha de Pintura. Uma parede
interna tem duas faces para pintar; uma de divisa com a rua, uma de cada
lado — um "×2" fixo erraria metade dos casos.

## Onde entram as caçambas

Na etapa **Entulho**, item "Caçamba de entulho 5m³", tipo *Prestadores de
serviços*. A quantidade sai do que foi marcado para demolir; no P&L cai na
conta que a linha carrega. `cacambasDaReforma()` é função pura e é a MESMA
usada pelo cronograma para as horas de carga — duas contas do entulho em
lugares diferentes acabariam divergindo.

## O prazo da reforma

Antes, o cronograma ignorava a construção existente: 40 m² de parede
demolida e 30 de piso novo valiam zero hora, e o prazo não mudava por mais
que o orçamento crescesse. Três mudanças:

1. **Etapa `DEMOLICAO`** na rede, com `condicao: "reforma"`, entre a pré-obra
   e a terraplanagem. Em obra nova ela sai da rede e quem dependia dela passa
   a depender de PRE_OBRA — que já era a predecessora dela, então o
   encadeamento da obra nova fica idêntico (conferido: 19,8 meses antes e
   depois, mesmas etapas).
2. **Serviços de reforma** em `PRODUTIVIDADE_SEED` (demolição, remoções,
   montagem de banheiro, drywall, carga de entulho). **Não são SINAPI**: são
   referência de partida, marcados como manuais, para calibrar com a equipe
   em Insumos → Composições → Cronograma.
3. **Medições** da construção existente: a demolição vai para `DEMOLICAO`, e
   o que se refaz entra nas etapas que já existem (alvenaria em
   PAREDES_TERREO, piso em REVESTIMENTOS, e assim por diante).

### Reforma pura cai no modo produtividade

A tabela de prazo é por m² de área construída. Reforma sem ampliação não tem
área construída nenhuma, então não há prazo-alvo para calibrar o modo
simplificado — mas há horas medidas, e é delas que o prazo sai. Nesse caso o
cronograma usa produtividade sozinho e avisa na tela.

E **etapa sem nada medido sai da rede**: uma reforma não tem fundação, laje
nem telhado, e cada uma dessas etapas somaria a duração-base de uma casa
inteira ao prazo. Pré-obra e limpeza ficam sempre. Reforma **com** ampliação
(área construída > 0) mantém a obra nova inteira e ganha a demolição junto.

A tela do cronograma também exigia área construída para abrir — justamente a
obra em que o prazo mais muda ficava sem tela. Agora abre com a construção
existente medida.
