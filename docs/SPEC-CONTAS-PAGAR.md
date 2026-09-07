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

## A tela: fluxo agrupado

A lista não é mais fatura atrás de fatura. Há um cabeçalho de colunas
(**Documento · Vencimento · Status · Valor**) e as contas vêm agrupadas, cada
grupo com o total em aberto e o vencido, podendo abrir e fechar. Os meses a
partir do atual já vêm abertos.

- **Agrupar por** (`VISOES_CONTAS`): Mês · Ano · Fornecedor · Contrato. Mês e
  ano saem em ordem cronológica; fornecedor e contrato, do maior valor para o
  menor. O que não tem vencimento (ou fornecedor) fecha a lista.
- **Mostrar** (`FILTROS_CONTAS`): Todas · A pagar · Vencidas · Pagas.

Os quatro totais do topo (a pagar, vencido, pago, total) somam sempre a obra
inteira, independentemente do filtro.

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
