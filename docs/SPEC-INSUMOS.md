# SPEC — Módulo de Insumos

O cadastro central de insumos do VICKE. É a peça que liga as três partes que já
existem ou estão em construção:

```
        ┌──────────────────────────┐
        │   MÓDULO DE INSUMOS      │   código · nome · unidade · grupo
        │   (catálogo + preço)     │   preço de referência · aliases
        └───────┬──────────┬───────┘
     lê preço   │          │   atualiza preço
                ▼          ▲
   ESTIMATIVA (orçamento)  │   COMPRAS (lançamentos)
   quantitativo × preço ───┘   nota fiscal → preço unitário real
                │                        │
                └──── ESTIMADO × REALIZADO na obra do cliente
```

Complementa `SPEC-ORCAMENTO-OBRA.md` (estimado) e `SPEC-PL-OBRA.md` (realizado),
e absorve a `PRECOS-REFERENCIA.md`, que passa a ser a §5 daqui.

Semente pronta: `docs/referencia-orcamento/insumos-seed.json` — **111 insumos
com código, preço e unidade**: 94 materiais e 17 prestadores.

---

## 0. Regras do repositório

- Nunca editar `src/AppCombined.jsx` — gerado por `node combine.js`.
- Reler os arquivos do disco antes de editar; codebase editado em paralelo.
- Vite + React, sem TypeScript, sem CSS framework, estilos inline.
- Backend: só um endpoint novo (§8).

---

## 1. O problema da chave

Hoje o vínculo entre um material e uma compra é **por string de nome**, e o
matcher que existe em `outros.jsx` (importador de NF, ~linha 1353) é:

```js
data.materiais.find(m => m.nome.toLowerCase().includes(item.descricao?.toLowerCase().slice(0,10)))
```

Isso casa "Areia Fina" com "Areia Fina Ensacada", casa qualquer coisa que comece
com os mesmos 10 caracteres, e não casa nada se o fornecedor escrever
"AREIA FINA" com espaço a mais. **Trocar esse matcher é o primeiro passo desta
entrega.**

### A chave: `codigo`

Cada insumo ganha um código estável, legível e imutável:

```
<PREFIXO DO GRUPO>-<SEQUENCIAL 3 DÍGITOS>

CIM-001   Sacos de cimento 50kg
AGR-001   Areia Fina
ACO-008   Aço - Barras de CA50 8.0mm 12mts
TLH-014   Telha Metálica Termoacústica
PRE-002   Pintor
```

Prefixos em uso na semente: `ACO` `AGR` `ARG` `CAL` `CIM` `CON` `CXA` `ELE`
`FER` `FIX` `HID` `IMP` `LAJ` `LOC` `MAD` `PRE` `REV` `TIJ` `TIN` `TLH`.

**Regra de ouro: o código nunca muda depois de gravado.** O nome muda à vontade
— ele é rótulo. Se um insumo for descontinuado, `ativo: false`; nunca reciclar o
código.

### `aliases` — a ponte com o mundo real

Todo nome que já apontou para aquele insumo fica no array `aliases`: o nome que
o motor de quantitativos emite, o nome que aparece na nota do fornecedor, a
grafia antiga. É por eles que a resolução por nome funciona (§4).

---

## 2. Modelo de dados

Reaproveita a tabela `materiais`, que já existe (`data.materiais`, JSONB, CRUD em
`/api/materiais`). **Estender, não substituir** — o `id` atual continua sendo a
chave primária de banco; `codigo` é a chave de negócio.

```js
insumo = {
  id,                          // já existe: uid() — chave de banco, opaca
  codigo: "CIM-001",           // NOVO — chave de negócio, única por empresa, imutável
  nome: "Sacos de cimento 50kg",
  grupo: "Cimento",
  unidade: "Unidades",
  tipo: "material",            // "material" | "prestador"
  baseCalculo: null,           // só prestador: areaConstruida | m2MuroDivisa | fixo | regressivo | ...
  ativo: true,

  aliases: [                   // NOVO — todo nome que aponta para este insumo
    "Sacos de cimento 50kg",
    "CIMENTO CP II 50KG",
  ],

  // ── preço (absorve a PRECOS-REFERENCIA.md) ───────────────
  precoReferencia: 38.00,
  precoFonte: "compra",        // compra | compra_corrigida | cotacao | mercado | manual
  precoData: "2026-08-23",
  precoNCompras: 253,
  precoFatorInccAplicado: 1.0,
  precoManual: null,           // quando ≠ null, vence tudo e nada o sobrescreve
  precoPendente: null,         // { valor, data } — compra fora da faixa, aguardando confirmação
  precoAtualizadoEm: "2026-09-05T20:00:00Z",

  fornecedorPreferido: null,   // id de data.fornecedores, opcional
  observacao: null,
}
```

