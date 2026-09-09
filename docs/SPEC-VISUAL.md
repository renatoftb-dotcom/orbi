# SPEC — Formato visual do app

Um formato só, aplicado em todos os módulos **menos o de orçamento de
projeto** (`projetos:orcamentos`), que tem visual próprio e ficou intocado.

## Escala de texto

| onde | cor |
| --- | --- |
| valores, títulos, datas, campos, item ativo | `#111827` (preto) |
| texto secundário, rótulos, item inativo | `#4b5563` (cinza escuro) |
| terciário, notas de rodapé | `#6b7280` |

O cinza pálido (`#9ca3af`, `#78716c`, `#8a8a8a`) saiu de todas as cores de
texto: era o que deixava a tela lavada.

## Interação — azul #0474f4

- **hover** e **foco** de campo, seletor, área de texto e botão: borda azul;
  o foco leva também um halo `rgba(4,116,244,0.18)`.
- **selecionado**: em botões, abas e cartões o fundo continua **branco** — a
  seleção é marcada só pela borda e pelo texto em azul. O preenchimento azul
  claro `#eef5ff` fica reservado ao **menu lateral do app**, que segue com o
  item ativo em fundo azul claro.

A regra de hover/foco é uma folha só, declarada em `app.jsx` e escopada por
`data-vk-ui`, que a área de conteúdo aplica em todos os módulos exceto o de
orçamento de projeto:

```jsx
<div data-vk-ui={aba === "projetos:orcamentos" ? undefined : "1"}>
```

Para as bordas que são estilo inline (seleção), os módulos usam a constante
`AZUL_VK`.

## Superfícies

Fundo das telas em `#fafafb` (cinza quase branco) — o areia `#f5f3f0` saiu.
Cartões e blocos em branco, bordas finas `rgba(38,36,33,0.14)`, blocos
auxiliares em `#fafafa`. O pêssego `#fdf6f0` de item selecionado e o
`#faf9f7` de hover viraram o azul claro `#eef5ff`. Sem fundo cobre, âmbar ou verde; sem ícone colorido de cabeçalho;
sem etiqueta colorida de status — status é texto, com negrito no que exige
atenção.

O cobre `#b5652f` saiu de todos os módulos cobertos — títulos de seção,
contornos de botão, links de ação e realces de hover viraram azul ou preto.
A única cor fora do azul é o vermelho de ações destrutivas (`#dc2626`), mais
os fundos de alerta.

## Listas: um cartão só, em todo lugar

A lista de clientes é o modelo: cartão branco, borda de 1px
`rgba(38,36,33,0.14)`, raio 16, `padding: 14px 16px`, `display: flex` com
`gap: 14`, quadrado de iniciais 40×40 (raio 14), nome em 14/600, uma linha de
apoio em 12 `#4b5563`, e à direita o status em negrito mais os botões de ação
com borda fina. O hover troca a borda por `#0474f4` e acende o anel
`0 0 0 3px rgba(4,116,244,0.12)`.

A **lista de obras** (Clientes → cliente → Obras) usa exatamente esse cartão:
iniciais da obra num quadrado neutro (`#f3f4f6`, sem cor), nome, linha de
apoio com cidade · responsável · nº de contratos, e à direita o status
("Planejamento", "Em execução", "Concluída") com o botão Editar. O cabeçalho
e o botão são os do painel de Projetos, ao lado: título, contagem e um
`C.btn` escuro — **+ Nova obra** para **+ Novo projeto**. O botão redondo de
"+" que existia ali saiu.

## O que não foi tocado

`orcamento-teste.jsx`, `modelo-padrao.jsx`, `template-edicao.jsx`,
`modelos-registry.jsx`, `orcamento-onboarding.jsx`, `orcamento-config.jsx` —
o módulo de orçamento de projeto — e os módulos de impressão
(`resultado-pdf.jsx`, `render-pdf-route.jsx`), cujo visual é o do documento.


## Tabela do quantitativo: agrupada pelo serviço

Cada linha do orçamento carrega `etapa` e `subEtapa`. A tabela mostrava só a
etapa, então "Construção existente" saía com três `Sacos de cimento 50kg`
seguidos — um da parede, um do contrapiso, um da calçada — e duas
`Areia Grossa`, sem dizer qual era qual. Impossível conferir ou comprar por
serviço.

`agruparPorSubEtapa()` junta as linhas pelo serviço que as gerou,
preservando a ordem de emissão do motor, e a tabela ganha uma linha de
título com o nome do serviço e o subtotal dele:

```
▸ Contrapiso                              R$ 21.747,00
    Areia Grossa            m3        2
    Pedra                   m3        4
    Sacos de cimento 50kg   Unidades  27
    Aço - Malha Pop         Unidade   5
▸ Calçada                                 R$ 15.320,00
    Areia Grossa            m3        2
    ...
```

Com uma sub-etapa só, o título não aparece — o da etapa já diz. Vale para
todas as etapas, não só a reforma: "Contrapiso Interno" também separa o
contrapiso do massiamento.
