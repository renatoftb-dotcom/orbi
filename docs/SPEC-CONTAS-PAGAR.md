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
gestão de obra → `mo_diversos` —, o prestador e o nome do favorecido.

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
entre uma e outra), com o valor aparecendo logo depois; quem tem
`prefers-reduced-motion` ligado vê o gráfico parado.

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