Campos legados a manter por compatibilidade: `ultimoPreco`, `categoria`,
`fornecedorId`. Mantenha `ultimoPreco` sincronizado com `precoReferencia` em toda
atualização, porque o importador de NF ainda o lê.

### Migração dos materiais existentes

Rotina idempotente, rodada uma vez por empresa:

1. Todo material sem `codigo` recebe um: prefixo pelo grupo inferido do nome,
   sequencial a partir do maior existente naquele prefixo.
2. `aliases` recebe o `nome` atual.
3. `precoReferencia` recebe `ultimoPreco` quando houver, `precoFonte = "compra"`.
4. Rodar de novo não altera nada que já tenha `codigo`.

---

## 3. Semeadura do catálogo

`docs/referencia-orcamento/insumos-seed.json`, 111 entradas, já com código,
preço, unidade, grupo e aliases. Botão em `escritorio.jsx` atrás de
`perm.podeAlterarConfig`, ou execução automática no primeiro acesso ao módulo:

1. Para cada entrada, procurar insumo existente por `codigo`; se não achar, por
   qualquer `alias` normalizado (§4).
2. **Existe** → preencher apenas os campos vazios. Nunca sobrescrever
   `precoManual`, nem um `precoReferencia` cuja `precoData` seja mais recente que
   a da semente.
3. **Não existe** → criar.
4. Idempotente. Rodar duas vezes não produz duplicata nem altera preço.

---

## 4. Resolução de nome → insumo

Uma função, usada por todos os pontos de entrada. Determinística e em cascata:

```js
/**
 * @returns {{ insumo, confianca: "codigo"|"alias"|"normalizado"|"sugestao"|"nenhum", candidatos? }}
 */
function resolverInsumo(termo, insumos, { codigo } = {}) {
  // 1. Código explícito — o caminho do motor de orçamento. Sempre exato.
  if (codigo) {
    const i = insumos.find(x => x.codigo === codigo);
    if (i) return { insumo: i, confianca: "codigo" };
  }
  const n = normalizar(termo);

  // 2. Alias exato (normalizado).
  for (const i of insumos) {
    if (i.aliases?.some(a => normalizar(a) === n)) return { insumo: i, confianca: "alias" };
  }
  // 3. Nome exato (normalizado).
  const porNome = insumos.find(i => normalizar(i.nome) === n);
  if (porNome) return { insumo: porNome, confianca: "normalizado" };

  // 4. Sugestão — NUNCA vincula sozinho. Devolve candidatos para o humano decidir.
  const cands = ranquearPorSimilaridade(n, insumos).slice(0, 5);
  return { insumo: null, confianca: cands.length ? "sugestao" : "nenhum", candidatos: cands };
}

// sem acento, minúsculo, espaços colapsados, sem pontuação de borda
function normalizar(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
```

`ranquearPorSimilaridade` usa distância de Levenshtein normalizada sobre os
tokens, ou algo equivalente e simples. **Não instale biblioteca para isso.**

**Regra dura: nenhuma vinculação automática abaixo de `"normalizado"`.** Uma
sugestão vira vínculo só quando uma pessoa clica. E quando ela clica, o termo
original entra em `aliases` daquele insumo — o sistema aprende, e o mesmo
fornecedor com a mesma grafia nunca mais pergunta.

Isto substitui o `includes(slice(0,10))` de `outros.jsx`.

---

## 5. Preço — como se atualiza

Absorve a `PRECOS-REFERENCIA.md`. Resumo operacional; os detalhes e os testes
estão lá.

**Ao salvar um lançamento de custo** com quantidade e valor válidos:

```js
unitario = total / quantidade
```

- `precoManual` preenchido → não faz nada.
- `unitario` mais de 3× acima ou abaixo do `precoReferencia` → grava em
  `precoPendente` e sinaliza na UI. Não altera o preço.
- Data anterior a `precoData` → ignora (nota retroativa não rebaixa preço novo).
- Caso contrário → `precoReferencia = unitario`, `precoFonte = "compra"`,
  `precoData` = data do lançamento, `precoNCompras++`.

