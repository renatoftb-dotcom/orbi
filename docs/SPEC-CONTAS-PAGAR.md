# SPEC — Contas a pagar da obra

Salvar um contrato alimenta o fluxo de contas a pagar da obra: cada parcela
da modalidade de pagamento vira uma conta com vencimento, valor e status.
Fora dos contratos, dá para lançar contas avulsas (caçamba, frete, taxa).
Marcar uma conta como paga registra o realizado da obra, que aparece ao lado
da estimativa no Planejamento.

Fica em **Gestão de Obra → obra → Contas a pagar**, com o valor em aberto no
próprio botão do menu da obra.

## Onde mora

Dentro da obra (`obra.contasPagar`), como os contratos e a estimativa — a
obra é o documento JSON que o backend grava.

## Como a parcela é gerada

`parcelasAPagar(contrato)` traduz a modalidade de pagamento do contrato
(`SPEC-CONTRATOS.md`) em parcelas. É o mesmo racional do texto do contrato:
quem mexer num, mexe no outro.

| modalidade | contas geradas | vencimento |
| --- | --- | --- |
| `parcelado` | uma por parcela | âncora + 7/15/30 dias × n, conforme a periodicidade |
| `entradaParcelas` | entrada + uma por parcela | entrada na assinatura; parcelas a partir da âncora |
| `entradaFinal` (contrato) | entrada + saldo | entrada na assinatura; saldo no fim do prazo |
| `entradaFinal` (item a item) | duas por item (entrada e conclusão) | sem data — dependem da liberação de cada item |
| `medicao` | uma por medição que couber no prazo | âncora + período × n + prazo de pagamento; marcadas como **estimadas** |

A **âncora** é o início previsto do contrato; sem ele, a data de assinatura.
Sem nenhuma das duas, as parcelas saem sem vencimento (a definir).
"Mensais" anda de 30 em 30 dias, como diz a cláusula de pagamento.

Cada conta nasce com o `contaId` do plano de contas (`obra-financeiro.jsx`)
correspondente ao tipo de profissional — serralheiro → `serralheiro`,
gestão de obra → `taxa_admin_obra`, a conta "Gerenciamento de obra" —, o
prestador e o nome do favorecido.

Trocar a conta de um tipo reclassifica também o que já foi pago: a parcela
paga guarda o pagamento (data de contabilização, valor, dia do registro) mas
recebe a conta nova, e como `contaId` entra na assinatura da conta, a correção
dispara sozinha ao abrir a tela.

## Regravar o contrato

`sincronizarContasDoContrato(contas, contrato)`:

- contas avulsas e de outros contratos ficam intactas;
- o que já foi pago é preservado como está, inclusive o valor pago;
- o resto é regerado a partir do contrato atual (mudou o valor, mudaram as
  parcelas em aberto);
- parcela paga que não existe mais no contrato **continua na lista**: o
  dinheiro saiu, e escondê-la esconderia um pagamento real.

Remover o contrato (`removerContasDoContrato`) leva junto o que está em
aberto e mantém o que foi pago.

## Número do contrato

Ao salvar um contrato pela primeira vez ele recebe um **número sequencial de
4 dígitos**, único no escritório (`proximoNumeroContrato` varre os contratos
de todas as obras e soma 1 ao maior). O número nunca muda depois, aparece no
topo do documento ("Contrato nº 0007"), na lista de contratos da obra e em
cada conta a pagar.

## Como a conta se identifica

`tituloConta` monta a linha principal:

> **Contrato 0007 · Serralheria · MB Viezzer · Parcela 2/6**

— número do contrato, serviço (o ofício do prestador, ou o objeto digitado),
empresa contratada e a parcela no total. `detalheConta` cuida da linha de
apoio (periodicidade, conta do plano de contas, observação) sem repetir o que
o título já disse.

## O gráfico

