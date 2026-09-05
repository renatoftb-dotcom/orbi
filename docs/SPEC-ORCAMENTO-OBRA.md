# SPEC — Orçamento de Obra (quantitativos + custo estimado) no módulo Clientes

Objetivo: dentro da obra de um cliente, preencher os dados do projeto (áreas,
perímetros, m² de parede, vãos, telhados, ferro, concreto) e obter a lista de
insumos com quantidades e o custo estimado.

A lógica é uma transcrição de um motor em VBA que roda em produção
(`NOVO MODELO ORÇAMENTO.xlsm`, ~13.000 linhas, 41 módulos). **O código-fonte
desse motor está em `docs/referencia-orcamento/` — ele é a fonte da verdade das
fórmulas, não este documento.** Este documento diz como estruturar; os `.bas`
dizem o que calcular.

---

## 0. Regras do repositório

- **Nunca editar `src/AppCombined.jsx`** — é gerado por `node combine.js`.
- **Reler os arquivos do disco antes de editar.** Codebase editado em paralelo.
- Vite + React, sem TypeScript, sem CSS framework, estilos inline.
- Backend: nenhuma mudança nesta entrega (ver §8).

---

## 1. Material de referência (leia antes de codar)

```
docs/referencia-orcamento/
├── vba/                        ← código VBA original, fonte da verdade
│   ├── A_GERAR_ORCAMENTO.bas   ← orquestrador: a ordem de execução
│   ├── Z_DECLARAR_VARIAVEIS.bas← ordem das etapas + pesos do ferro
│   ├── ZZ_ATUALIZAR_CAMPOS.bas ← declaração dos 477 campos CP_ (com tipo)
│   ├── B_INSTALACOES_OBRA_PROJETOS.bas
│   ├── C_FUNDACAO.bas
│   ├── E_CONTRAPISO_INTERNO_TERREO.bas
│   ├── F_PAREDES_TERREO.bas
│   ├── G_VIGA_RESPALDO_LAJE_TERREO.bas
│   ├── H_PAREDES_PAV_1.bas
│   ├── I_VIGA_RESPALDO_LAJE_PAV_1.bas
│   ├── J_SUPRA_COBERTURA.bas
│   ├── K_COBERTURA.bas          ← o mais complexo (898 linhas, laço de 16 telhados)
│   ├── L_CHAPISCO_REBOCO.bas
│   ├── M_PINTURA.bas
│   ├── N_CONTRAPISOS_EXTERNOS.bas
│   ├── O_MURO_DIVISA.bas
│   ├── Q_MURO_ARRIMO.bas
│   ├── R_PISCINA.bas
│   ├── P_PRESTADORES.bas        ← único módulo que já traz preço
│   └── PRESTADORES.frm          ← tabela de taxas R$/m² da mão de obra
├── inputs.json                 ← 477 campos CP_ com tipo e bloco
├── formulas.json               ← 327 fórmulas CALC_ indexadas por módulo
└── itens.json                  ← 286 emissões / 113 insumos distintos,
                                   com item/tipo/etapa/subEtapa/unidade
```

Os `.json` são índices de conveniência, gerados por parsing. **Onde houver
divergência, o `.bas` vence** — ele tem os condicionais, a ordem e o contexto
que o parser não captura.

---

## 2. Como o motor funciona (o padrão a reproduzir)

Todo módulo faz três coisas, nesta ordem:

1. **Lê inputs** `CP_*` — os dados do projeto.
2. **Calcula quantidades** `CALC_*`, sempre no formato
   `Math.ceil(input × coeficiente × 1.1)`.
3. **Emite linhas** com `ordem | item | tipo | etapa | subEtapa | unidade | qtd`,
   **e só emite se a quantidade for diferente de zero.**

Exemplo real (`F_PAREDES_TERREO.bas`):