**Ao ler o preço** (`precoDoInsumo`), aplicar envelhecimento: com 12 meses ou
mais, corrigir pelo INCC até hoje. Confiança devolvida junto: `alta` (< 6 meses e
≥ 3 compras), `media` (< 12), `baixa` (< 24), `obsoleta`.

Último preço e não média: insumo de construção tem tendência, não ruído. A guarda
dos 3× cobre o erro de digitação.

---

## 6. Vínculo com a estimativa

O motor de `orcamento-obra.jsx` **passa a emitir código, não nome**:

```js
emitir(out, {
  ordem: ORD.paredesTerreo,
  insumoCodigo: "TIJ-001",          // ← a chave
  etapa: "supra_paredes_1",
  subEtapa: "Paredes Pav. Térreo",
  qtd: calcTijolos6f,
});
```

Nome e unidade vêm do catálogo na hora de renderizar, não ficam no motor. Assim,
renomear um insumo no cadastro muda o orçamento inteiro sem tocar em código.

Constante de mapeamento no topo do módulo do motor, uma linha por insumo:

```js
const INSUMO = {
  TIJOLO_6F: "TIJ-001",
  TIJOLO_8F: "TIJ-002",
  AREIA_FINA: "AGR-001",
  CIMENTO_50: "CIM-001",
  // ...
};
```

Se o motor emitir um código que não existe no catálogo, a linha aparece no
orçamento com preço zero e um aviso — nunca some silenciosamente.

---

## 7. A tela do módulo

Novo módulo `src/modules/insumos.jsx`, registrado em `combine.js` **depois de
`outros.jsx` e antes de `orcamento-obra.jsx`** (o motor consome o catálogo).

Entrada pelo menu principal, ao lado de Fornecedores.

### 7.1 Lista

Tabela com busca e filtros por grupo, tipo e confiança do preço. Colunas: código
· nome · grupo · unidade · preço de referência · idade do preço · nº de compras.
Ponto colorido de confiança na coluna de preço, com tooltip
*"R$ 38,00 · compra de 23/08/2026 · 253 compras"*.

Ordenação padrão: pior confiança primeiro. A tela abre mostrando o que precisa de
atenção, não o que já está resolvido.

Faixa de resumo no topo: **111 insumos · 29 preço atual · 55 corrigidos · 7 de
mercado · 3 pendentes de confirmação**.

### 7.2 Cadastro e edição

Formulário: nome, grupo (select), unidade (select), tipo, preço manual,
fornecedor preferido, observação, ativo. O **código é gerado automaticamente** a
partir do grupo e exibido como somente-leitura, com a explicação de que não muda.

Bloco de **aliases**: lista editável, com botão de adicionar e remover. É aqui
que o usuário resolve "o fornecedor escreve diferente".

### 7.3 Detalhe do insumo

- Preço atual, fonte, data, número de compras, fator INCC aplicado.
- **Histórico de preços**: as compras daquele insumo, do `data.lancamentos`
  filtrado por `insumoCodigo`, em tabela e num gráfico de linha simples (SVG
  inline, sem biblioteca) — data × preço unitário.
- `precoPendente`, quando existir: faixa âmbar com *"Compra de 12/09 registrou
  R$ 140,00, muito acima dos R$ 38,00 atuais"* e dois botões: **Aceitar como novo
  preço** / **Descartar**.
- Onde este insumo é usado: quantas obras têm estimativa com ele, quantos
  lançamentos o referenciam.

### 7.4 Mesclar duplicados

Inevitável: o mesmo insumo cadastrado duas vezes. Tela de mesclagem — escolhe o
insumo que fica, o que sai tem seus `aliases` transferidos, seus lançamentos
reapontados para o código sobrevivente, e é marcado `ativo: false`. **Nunca
apagar** — o histórico precisa continuar resolvendo.

### 7.5 Pendências de vínculo

Fila dos lançamentos com `insumoCodigo` vazio (importados de NF e não resolvidos).
Cada linha mostra a descrição original, os candidatos rankeados e um botão de
vincular. Vincular grava o `insumoCodigo` no lançamento **e** o termo original nos
`aliases` do insumo.

### 7.6 Permissões

`getPermissoes()`: `podeEditar` cadastra e edita; `podeExcluir` inativa e mescla;
`visualizador` só lê. Nenhuma checagem nova de papel.

---

## 8. Estimado × Realizado na obra do cliente

O ponto de chegada de tudo. Na obra, uma view `comparativo` que junta as duas
pontas **pelo `insumoCodigo`**:

```js
function compararEstimadoRealizado(obra, lancamentos, insumos) {
  // estimado: obra.orcamento.itens, agrupado por insumoCodigo
  // realizado: lancamentos da obra, agrupado por insumoCodigo
  // devolve, por insumo e por etapa: qtdEst, vlrEst, qtdReal, vlrReal, desvio
}
```

Duas visões, alternáveis:

- **Por etapa** — o resumo que o cliente entende. Estimado, realizado, desvio em
  R$ e em %, com barra de progresso.
- **Por insumo** — o detalhe que você usa. Mesmas colunas, mais quantidade
  estimada × comprada, para separar erro de preço de erro de quantidade.

Três casos que a tela precisa mostrar, e não esconder:

| Situação | Como aparece |
|---|---|
| Estimado e comprado | linha normal, com desvio |
| Estimado e não comprado | linha cinza, "ainda não comprado" |
| Comprado e não estimado | linha destacada, **"fora do orçamento"** |

A terceira é a mais valiosa e a que sistema nenhum costuma mostrar.

---

## 9. Backend

Quase nada muda. `materiais` já é `(id, empresa_id, dados JSONB)` e os campos
novos entram em `dados`.

**Uma coisa falta:** `PUT /api/materiais/:id`. Confirme primeiro se o `POST`
atual já é upsert por `(id, empresa_id)` — pela leitura do `server.js` ele é
(`ON CONFLICT ... DO UPDATE`), então reenviar o objeto com o mesmo `id` atualiza e
nada precisa ser feito. Se na prática não funcionar, adicione o `PUT` espelhando
`PUT /api/fornecedores/:id` (linha ~3893).

Dívida registrada, não fazer agora: `codigo` único por empresa é garantido só na
aplicação. Se virar problema, um índice único parcial em `(empresa_id, (dados->>'codigo'))`.

---

## 10. Testes

`insumos.test.mjs`, node puro.

- `resolverInsumo` com código → sempre exato, mesmo com nome divergente.
- `resolverInsumo("AREIA  FINA")` → casa `AGR-001` por normalização.
- `resolverInsumo("Areia Fina Ensacada")` → **não** casa `AGR-001`; devolve
  `sugestao` com candidatos. (É o caso que o matcher antigo errava.)
- `resolverInsumo("xyz")` → `nenhum`.
- Semeadura rodada duas vezes → 111 insumos, nenhum duplicado, nenhum preço
  alterado.
- Migração de material legado sem código → ganha código, `aliases` com o nome,
  `precoReferencia` = `ultimoPreco`.
- Mesclagem: aliases transferidos, lançamentos reapontados, sobrevivente ativo,
  absorvido inativo.
- Comparativo: insumo comprado sem estar no orçamento aparece como
  "fora do orçamento" e entra no total do realizado.
- Código nunca reciclado: inativar `TIJ-003` e criar um novo tijolo gera
  `TIJ-004`.

---

## 11. Ordem de implementação

1. `insumos.jsx` com o shape, `normalizar`, `resolverInsumo` e a migração. Testes
   passando. Sem UI.
2. Semeadura a partir de `insumos-seed.json`. Conferir 111 insumos no banco.
3. Trocar o matcher do importador de NF em `outros.jsx` por `resolverInsumo`.
   Lançamento sem match fica com `insumoCodigo: null` e vai para a fila de
   pendências.
4. `atualizarPrecoReferencia` no salvamento de lançamento (§5).
5. Tela: lista → cadastro → detalhe com histórico.
6. Fila de pendências de vínculo.
7. Motor de orçamento passa a emitir `insumoCodigo` e a ler preço do catálogo.
8. Comparativo Estimado × Realizado na obra.
9. Mesclagem de duplicados.
10. `npm run cb`, depois `npm run cpush`.

Commit ao fim de cada passo.

---

## 12. O que NÃO fazer

- **Nunca mudar o `codigo` de um insumo já gravado, nem reciclar código de
  insumo inativado.**
- Não vincular automaticamente por similaridade — só por código, alias ou nome
  normalizado exato. Similaridade sugere, humano decide.
- Não apagar insumo que tenha lançamento ou estimativa; inativar.
- Não deixar o motor de orçamento carregar nome de insumo — só código.
- Não colocar preço fora de `precoDoInsumo()` e das taxas de prestador.
- Não sobrescrever `precoManual`.
- Não instalar biblioteca de fuzzy matching, de tabela ou de gráfico.
- Não criar tabela nova no Postgres — os campos vão no `dados` JSONB.
- Não chamar `api.*` direto dos componentes; usar `save(...)`.