A tela abre com o **fluxo por mês**: uma barra por mês com vencimento, em
ordem cronológica, com o total escrito em cima (em milhares quando passa de
mil) e o mês atual em negrito no eixo. Cada barra é empilhada em três faixas
(`fluxoMensal`), de baixo para cima: **pago** (cinza), **vencido** (preto) e,
no topo, **a pagar** (azul) — o que falta pagar fica na ponta, que é o que se
olha. As três somadas fecham o total do mês. **Clicar numa barra filtra a
lista** por aquele mês: as outras barras esmaecem, o mês escolhido ganha um
traço azul no eixo e a lista mostra só as contas dele. Clicar na mesma barra
de novo, no "ver todas" ou **em qualquer lugar fora do gráfico** volta a
mostrar tudo — só os botões da própria lista (pagar, editar) não desfazem a
escolha, para não atrapalhar quem está dando baixa.

As barras têm o topo levemente arredondado: a faixa do topo é desenhada como
um `path` com os dois cantos de cima curvos, e as de baixo, retas — assim as
faixas encostam sem entalhe, e não é preciso recortar nada.

Ao abrir a tela elas surgem crescendo da linha de base, em cascata (70 ms
entre uma e outra), com o valor aparecendo logo depois.

**O gráfico abre mostrando só o que falta pagar.** A barra é azul, com o
número do mês em cima, e a escala usa o maior mês *do que está sendo
mostrado* — senão a barra azul sozinha ficaria achatada contra o total.

Os **quadros do topo trocam o que o gráfico desenha**, além de filtrarem a
lista (`SERIES_POR_FILTRO`):

| quadro | faixas na barra | cor |
| --- | --- | --- |
| A pagar (padrão) | vencido + a pagar | preto na base, azul em cima |
| Vencido | vencido | preto |
| Pago | pago | cinza |
| Total | pago + vencido + a pagar | as três empilhadas |

"A pagar" inclui o vencido porque o quadro do topo soma os dois — num mês sem
atraso, que é o normal, a barra sai azul inteira. A legenda mostra só as
faixas desenhadas, e a tela abre com `FILTRO_CONTAS_PADRAO = "aPagar"`; clicar
no quadro ativo volta para "Total", e a linha de aviso traz "voltar ao padrão".

**A entrada é a mesma do gráfico da calibragem, peça por peça** — decisão do
Renato: "deixa igual da calibragem".

1. Um contador de revelação (`reveladas`), não um "pronto" único: um
   `setTimeout` encadeado sobe o contador de um em um (60 ms para começar,
   120 ms entre barras) e cada barra pergunta `i < reveladas`. Recomeça quando
   a lista de meses muda, então a animação roda de novo depois de pagar,
   filtrar ou entrar na tela.
2. A escala vai no próprio `<path>`, com `transform-origin` no **pé da barra**
   em coordenadas do gráfico, e o valor da propriedade troca de `"none"` para
   `vk-cp-crescer 0.7s cubic-bezier(0.34, 1.4, 0.64, 1)` no momento da
   revelação — é essa troca que faz o navegador animar. O `cubic-bezier` passa
   de 1 e volta: é o quique do fim.
3. O `<g>` em volta cuida só da opacidade (`transition: opacity 0.35s`), que é
   também o que apaga os meses não escolhidos quando se clica numa barra.

**Sem regra de `prefers-reduced-motion`**, igual à calibragem: a barra cresce
em qualquer máquina. Isso é deliberado — com a regra antiga
(`animation: none !important`), um Windows com "Efeitos de animação" desligado
abria o gráfico estático enquanto o da calibragem continuava animando, e a
diferença entre os dois gráficos era justamente essa regra.

Conferido em Chromium de verdade, nos dois modos (`reducedMotion:
no-preference` e `reduce`): a escala de cada barra sobe 0 → ~0,9 → 1,05 → 1,00
em cascata, e clicar numa barra apaga as outras quatro.

A técnica é a mesma do gráfico da calibragem de preço (`onboarding.jsx`), que
já funcionava: **animação CSS aplicada no próprio desenho** (`path`), com
`transform-origin` em coordenadas do gráfico — o pé da barra — e a animação
só ligada depois que o componente monta (`animation: pronto ? … : "none"`).
Tentativas anteriores animavam um `<g>` com `transform-box: fill-box`, que
nem todo navegador respeita: a origem saía errada e a barra ficava parada.

É SVG desenhado à mão, sem biblioteca — no mesmo espírito do gráfico de
calibragem de preço do insumo. Contas sem vencimento ficam fora do gráfico e
são contadas na nota de rodapé.