```
tijolo6F    = ⌈ m²parede20 × 40 × 1,1 ⌉
tijolo8F    = ⌈ (m²parede25 × 40 + m²parede15 × 20) × 1,1 ⌉
areiaFina   = ⌈ (tijolo6F × 0,001638 + tijolo8F × 0,002223) × 1,1 ⌉
vedalit     = ⌈ areiaFina / 25 × 1,1 ⌉
cimento     = ⌈ areiaFina × 2 × 1,1 ⌉
contraverga = ⌈ vãoPortasJanelas × 2 / 12 × 1,1 ⌉
```

Três constantes globais governam tudo:

```js
const PERDA = 1.1;              // 10% de perda, aplicado em TODA linha
const BARRA_FERRO_MTS = 12;     // metros → barras: ceil(mts / 12 * 1.1)
const PESOS_FERRO = {           // kg por barra de 12m
  CA60_4MM: 1.31,  CA50_5MM: 1.92,  CA50_6MM: 3.00,  CA50_8MM: 4.80,
  CA50_10MM: 7.56, CA50_12MM: 11.56, CA50_16MM: 18.94, CA60_5MM: 1.92,
};
```

Derivados recorrentes: `arame = ⌈ pesoFerro × 0,06 × 1,1 ⌉`,
`prego18x27 = ⌈ arame × 0,55 ⌉`.

---

## 3. Arquitetura no VICKE

### 3.1 Módulo novo

Criar `src/modules/orcamento-obra.jsx` e registrar em `combine.js`:

```js
const ORDER = [
  "shared.jsx",
  "api.js",
  "outros.jsx",
  "orcamento-obra.jsx",   // ← NOVO: motor + UI, antes de clientes.jsx
  "clientes.jsx",
  ...
];
```

Se o arquivo passar de ~2.500 linhas, quebrar em
`orcamento-obra-motor.jsx` (cálculo puro) + `orcamento-obra.jsx` (UI), nessa
ordem no `ORDER`.

### 3.2 Onde entra na UI

`clientes.jsx` → `GestaoObraPanel` → view `detalheObra`. Hoje há 3 cards
(Contratos, Cronograma, Documentos). Adicionar o card **"Orçamento"**, que leva
à view `orcamento`. Grid passa a `repeat(2, 1fr)` no desktop.

> Se a spec do P&L (`docs/SPEC-PL-OBRA.md`) já tiver sido implementada, o card
> "Financeiro" também está lá — nesse caso são 5 cards, grid `repeat(3, 1fr)`.

### 3.3 Modelo de dados

Tudo dentro de `obra` (que já é JSONB em `obras.dados`):

```js
obra = {
  id, clienteId, nome, status, ...      // já existe

  projeto: {                            // NOVO: os inputs CP_
    tipologia: "Sobrado" | "Térrea",
    arquitetura: { ... },
    terreo:      { ... },
    pav1:        { ... },
    lajes:       { ... },
    cobertura:   [ { tipo, comprimento, largura, aguas, inclinacao }, ... ],
    engenharia:  { fundacao: {...}, colunas: {...}, vigas: {...} },
    externa:     { pavimentacao, perimetro, muroDivisa: {...} },
    arrimo:      { ... },               // opcional
    piscina:     { ... },               // opcional
    prestadores: { ... },
  },

  orcamento: {                          // NOVO: snapshot do resultado
    geradoEm: "2026-09-05T20:00:00Z",
    versao: 1,
    itens: [ { ordem, item, tipo, etapa, subEtapa, unidade, qtd, preco, total } ],
    totais: { bruto, acabamento, prestadores, geral },
  },
}
```

**Nomes dos campos**: use camelCase agrupado como acima, e mantenha um mapa
explícito `CP_NOME_VBA → caminho.no.objeto` no topo do módulo. Não replique os
nomes `CP_` gritados no objeto — mas **documente a correspondência**, porque é
por ela que se confere contra a planilha.

### 3.4 Preço — placeholder nesta entrega

