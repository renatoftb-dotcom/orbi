# Reforma no quantitativo da obra

Antes, "Reforma" existia como opção no bloco Geral mas não mudava uma linha
do cálculo — o quantitativo saía inteiro pelo modelo de construção nova.

## As duas obras dentro de uma reforma

**A parte nova** (ampliação, laje nova, telhado novo) usa os blocos de
sempre, sem nenhuma mudança: são metros quadrados que não existiam e se
comportam como obra nova.

**A parte existente** ganhou o bloco **Construção existente**, que só aparece
quando `tipoObra = "reforma"`. Ali não há modelo de prédio nenhum: entra o
que o arquiteto mediu na visita.

```
projeto.existente = {
  // demolir e remover
  paredeDemolir, revestimentoRemover, pisoRemover, contrapisoRemover,
  forroRemover, esquadriaRetirar, banheiroDesmontar,
  // construir e assentar
  paredeConstruir, rebocoNovo, contrapisoNovo, pisoAssentar,
  revestimentoAssentar, pinturaExistente, banheiroMontar,
}
```

`rebocoNovo` vazio herda a área de `paredeConstruir` — parede nova sempre
leva chapisco e reboco, e obrigar a digitar duas vezes a mesma medida só
gera divergência.

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

Mais 0,3 m³ por banheiro desmontado (vaso, cuba e acessórios).

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