## A tela: fluxo agrupado

A lista não é mais fatura atrás de fatura. Há um cabeçalho de colunas
(**Documento · Vencimento · Status · Valor**) e as contas vêm agrupadas, cada
grupo com o total em aberto e o vencido, podendo abrir e fechar. Os meses a
partir do atual já vêm abertos.

- **Agrupar por** (`VISOES_CONTAS`): Mês · Ano · Fornecedor · Contrato. Mês e
  ano saem em ordem cronológica; fornecedor e contrato, do maior valor para o
  menor. O que não tem vencimento (ou fornecedor) fecha a lista.
- **Filtrar**: são os próprios quadros do topo. Clicar em *A pagar*, *Vencido*
  ou *Pago* filtra a lista (`FILTROS_CONTAS`); o quadro ativo fica azul, e
  clicar nele de novo — ou em *Total* — volta para todas. Não há linha de
  chips: a informação já estava nos quadros.

Os quatro totais somam sempre a obra inteira, independentemente do filtro.

## Situação e realizado

`situacaoConta` classifica em vencida, vence em 7 dias, em aberto, sem data
ou paga; `totaisContas` soma a pagar, vencido, pago e total.

Pagar grava `pago`, `pagoEm` e `valorPago` na própria conta — ela é o
registro do realizado. `realizadoPorConta` e `realizadoPorPrestador` somam o
que foi pago e alimentam o Planejamento, que mostra "pago R$ x (+/− diferença)"
ao lado de cada conta e de cada prestador, mais o total "Já pago" no
cabeçalho.

## Aparência

Formato neutro, valendo para **todo o módulo do cliente** — tela principal
(kanban e lista), cadastro do cliente, detalhe do cliente e todas as telas da
obra, contas a pagar inclusive:

- fundo branco e bordas finas; nada de fundo cobre, âmbar ou verde;
- sem ícone colorido no cabeçalho e sem etiqueta colorida de status — a
  situação é texto, e só o que exige atenção ("Vencida", "Será inativado em
  breve") vem em negrito;
- texto preto (#111827) no que importa — valores, datas, títulos, campos — e
  cinza escuro (#4b5563) no secundário;
- **azul #0474f4** na borda de campo, botão ou cartão em *hover*, em *foco* e
  quando *selecionado*. É uma folha de estilo única, injetada pelo módulo e
  escopada por `data-vk-ui`, mais a constante `AZUL_VK` para as bordas de
  seleção que são estilo inline.

As únicas cores que restam são o vermelho de "Remover" e o cobre dos links de
ação, que são o padrão do app inteiro.

## Datas das parcelas

`primeiroVencimentoContrato(c)` decide quando vence a primeira:

1. o campo **Primeiro vencimento** do contrato, quando preenchido — é ele que
   permite registrar contrato lançado atrasado, com parcelas que já venceram;
2. senão, nas mensais, o **dia de vencimento** escolhido, na primeira
   competência posterior à âncora (início previsto, ou assinatura);
3. senão, um período cheio depois da âncora.

`vencimentoDaParcela(c, i)` anda dali em diante: mensais **sempre no mesmo dia
do mês** — o dia vem da data informada ou do "todo dia N", e é reaplicado a
cada competência, então dia 31 continua 31 em outubro e dezembro e só encolhe
onde o calendário não tem (28/29 de fevereiro), voltando a 31 no mês seguinte;
semanais e quinzenais andam de 7 e 15 dias. Antes tudo andava em dias corridos
e "mensal" virava 30 dias, o que fazia a data escorregar mês a mês (05/10,
04/11, 04/12, 03/01…).

**Semanal e quinzenal são pagamentos de um dia da semana** — sexta, por
padrão, e o contrato escolhe outro em `diaSemana` (o campo "Dia do pagamento"). É como o contrato do
empreiteiro sempre foi pago: uma sexta sim, outra não — 14 dias, não 15.
`primeiroVencimentoContrato()` leva a âncora para a **próxima ocorrência** do
dia escolhido (semanal) ou a **segunda** (quinzenal), e daí o passo é de 7 ou 14 dias, o que
mantém o dia da semana para sempre. Quando a data do primeiro pagamento é
informada, ela é respeitada como está e a cadência segue o dia da semana dela.

A quinzena de **15 dias corridos** (`quinzeDias`) é a outra família: conta 15
dias da âncora e daí de 15 em 15, caindo em qualquer dia da semana, e **não**
antecipa em feriado — quem fecha por data quer a data.

**Feriado antecipa para o dia útil anterior.** Sexta-feira feriada paga-se na
quinta (`anteciparParaDiaUtil()`), e se a quinta também for feriado anda mais
um dia. O calendário é o mesmo do cronograma (`feriadosDoAno`, em
cronograma-obra.jsx): feriados nacionais, com carnaval, sexta-feira santa e
Corpus Christi calculados pela Páscoa. **A antecipação não desloca a
cadência** — cada parcela é contada a partir do primeiro vencimento, então a
seguinte volta para a sexta. O contrato pode desligar isso
(`ajusteFeriado: "nenhum"`, a caixa "Antecipar quando cair em feriado" do
gerador), e o mensal não é afetado.

**As contas se corrigem sozinhas.** Contas geradas por uma versão antiga das
regras não precisam de novo salvamento do contrato: ao abrir a tela,
`contasDesatualizadas(contas, contratos)` compara o que está gravado com o que
as regras produzem agora e, havendo diferença, `sincronizarContasDaObra` grava
a correção — uma vez só (a comparação é por id/valor/vencimento/descrição, e
não pela ordem, senão a tela gravaria em laço). Parcelas pagas ficam como
estão, e contas avulsas não são tocadas.

## A linha da conta: duas linhas, o resto ao abrir

A descrição de um item de contrato costuma ser um parágrafo inteiro, e a
linha da conta crescia a ponto de a lista virar um texto corrido. Agora a
linha fechada tem **no máximo duas**, ambas cortadas com reticências:

1. `tituloCurtoConta()` — "Contrato 0004 · Parcela 2/10", mais "· estimada"
   quando é o caso. Uma descrição curta (até 42 caracteres) vale mais que o
   número da parcela e entra no lugar dela: "Entrada", "Saldo na conclusão",
   "Portão basculante — entrada".
2. `apoioCurtoConta()` — quem recebe e o serviço, mais a conta do plano.

Clicar na linha abre o detalhe (▸ / ▾): a descrição inteira e os campos que
não cabiam — conta, favorecido, serviço, origem, vencimento (com "prevista"
quando estimado), data de contabilização, dia em que foi registrada, valor
pago e observação. Os botões de ação não abrem nem fecham nada.

## Dar baixa: a data de contabilização

"Pagar" abre uma telinha antes de gravar, com dois campos:

- **Data de contabilização** — é ela que decide em que mês a despesa entra no
  extrato da obra. Vem sugerida com o vencimento, quando já passou, ou com
  hoje. Fica gravada em `pagoEm`.
- **Valor pago** — vem com o valor da parcela e pode ser ajustado
  (`valorPago`); é o valor que o extrato usa.

O valor dos campos passa por `numeroDeCampo()`: `CampoCtrNum` entrega
**número** (10833.33), e a primeira versão tratava tudo como texto pt-BR,
tirando os pontos — o que multiplicava por 100 toda parcela com centavos
(R$ 10.833,33 virava R$ 1.083.333,00). Agora número passa direto, texto com
vírgula é lido como pt-BR e texto sem vírgula tem o ponto como decimal.

Junto vai `contabilizadoEm`, com o dia em que se registrou — o histórico de
quando a baixa foi feita, que não se confunde com a competência escolhida. A
linha da conta paga mostra "contabilizado em DD/MM/AAAA". "Desfazer" continua
imediato e limpa os três campos.

## Extrato mensal da obra (P&L realizado)

Terceira visão do Planejamento, no formato da planilha que o escritório já
usava: barra com **EXTRATO OBRA — mês**, os grupos de `GRUPOS_PL` com seus
totais (ENTRADAS TOTAIS, MATERIAL & INSUMOS, MÃO DE OBRA & PRESTADORES,
SERVIÇOS & TAXAS), uma linha por conta do plano de contas com movimento,
**SALDO DO MÊS** e **SALDO FINAL** (acumulado do início da obra até aquele
mês).

- `extratoMatriz(contas, entradas, meses, estimativa)` monta a tabela: uma
  coluna por mês pedido, a coluna **Contabilizado** (o acumulado da obra
  inteira) e a coluna **Estimado**, que vem de `estimativaPorConta()` — a soma
  dos itens do Planejamento por conta do plano. Despesa entra pelo mês de
  `pagoEm`, nunca pelo vencimento; entrada, pelo mês de `data`.
- O menu **Ver** decide as colunas: "Só o total da obra" (como a tela abre),
  "Todos os meses", "Meses de <ano>" ou um mês específico. Nas colunas entram
  só os meses com movimento; no menu o mês corrente também aparece, para se
  registrar uma entrada nele.
- Uma conta aparece na tabela se tem movimento **ou** estimativa — assim o
  estimado que ainda não teve gasto continua visível.
- `extratoMensal(contas, entradas, mes)` continua para o mês isolado.
- `mesesDoExtrato(...)` lista os meses com movimento, mais o corrente, para o
  seletor nunca abrir vazio.
- `acumuladoAte(...)` é o saldo final: entradas menos custos até o fim do mês.
- As **entradas da obra** (aportes) moram em `obra.entradas` e usam as contas
  do grupo `receitas` — "＋ Registrar entrada" cria, edita e remove ali mesmo.

## Recalibrar as datas do contrato

O contrato costuma ser registrado antes de a obra começar de fato, e a data
combinada escorrega. Em Contas a pagar, ao lado de "＋ Nova conta", o botão
**Recalibrar datas** abre uma telinha: escolhe-se o contrato e a nova data do
**primeiro pagamento**, e ela mostra a prévia — de → para — das quatro
primeiras parcelas em aberto antes de gravar.

Ao confirmar, `recalibrarContrato()` grava a data em `primeiroVencimento` do
contrato (o texto do contrato passa a citá-la) e
`sincronizarContasDaObra()` reescreve as parcelas em aberto na mesma
periodicidade. **Parcela paga não se move**: ela fica com a data em que foi
paga e com o valor pago, e nem aparece na prévia.

**Entrada + saldo item a item não tem "primeira data".** Nesse contrato cada
item tem o seu próprio ciclo — entrada na liberação, saldo na conclusão —, então
a telinha troca de forma (`contratoPorItem()`): em vez de uma data, lista os
itens com **Início** e **Conclusão** cada um, mais a previsão padrão do
contrato para quem não tiver conclusão própria. `recalibrarItens()` grava as
datas nos itens e a prévia sai de `previaEntreContratos()`, que compara as
duas versões do contrato — serve para os dois modos.

## Datas estimadas

Nem toda data é vencimento pactuado. Quando o pagamento depende de um evento
futuro — a conclusão do serviço, ou uma medição —, a conta nasce com
`estimada: true` e a tela mostra "· estimada" ao lado do título e **prevista**
sob a data.

- **Entrada + saldo no final**: a entrada vence na assinatura (data firme); o
  saldo usa o campo **Previsão de conclusão** do contrato e, sem ele, o fim do
  prazo de execução.
- **Item a item**: cada item tem duas datas próprias na tabela de itens —
  **Início** (quando o item é liberado para produção: é quando vence a entrada
  dele) e **Previsão de conclusão** (quando vence o saldo). Sem o início, a
  entrada cai na assinatura e é data firme; com o início preenchido, é
  estimativa. Sem a previsão, o saldo usa a previsão de conclusão do contrato.
  Antes essas parcelas nasciam sem data nenhuma.
- **Por medição**: como já era, uma conta por período dentro do prazo.

Fluxo do contrato atrasado, ponta a ponta (conferido em Chromium): informar o
primeiro vencimento no mês passado → salvar → as seis parcelas nascem a partir
daquele mês → a do mês passado aparece **Vencida** no grupo do mês e no quadro
"Vencido" → botão **Pagar** → o quadro Vencido zera, o Pago sobe e a barra
daquele mês sai do gráfico de "a pagar".

## Ler sempre o registro fresco da obra

`obraSelecionada` é uma **cópia** guardada no estado quando a obra foi aberta.
Ela envelhece na hora em que um contrato, uma conta ou um item do P&L é salvo:
o que muda é `data.obras`, não a cópia. Ler dela deixava o quadro **Contas a
pagar** do menu da obra parado no valor antigo — um contrato novo gerava as
parcelas, gravava certo, e o quadro continuava mostrando o total anterior até
sair da obra e entrar de novo.

Por isso o painel calcula uma vez

```js
const obraAtual = obraSelecionada ? (obras.find(o => o.id === obraSelecionada.id) || obraSelecionada) : null;
```

e **toda leitura** de dado da obra (contas, cronograma, `estimativaPL`) sai de
`obraAtual`; a cópia do estado serve só de reserva enquanto a obra não estiver
na coleção. Toda escrita continua partindo de `obraAtual` também — foi o que
já impedia que salvar a estimativa apagasse contratos salvos depois.

## Acesso do cliente

O cliente final entra no mesmo site, com **login e senha próprios**, e vê a
área de acompanhamento das obras dele — não o app do escritório.

**Como se cria.** No cadastro do cliente, o bloco "Acesso do cliente" (só para
admin do escritório) pede o e-mail e devolve a **senha inicial uma única vez**,
para você passar ao cliente; ele troca no primeiro acesso. Dali dá para gerar
nova senha ou desativar o acesso quando a obra acabar.

**O que ele pode.** Ver as obras dele por inteiro — contas a pagar, extrato
mensal, contratos, cronograma e orçamento — e agir onde é dele:

| pode | não pode |
| --- | --- |
| dar baixa em conta (data de contabilização e valor) | cadastrar ou editar obra |
| lançar conta avulsa (despesa) | gerar, editar ou remover contrato |
| registrar entrada/aporte | mexer na estimativa do Planejamento |
| dar **aceite** em contrato | recalibrar datas de contrato |
| abrir e imprimir o contrato | ver outros clientes |

**Aceite.** No contrato aberto, o botão "Dar aceite" grava quem deu e quando
(`obra.aceites`), e o selo passa a aparecer na lista de contratos para os dois
lados.

**Como o cerco é feito.** Não é só a tela: o usuário tem `perfil='cliente'` e
`cliente_id` no backend, e ali (a) a lista de caminhos que ele pode chamar é
curta (ler clientes/obras/fornecedores/escritório/orçamentos; gravar só obras),
(b) cada endpoint filtra pelo `cliente_id` do token, e (c) ao gravar uma obra o
servidor **aceita apenas** `contasPagar`, `entradas` e `aceites` — o resto do
documento fica como o escritório gravou, mesmo que a requisição venha
adulterada.

## O gráfico segue o agrupamento: barra para tempo, anel para entidade

O "Agrupar por" troca a pergunta, então troca o gráfico:

| agrupar por | pergunta | forma |
|---|---|---|
| Mês, Ano | quando vou pagar | barras (série temporal) |
| Fornecedor, Contrato | quanto do que devo a cada um já saiu | um anel por grupo |

Mês fora de ordem não quer dizer nada — série temporal é barra. Já
"pago sobre o devido" é uma razão contra um limite, uma por grupo, e a forma
disso é o mesmo anel do Planejamento repetido. `visaoUsaAnel()` decide, a
partir de `VISOES_CONTAS_EM_ANEL`.

**Por contrato é onde o anel diz mais**: o total é o valor contratado, então o
preenchimento é literalmente o quanto do contrato já foi pago. O rótulo
acompanha — "Contratado" nos contratos, "Total" no grupo de contas avulsas,
que não foi contratado por ninguém (`avulso`, a partir de `CHAVE_SEM_GRUPO`).

O vencido não entra no anel: seria uma segunda dimensão no mesmo desenho.
Ele aparece como linha vermelha no cartão quando existe.

### Os anéis somam a obra inteira

Os quadros do topo e o mês escolhido no gráfico filtram a **lista de baixo**.
Os anéis, não: "pago de total" precisa dos dois lados, e o filtro padrão é
"a pagar", que esconde justamente as pagas — todo anel sairia em 0%. Por isso
`gruposCheios` reagrupa `contasDaObra` sem filtro algum, e a nota abaixo dos
cartões diz isso.