```js
const PRECO_PADRAO = 1;

// Ponto único de resolução de preço. Hoje devolve 1 para tudo.
// Depois: busca em data.materiais por nome → ultimoPreco; se não achar,
// média das últimas compras em data.lancamentos; se não achar, 1.
function precoDoInsumo(nomeItem, data) {
  return PRECO_PADRAO;
}
```

**Toda** linha do orçamento passa por essa função — nenhuma outra parte do
código pode ter preço hardcoded. Quando a tabela de preços entrar, muda-se uma
função só.

Exceção: `P_PRESTADORES` **já traz preço** no VBA (taxa × m²). Esses valores são
reais e devem ser preservados, não substituídos por 1. Ver §5.

---

## 4. O motor — função pura

```js
/**
 * @param {object} projeto  obra.projeto
 * @param {object} data     data global (para precoDoInsumo)
 * @returns {{ itens: Array, totais: object, avisos: Array }}
 */
function gerarOrcamentoObra(projeto, data) { ... }
```

Sem React, sem side-effect, testável com `node`. Estrutura interna espelhando
o `A_GERAR_ORCAMENTO.bas`:

```js
function gerarOrcamentoObra(projeto, data) {
  const cp = normalizarProjeto(projeto);   // preenche zeros, valida
  const out = [];                          // acumulador de linhas

  instalacoesObraProjetos(cp, out);
  fundacao(cp, out);
  contrapisoInternoTerreo(cp, out);
  paredesTerreo(cp, out);
  vigaRespaldoLajeTerreo(cp, out);
  if (cp.tipologia === "Sobrado") {
    paredesPav1(cp, out);
    vigaRespaldoLajePav1(cp, out);
  }
  supraCobertura(cp, out);
  cobertura(cp, out);
  chapiscoReboco(cp, out);
  pintura(cp, out);
  contrapisosExternos(cp, out);
  muroDivisa(cp, out);
  muroArrimo(cp, out);
  piscina(cp, out);
  prestadores(cp, out);

  return precificarETotalizar(out, data);
}
```

Um helper de emissão, usado por todos:

```js
function emitir(out, { ordem, item, tipo, etapa, subEtapa, unidade, qtd, preco }) {
  if (!qtd || qtd === 0) return;          // regra do VBA: só emite se ≠ 0
  out.push({ ordem, item, tipo, etapa, subEtapa, unidade,
             qtd: Number(qtd), preco: preco ?? null });
}
```

### Ordem das etapas

De `Z_DECLARAR_VARIAVEIS.bas` — é o campo `ordem`, usado para ordenar o
resultado:

```js
const ORD = {
  prestadores: 0,  instalacoes: 1,  fundacao: 2,  esgotoPluvial: 3,
  contrapisoInterno: 4,  paredesTerreo: 5,  vigaLajeTerreo: 6,
  paredesPav1: 7,  vigaLajePav1: 8,  supraCobertura: 9,  cobertura: 10,
  reboco: 11,  pintura: 12,  contrapisoExterno: 13,  muroDivisa: 14,
  muroArrimo: 15,  piscina: 16,  esquadrias: 17,
};
```

### Regras de transcrição — obrigatórias

1. `WorksheetFunction.Ceiling(x, 1)` → `Math.ceil(x)`.
2. **Não "arrumar" coeficiente nenhum.** Os números vieram de obra executada.
   O `1.1` de perda fica em toda linha onde o VBA o tem, e só nelas.
3. Transcrever **fórmula por fórmula**, conferindo contra o `.bas`. Não
   generalizar padrões parecidos em uma função só — dois módulos que parecem
   iguais (`F_PAREDES_TERREO` e `H_PAREDES_PAV_1`) têm diferenças reais.
