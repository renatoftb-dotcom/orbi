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

## O que não foi tocado

`orcamento-teste.jsx`, `modelo-padrao.jsx`, `template-edicao.jsx`,
`modelos-registry.jsx`, `orcamento-onboarding.jsx`, `orcamento-config.jsx` —
o módulo de orçamento de projeto — e os módulos de impressão
(`resultado-pdf.jsx`, `render-pdf-route.jsx`), cujo visual é o do documento.
