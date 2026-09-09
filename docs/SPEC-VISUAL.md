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

## Item de canteiro só quando a atividade acontece

Alguns itens entravam com quantidade fixa, sem olhar se a atividade existia
na obra: a bombeada de concreto (1 por laje, 1 na fundação) e o compactador
(2 dias). Numa térrea com telhado direto sobre a parede, ou numa reforma sem
laje nova, a bomba da laje entrava assim mesmo — cobrando um caminhão que
ninguém chamou.

Agora cada um depende do que ele serve:

| item | só entra se |
|---|---|
| Concreto - Bomba (laje térreo) | área de laje ou de laje maciça do térreo > 0 |
| Concreto - Bomba (laje pav. 1) | área de laje ou de laje maciça do pav. 1 > 0 |
| Concreto - Bomba (fundação) | volume de concreto da fundação > 0 |
| Compactador (contrapiso do térreo) | área do térreo > 0 |
| Compactador (piscina) | área construída da piscina > 0 |

A quantidade continua fixa — uma bombeada, dois dias — porque é o que a
planilha do escritório sempre usou; o que mudou é o **se**. Concretagem em
mais de um dia continua sendo ajuste manual no item.

A memória de cálculo desses itens agora mostra a medida que os liberou e
termina na quantidade, como todas as outras linhas.

## Quadro de Prestadores: o resultado, editável

O bloco de Prestadores eram 16 campos com o nome cru do código
(`equipePedreiros`, `instaladorEquipPiscina`), sem unidade, e o valor
digitado era uma **verba fechada** que substituía um cálculo que a tela não
mostrava. Não dava para saber o que entraria deixando em branco.

Agora é o mesmo desenho da tabela do resultado, editável:

```
    Empreiteiro                                          R$ 215.000,00
[x]   Casa                      m²   (200) (1.000,00)   R$ 200.000,00
      referência da planilha do escritório
[x]   Pavimentação externa      m²    (60)   (120,00)     R$ 7.200,00
[x]   Muro de divisa            m²    (60)   (130,00)     R$ 7.800,00
[x] Gestão Obra                 m²   (200)   (550,00)   R$ 110.000,00
    escada regressiva da gestão de obra
[ ] Serralheiro                 un     (1)         (—)         R$ 0,00
    sem preço — cadastre em Insumos ou digite aqui
                                      Total dos prestadores  R$ 383.000,00
```

- **tique** — se o serviço entra no orçamento;
- **quantidade** — em branco usa a medida do projeto (área construída, m² de
  muro, de pavimentação, de piscina; 1 para serviço fechado). O sugerido
  aparece como placeholder;
- **preço unitário** — em branco usa o catálogo de Insumos; sem cadastro, a
  referência da planilha. A linha de baixo diz de onde veio;
- **total** por linha e do quadro.

`PRESTADORES_OBRA` é fonte única: desenha o quadro e emite o orçamento. Um
teste confere linha a linha que o que a tela mostra é o que o orçamento
recebe.

### O empreiteiro é um só, com uma linha por frente

Casa, pavimentação externa, muro de divisa, muro de arrimo e piscina são o
mesmo empreiteiro cobrando por frente de obra. As cinco linhas trazem
`grupo: "Empreiteiro"` e vêm em sequência na tabela: o quadro desenha um
cabeçalho com subtotal e recolhe as filhas, cada uma com sua própria
metragem (área construída, m² de pavimentação, m² de cada muro, área da
piscina) e seu próprio preço.

O orçamento continua emitindo **uma linha por frente** — `Empreiteiro - Casa`,
`Empreiteiro - Muro de divisa` etc. — que é como o empreiteiro fatura e como o
cronograma acha o valor contratado de cada ofício (`itemDoPrestador`). No
catálogo de Insumos os códigos seguem sendo PRE-001/009/010/011/012 com os
nomes antigos; `INSUMO_PRESTADOR` é quem faz a ponte, então renomear na tela
não desfaz nenhum preço já cadastrado.

### Preço e metragem em português

Os dois campos são texto, não `input[type=number]`: aceitam **1.250,50** — o
ponto é milhar quando há vírgula. Enquanto se digita, o texto fica como foi
escrito (senão o cursor pularia a cada tecla); ao sair do campo ele volta
formatado, com duas casas no preço e nenhuma na metragem. `numeroDigitadoBR`
converte para número e `textoNumeroBR` de volta para texto.

### Sem preço não entra marcado

Linha sem preço de referência e sem preço digitado nasce **desmarcada** — em
vez de entrar somando R$ 0 e sumir no total. Linha sem medida nem nada
digitado nem aparece no quadro (carpinteiro antes de lançar o telhado).

### O formato antigo migra preservando o total

Valor fechado de R$ 26.000 no pintor de uma casa de 200 m² vira 200 m² ×
R$ 130. Onde não há medida (serviço fechado), vira quantidade 1 com o valor
no preço. O total é o que a migração garante.

## O nome do item carrega a resistência do concreto

O item que o quantitativo emite **é** a chave de preço: o catálogo tem
`Concreto - FCK20/25/30/35`, não tem nenhum "Concreto". Quem emitia um nome
pelado emitia uma linha de R$ 0,00 sem aviso.

O select de resistência mostrava `Concreto - FCK25` como escolhido, mas isso
era só `get(...) || "Concreto - FCK25"` na tela — **nada era gravado até o
usuário mexer no campo**. Quem preenchia o projeto estrutural e deixava o
select como estava recebia `"Concreto"` na fundação e na laje, zerado.

Agora há uma função só, `nomeConcreto()`, entre a escolha e o nome do item:
devolve a resistência escolhida se ela for uma das quatro do catálogo, e o
padrão da casa (FCK25) em qualquer outro caso — vazio, lixo, ou um valor
antigo. Ela é usada nos sete pontos que emitem concreto (fundação, laje e
laje maciça do térreo e do pav. 1, arrimo, piscina), na `normalizarProjeto`
(o padrão passa a ser guardado, não desenhado) e nos próprios selects, para
que tela e motor leiam a mesma constante.

`OPCOES_FCK` e `FCK_PADRAO` subiram para o lado do motor — estavam na região
da UI, abaixo do corte `// UI (§7)`, onde o cálculo não os enxergava.

FCK35 estava no select sem existir em Insumos: escolher a mais resistente das
quatro era a única opção que zerava a linha. Entrou como **CON-005**, com
preço extrapolado da escada FCK20→25→30 e a observação dizendo que é um
provisório à espera da cotação da usina.

Dois testes guardam isso em `precos-quantitativo.test.mjs`: um preenche o
projeto estrutural sem tocar no select e exige que todo concreto emitido
termine em `FCK<n>` e tenha preço; o outro percorre `OPCOES_FCK` e exige que
cada opção oferecida exista no catálogo com preço.