4. **Bug conhecido a preservar:** `M_PINTURA.bas` usa
   `If CALC_X <> 0 Or CALC_X <> 0` — condição sempre verdadeira, então a pintura
   emite mesmo com quantidade zero. Reproduza o comportamento (emitir sempre) e
   deixe um comentário `// [VBA] condição sempre-verdadeira no original`.
   Não corrija sem falar com o usuário — pode ser que a saída atual dependa disso.
5. `On Error Resume Next` no VBA vira campo ausente → `0`. Nunca `NaN`,
   nunca `undefined` chegando na conta.
6. Onde o VBA lê `Sheets("GERAL").Range("c6")` para decidir Sobrado, use
   `cp.tipologia`. A aba `GERAL` da planilha está morta (só essa célula é lida);
   não a reproduza.

---

## 5. Prestadores — o único bloco com preço real

`PRESTADORES.frm` traz a tabela de taxas. Transcrever como constante:

```js
const TAXAS_PRESTADORES = {
  equipePedreiros:        { base: "areaConstruida",   valor: 1000 },  // R$/m²
  pintor:                 { base: "areaConstruida",   valor: 100  },
  eletricista:            { base: "areaConstruida",   valor: 80   },
  encanador:              { base: "areaConstruida",   valor: 60   },
  pavimentacaoExterna:    { base: "areaPavimentacao", valor: 120  },
  muroDivisa:             { base: "m2MuroDivisa",     valor: 130  },
  muroArrimo:             { base: "m2MuroArrimo",     valor: 250  },
  pedreirosPiscina:       { base: "areaPiscina",      valor: 1000 },
  terraplanagem:          { base: "fixo",             valor: 8000 },
  instaladorAquecedores:  { base: "fixo",             valor: 2000 },
  instaladorEquipPiscina: { base: "fixo",             valor: 5000 },
};

// Gestão de obra: taxa REGRESSIVA por área construída.
// Quanto maior a obra, menor o R$/m². Faixas exatas do PRESTADORES.frm:
function taxaGestaoObra(areaConstruida) {
  if (areaConstruida > 450) return 430;
  if (areaConstruida < 201) return 550;
  if (areaConstruida < 251) return 530;
  if (areaConstruida < 301) return 510;
  if (areaConstruida < 351) return 490;
  if (areaConstruida < 401) return 470;
  return 450;                                // 401–450 m²
}
```

> Confira a ordem dos `if` contra o original: o VBA usa uma cascata de
> `If area < N Then` que se sobrescreve, e o resultado efetivo é a tabela acima.
> Teste com 200, 250, 300, 350, 400, 450 e 500 m².

No VBA esses valores são **editáveis pelo usuário** no formulário: a taxa só
preenche o campo quando ele está vazio. Reproduza isso — cada prestador tem um
valor sugerido e um campo que o usuário pode sobrescrever, e o override é o que
fica salvo em `projeto.prestadores`.

As linhas de prestador emitem `preco = valorTotal / areaConstruida` e
`total = valorTotal`, com `unidade = "m2"` e `qtd = areaConstruida`.

---

## 6. Etapas — a ponte com o P&L

As etapas que o motor emite são as mesmas do `ETAPAS_OBRA` da spec do P&L.
Essa correspondência é o que vai permitir orçado × realizado depois, então
**mapeie explicitamente**, não por comparação de string:

| Etapa emitida pelo VBA | id em `ETAPAS_OBRA` |
|---|---|
| Instalações pré obra e projetos | `pre_obra` |
| Fundação | `fundacao` |
| Contrapiso Interno / Contrapiso Interno Pav 1 | `contrapiso_int_1` |
| Supra estrutura e paredes | `supra_paredes_1` / `supra_paredes_2` |
| Viga Respaldo e Laje | `laje_1` / `laje_2` |
| Cobertura | `coberturas` |
| Chapisco e Reboco | `chapisco_reboco` |
| Pintura | `pintura` |
| Contrapisos Externos | `contrapiso_ext` |
| Muro Divisa | `muros` |
| Muro Arrimo | `arrimos` |
| Piscina | `piscina_*` (pela sub-etapa) |
| Prestadores de serviços | `prestadores` |

