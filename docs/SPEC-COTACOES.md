# Cotações de fornecedores

Fica dentro da obra, ao lado de Contratos, Cronograma e Contas a pagar. O
escritório abre uma cotação, registra as propostas que recebeu, compara e
escolhe uma; o cliente aprova ou recusa no ambiente dele; o escritório lança
a escolhida em contas a pagar, e o valor entra no P&L pela conta da cotação.

## Onde os dados moram — e por que em dois campos

```
obra.cotacoes[]          escrito SÓ pelo escritório
obra.aprovacoesCotacao[] escrito SÓ pelo cliente
```

A separação é a garantia. O backend libera para o perfil cliente apenas uma
lista curta de campos no `POST /api/obras`
(`contasPagar`, `entradas`, `aceites`, `aprovacoesCotacao`); tudo o mais é
sobrescrito com o que já estava gravado. Se a decisão do cliente morasse
dentro de `obra.cotacoes`, liberar esse campo daria a ele o poder de trocar
valor, fornecedor e vencedor. É o mesmo desenho dos aceites de contrato.

## A cotação

```
{ id, obraId, criadaEm, titulo, escopo, contaId, etapaId, quantidade, unidade,
  prazoResposta, precisaAprovacaoCliente, status, escolhidaId, contaGeradaId,
  propostas: [{ id, fornecedorId, favorecido, valor, prazoDias,
                condicaoPagamento, validade, observacao, recebidaEm }] }
```

`contaId` é a conta do plano (obra-financeiro.jsx) — é ela que decide onde o
gasto cai no P&L quando a cotação virar conta a pagar.

## Situação — a ordem dos testes é a ordem do fluxo

cancelada → lançada → recusada → aprovada → aguardando propostas →
comparando propostas → aguardando o cliente → escolhida.

O primeiro que casar manda, e é isso que faz "lançada" continuar aparecendo
mesmo depois de o cliente ter aprovado.

## Trava do lançamento

`podeLancarCotacao` devolve `{ pode, motivo }` — a tela mostra o motivo ao
lado do botão em vez de só desabilitá-lo. Bloqueia sem escolha, com escolha
sem valor, com recusa do cliente, com aprovação pendente (quando exigida) e
quando já foi lançada.

## Ordenação das propostas

Da mais barata para a mais cara; proposta sem valor vai para o fim. Se fosse
para o começo, "mais barata" mentiria — uma proposta ainda não preenchida
apareceria como a melhor oferta.

## Economia

Comparada com a proposta mais cara recebida. Com uma proposta só devolve
`null` (comparar consigo mesma daria zero e ocuparia espaço à toa). O resumo
soma apenas a economia de cotações já aprovadas ou lançadas — antes disso
não há economia realizada.

## O ambiente do cliente

Não existe tela separada: a área do cliente reaproveita `GestaoObraPanel`
inteiro. Quem separa é `perm.podeGerenciarObra` — sem ele somem criar,
editar, escolher e lançar, e aparecem Aprovar e Recusar. **Toda tela nova no
painel da obra já nasce espelhada; o que precisa ser decidido é o que o
cliente NÃO pode fazer nela.**

## Armadilha ao gravar a obra

`obras` recebido pelas telas da obra é só a fatia do cliente atual. Fazer
`save({ ...data, obras: obras.map(...) })` apaga as obras dos outros
clientes — `saveAllData` compara as duas listas e manda `DELETE` no que
sumiu. Use sempre `mesclarPorCliente(data.obras, clienteId, fatia)`.
Cronograma e orçamento tinham esse bug e foram corrigidos junto.