Se `obra-financeiro.jsx` já existir, **importe `ETAPAS_OBRA` de lá** em vez de
redeclarar. Se ainda não existir, declare o mapa aqui e deixe um `TODO` para
unificar depois.

`tipo` tem três valores: `"Bruto"`, `"Acabamento"`, `"Prestadores de serviços"`.

---

## 7. UI

### 7.1 View `orcamento` — três telas

**a) Vazio** — obra sem `projeto`: card centralizado com
*"Nenhum orçamento nesta obra"* + botão **Preencher dados do projeto**.

**b) Formulário** (`view = "formProjeto"`) — os inputs, em blocos colapsáveis.
Nunca uma página só com 200 campos. Blocos, na ordem:

| Bloco | Campos | Obrigatório |
|---|---|---|
| Geral | tipologia, área construída, m² de parede (total/interna/externa), perímetro, gabarito | sim |
| Pav. Térreo | área, m² parede 15/20/25, vão portas e janelas, perímetro | sim |
| Laje Térreo | área, perímetro, área maciça, tipo, FCK | sim |
| Pav. 1 | idem térreo | só se Sobrado |
| Laje Pav. 1 | idem | só se Sobrado |
| Cobertura | lista de telhados: tipo, comprimento, largura, nº de águas, inclinação | sim |
| Revestimento e externa | revestimento interno, pavimentação externa e perímetro | não |
| Muro de divisa | comprimento, altura | não |
| Engenharia — Fundação | estacas (qtd/diâmetro/profundidade), FCK, ferro por bitola e por elemento | não |
| Engenharia — Colunas e vigas | qtd de pilares por espessura, área de forma, ferro por bitola | não |
| Muro de arrimo | bloco inteiro | não |
| Piscina | bloco inteiro | não |
| Prestadores | valores sugeridos, editáveis | sim |

**Campo vazio = 0, e módulo com input zerado não emite nada.** Essa é a
progressividade que o próprio VBA já tem: quem não tem projeto estrutural
preenche só a arquitetura e ainda recebe um orçamento parcial. Deixe isso
explícito na UI — um contador por bloco ("Fundação — 0 de 24 preenchidos,
não entra no orçamento").

Componentes: reaproveitar `C.input` / `C.label` / `C.btn` de `clientes.jsx` e
`InputMoedaBR` (de `onboarding.jsx`) nos campos de dinheiro dos prestadores.
Telhados são uma lista dinâmica (＋ Adicionar telhado / remover), até 16.

**c) Resultado** (`view = "orcamento"`) — a saída:

- Faixa de KPIs: **Total geral**, **Bruto**, **Acabamento**, **Prestadores**,
  **Custo por m²** (total ÷ área construída).
- Aviso fixo enquanto o preço for placeholder: faixa âmbar —
  *"Preços ainda não cadastrados: todo insumo está a R$ 1,00. As quantidades
  são reais; os valores, não."*
- Tabela agrupada por **etapa** (na ordem de `ORD`), colapsável, com sub-total
  por etapa. Colunas: item · unidade · qtd · preço · total.
  `overflow-x: auto` no container; a página nunca rola na horizontal.
- Botões: **Recalcular** (regera do `projeto` atual), **Editar dados do
  projeto**, **Exportar CSV**.
- Rodapé: *"Gerado em …, versão N"*.

### 7.2 Persistência

```js
save({ ...data, obras: data.obras.map(o =>
  o.id === obra.id ? { ...o, projeto, orcamento } : o) });
```

Sempre via `save` (o `saveAllData` de `api.js` faz o diff e chama
`api.obras.save`). **Nunca chamar `api.*` direto do componente.**

O orçamento é um **snapshot**, não é recalculado no render. Só muda quando o
usuário clica em Recalcular ou salva o formulário. Se `projeto` mudou depois do
último `orcamento.geradoEm`, mostrar um selo *"desatualizado"* ao lado do total.

### 7.3 Permissões e mobile

`const perm = getPermissoes()` — `perm.podeEditar` libera preencher/recalcular;
`visualizador` vê o resultado sem nenhum botão de escrita.

No mobile (`isMobile` já chega por prop): formulário em uma coluna, um bloco por
vez; na tabela de resultado, esconder a coluna de preço unitário e mostrar só
item · qtd · total.

---

## 8. Backend — nada muda

`obras` já é `(id, empresa_id, dados JSONB)` com `GET/POST/DELETE /api/obras`
filtrando por `empresa_id` do JWT, e `api.obras` já existe em `api.js`.
`projeto` e `orcamento` entram dentro de `dados` — é o padrão JSONB do projeto.

Dívida registrada, **não fazer agora**: um orçamento com ~300 itens engorda o
`dados` da obra. Se passar de ~500 KB por obra, mover `orcamento.itens` para
tabela própria. Hoje não é problema.

---

## 9. Testes

`orcamento-obra.test.mjs`, rodável com `node`, sem framework.

**Caso de referência** — os inputs reais que estão na aba `INPUT` da planilha:

```
tipologia = "Sobrado"
areaConstruida = 330,86 m²
m2Paredes = 835   (internas 282 · externas 553)
gabarito = 75
Térreo:  área 206,22 · perímetro paredes 122,01 · m² parede 20cm 452,05 · vãos 49
Laje térreo: área 120 · perímetro 156 · tipo Treliça · FCK25
Pav 1:  área 104,96 · m² parede 20cm 382,95 · vãos 23 · perímetro 208,6
Laje pav1: área 220 · perímetro 224 · tipo Treliça · FCK25
Cobertura: 7 telhados, todos "Telha Metálica Termoacústica", 1 água, incl 0,1
           (3,7×1,3) (5,05×1,4) (5,3×2,9) (12,1×3,7) (10,55×5,05) (4,95×1,4) (5,65×3,15)
Revestimento interno 186 · Pavimentação externa 215 (perímetro 265)
Muro divisa: 78 m × 2 m
Fundação: 67 estacas · Ø25 · prof. 8 · FCK25
```

Asserções mínimas:

- Total de linhas emitidas ≈ **118** (é o que a `RESUMO` da planilha produz com
  esses inputs — confira o número exato abrindo a planilha antes de fixar).
- Nenhuma linha com `qtd = 0` (exceto as de pintura, pelo bug do §4.4).
- **Prestadores** (esses são valores fechados, têm que bater ao centavo):

  | Item | Total |
  |---|---|
  | Pedreiros Casa | R$ 330.860,00 |
  | Pintor | R$ 33.086,00 |
  | Eletricista | R$ 26.468,80 |
  | Encanador | R$ 19.851,60 |
  | Gestão de obra | R$ 162.121,40 (490 × 330,86) |
  | Pavimentação externa | R$ 25.800,00 |
  | Muro de divisa | R$ 20.280,00 |
  | Terraplanagem | R$ 8.000,00 |

- `taxaGestaoObra`: 200→550 · 250→530 · 300→510 · 350→490 · 400→470 · 450→450 ·
  500→430.
- Cobertura com "Telha Metálica Termoacústica" **não** emite ripas, berço nem
  mão-francesa (`ESP_Ripas = ESP_BERCOS = ESP_MAO_FRANCESA = 0` para metálica),
  e **emite** apoios (`ESP_Apoio = 1`).
- Tipologia "Térrea" não emite nenhuma linha de `paredesPav1` nem
  `vigaRespaldoLajePav1`.
- Todo bloco opcional zerado (arrimo, piscina) não emite nada.
- Barras de ferro: `barras(804 m de CA50 8mm) = ceil(804/12 × 1,1) = 74`, e o
  peso = 74 × 4,8 = 355,2 kg.

Verificação final: gerar um HTML standalone com a tabela de resultado e abrir no
navegador, comparando lado a lado com a aba `RESUMO` da planilha.

---

## 10. Ordem de implementação

1. **Esqueleto e taxonomia.** `orcamento-obra.jsx` com `PERDA`,
   `PESOS_FERRO`, `ORD`, `TAXAS_PRESTADORES`, `taxaGestaoObra`, `emitir`,
   `precoDoInsumo`. Registrar em `combine.js`. `node combine.js` + `npm run build`.
2. **Três módulos-piloto**, para fixar o padrão de transcrição:
   `F_PAREDES_TERREO`, `M_PINTURA`, `P_PRESTADORES`. Teste de prestadores
   passando (é o único com número fechado).
3. **Resto do caminho da casa**: instalações, fundação, contrapiso, viga/laje
   térreo, paredes e viga/laje pav1, supra cobertura, chapisco, contrapisos
   externos.
4. **`K_COBERTURA`** por último dentro do núcleo — é o mais complexo, com laço
   de 16 telhados, comutação por tipo de telha e cálculo de cumeeira/calha por
   número de águas. Faça-o sozinho, com teste próprio.
5. **Blocos opcionais**: muro de divisa, arrimo, piscina.
6. **UI**: card Orçamento → estado vazio → formulário por blocos → tela de
   resultado.
7. `npm run cb` para conferir o build; deploy com `npm run cpush`.

Faça commit ao fim de cada passo. Não empilhe a transcrição inteira num commit só.

---

## 11. O que NÃO fazer

- Não editar `AppCombined.jsx`.
- **Não ajustar, arredondar ou "melhorar" nenhum coeficiente do VBA.**
- Não remover o fator `1.1` de perda.
- `S_ESQUADRIAS` no VBA está inacabado (declara pesos, abre o laço e para).
  **Esquadrias foi implementado a partir da aba ESQUADRIAS**, que descreve o
  modelo completo: lista de perfis por tipo (código, kg/m, regra de metragem)
  e vidro 8mm por área útil. Catálogo em
  `docs/referencia-orcamento/esquadrias-catalogo.json`. A aba cobre janela e
  porta de correr (2/3/4 folhas) e persiana integrada, linha GOLD. **Porta de
  giro (1/2 folhas), maxim-ar (1/2 folhas) e quadro fixo** foram derivados dos
  desenhos de montagem do catálogo Alcoa nova Gold (p.223-232): perfil por
  função (marco GN020, folha GN052/GN019, adaptadores GN018/GN074, baguetes
  GN009/GN013...), kg/m das páginas de perfis (p.39-69), vidro pelas cotas de
  corte de cada tipo, e uma lista de acessórios por família
  (`ESQUADRIAS_ACESSORIOS`: roldanas, fechos, dobradiças, braços, borrachas,
  conexões, chumbadores, parafusos — contados por esquadria, por folha ou por
  metro de perímetro). A linha SUPREMA usa os pesos do catálogo Go Perfil 2025
  com a função dos perfis mapeada por analogia com a Gold (só correr 2 folhas
  tem lista) — o motor emite um aviso `esquadria_linha_aproximada`.
- Não implementar `D_ESGOTO_PLUVIAL_TERREO`: 15 linhas, corpo vazio, chamada
  comentada no original.
- Não reproduzir a aba `GERAL`: está morta, só a célula da tipologia é lida.
- Não criar tabela nem coluna no Postgres — tudo vai no `dados` JSONB de `obras`.
- Não chamar `api.*` direto; usar `save(...)`.
- Não colocar preço em lugar nenhum além de `precoDoInsumo()` — exceto os
  prestadores, que já vêm precificados do VBA.
- Não reimplementar permissão — usar `getPermissoes()`.
- Não recalcular o orçamento a cada render; ele é snapshot.
