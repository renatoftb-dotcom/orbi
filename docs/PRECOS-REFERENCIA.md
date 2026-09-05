# SPEC — Preço de referência auto-atualizável

Complemento da `SPEC-ORCAMENTO-OBRA.md`. Substitui o `PRECO_PADRAO = 1` daquela
spec por um preço de referência real que **se atualiza sozinho a cada nota
lançada numa obra**.

Semente: `docs/referencia-orcamento/precos-referencia.json` (94 insumos) e
`LISTA-PRECOS-ORCAMENTO.xlsx` / `PRECOS-REFERENCIA-VICKE.xlsx` para revisão
humana.

---

## 1. Modelo de dados

A tabela `materiais` já existe no VICKE (`data.materiais`, JSONB, CRUD em
`/api/materiais`). O shape atual é `{ id, nome, unidade, categoria, ultimoPreco,
fornecedorId }`. **Estender, não substituir:**

```js
material = {
  id, nome, unidade, categoria, fornecedorId,   // já existe
  ultimoPreco,                                  // já existe — mantido por compat

  precoReferencia: 38.00,        // NOVO — o preço que o orçamento usa
  precoFonte: "compra",          // "compra" | "seed" | "manual"
  precoData: "2026-08-23",       // data da compra que originou o preço
  precoNCompras: 253,            // quantas compras compõem o histórico
  precoFatorInccAplicado: 1.0,   // 1.0 quando não houve correção
  precoManual: null,             // override do usuário; quando ≠ null, vence tudo
  precoAtualizadoEm: "2026-09-05T20:00:00Z",
}
```

`precoManual` é o único campo que o usuário edita. Enquanto ele estiver
preenchido, nenhuma atualização automática o sobrescreve — só o próprio usuário,
limpando o campo.

---

## 2. A regra de atualização

Roda **sempre que um lançamento é salvo** (o `formLancamento` da
`SPEC-PL-OBRA.md`, ou o importador de NF de `outros.jsx`).

```js
/**
 * Atualiza o preço de referência do material a partir de um lançamento novo.
 * Pura: recebe o material e o lançamento, devolve o material atualizado.
 */
function atualizarPrecoReferencia(material, lancamento) {
  // 1. Override manual vence sempre.
  if (material.precoManual != null) return material;

  // 2. Só lançamento de custo, com quantidade e valor válidos.
  if (lancamento.tipo !== "custo") return material;
  const qtd = Number(lancamento.quantidade);
  const total = Number(lancamento.total);
  if (!(qtd > 0) || !(total > 0)) return material;

  const unitario = total / qtd;

  // 3. Guarda contra erro de digitação: variação absurda não entra sozinha.
  //    Fora da faixa, grava como "pendente de confirmação" e avisa na UI.
  const ref = material.precoReferencia;
  if (ref > 0) {
    const razao = unitario / ref;
    if (razao > 3 || razao < 0.33) {
      return { ...material, precoPendente: { valor: unitario, data: lancamento.dataPagamento } };
    }
  }

  // 4. Só avança no tempo. Nota retroativa não rebaixa um preço mais novo.
  if (material.precoData && lancamento.dataPagamento < material.precoData) return material;

  return {
    ...material,
    precoReferencia: Math.round(unitario * 100) / 100,
    ultimoPreco: Math.round(unitario * 100) / 100,   // mantém o campo legado em dia
    precoFonte: "compra",
    precoData: lancamento.dataPagamento,
    precoNCompras: (material.precoNCompras || 0) + 1,
    precoFatorInccAplicado: 1.0,
    precoPendente: null,
    precoAtualizadoEm: new Date().toISOString(),
  };
}
```

**Por que último preço e não média.** Insumo de construção tem tendência, não
ruído: cimento não oscila em torno de um valor, ele sobe. Uma média de 253
compras desde 2022 subestimaria o preço de hoje. O último preço erra menos,
desde que exista a guarda do passo 3 contra digitação errada.

---

## 3. Envelhecimento — o preço se corrige sozinho enquanto não há compra

O que o orçamento consome não é `precoReferencia` cru, mas ele corrigido pelo
tempo decorrido:

```js
const INCC_ANUAL = { 2022:0.0941, 2023:0.0334, 2024:0.0633, 2025:0.0609, 2026:0.0559 };

function precoDoInsumo(nomeItem, data) {
  const m = acharMaterial(nomeItem, data.materiais);
  if (!m) return { preco: null, confianca: "sem_preco" };
  if (m.precoManual != null) return { preco: m.precoManual, confianca: "manual" };

  const meses = mesesEntre(m.precoData, hoje());
  const preco = meses >= 12
    ? m.precoReferencia * fatorIncc(m.precoData, hoje())
    : m.precoReferencia;

  const confianca =
    meses < 6  && m.precoNCompras >= 3 ? "alta"
  : meses < 12                         ? "media"
  : meses < 24                         ? "baixa"
  :                                      "obsoleta";

  return { preco: arredondar(preco), confianca, meses, corrigido: meses >= 12 };
}
```

`INCC_ANUAL` fica numa constante versionada, com um comentário dizendo até que
mês de 2026 o número vale. Atualizar uma vez por ano é aceitável; automatizar a
coleta não vale o esforço agora.

**Nenhum outro ponto do código resolve preço.** Prestadores são a única exceção
(§5).

---

## 4. Como isso aparece na tela

No topo do orçamento, uma linha de qualidade em vez de um aviso genérico:

> **94 de 94 insumos precificados** · 29 com preço atual · 55 corrigidos pelo
> INCC · 10 de referência externa

Cada linha da tabela leva um ponto colorido na coluna de preço
(verde/âmbar/laranja/vermelho) com tooltip: *"R$ 38,00 · compra de 23/08/2026 ·
253 compras"* ou *"R$ 20,04 · compra de 04/12/2023 corrigida pelo INCC (×1,194)"*.

Um bloco recolhível **"Preços que merecem atenção"** lista o que está obsoleto ou
pendente de confirmação, com link para editar o material. É a fila de cotação.

---

## 5. Prestadores

Não passam por `materiais`. Ficam em `escritorio.taxasPrestadores`, semeados da
aba Prestadores da planilha, editáveis na tela de configuração do escritório:

```js
escritorio.taxasPrestadores = {
  pedreirosCasa:        { base: "areaConstruida", valor: 1000 },
  pintor:               { base: "areaConstruida", valor: 115 },
  eletricista:          { base: "areaConstruida", valor: 38 },
  encanador:            { base: "areaConstruida", valor: 60 },
  carpinteiro:          { base: "areaConstruida", valor: 25 },
  impermeabilizador:    { base: "areaConstruida", valor: 25 },
  marceneiroPortas:     { base: "areaConstruida", valor: 150 },
  pavimentacaoExterna:  { base: "areaPavimentacao", valor: 59 },
  muroDivisa:           { base: "m2MuroDivisa", valor: 59 },
  muroArrimo:           { base: "m2MuroArrimo", valor: 250 },
  pedreirosPiscina:     { base: "areaPiscina", valor: 880 },
  instaladorAr:         { base: "fixo", valor: 1000 },
  instaladorAquecedores:{ base: "fixo", valor: 2000 },
  equipPiscina:         { base: "fixo", valor: 5000 },
  terraplanagem:        { base: "fixo", valor: 8000 },
  serralheiro:          { base: "areaConstruida", valor: null },  // a definir
  gestaoObra:           { base: "regressivo",     tabela: "taxaGestaoObra" },
};
```

Esses valores substituem os do `PRESTADORES.frm` onde há cotação mais recente —
a divergência era grande (eletricista R$ 80 → 38, muro R$ 130 → 59). A taxa
regressiva de gestão de obra continua vindo de `taxaGestaoObra()`.

---

## 6. Semeadura

Rotina única, rodada uma vez por empresa (botão em `escritorio.jsx`, atrás de
`perm.podeAlterarConfig`):

1. Lê `precos-referencia.json`.
2. Para cada entrada, procura o material por nome normalizado (sem acento,
   minúsculo, espaços colapsados). Se existir, preenche os campos de preço só
   quando `precoReferencia` estiver vazio. Se não existir, cria o material.
3. `precoFonte = "seed"`, `precoData` = a data da compra que originou o valor.
4. Idempotente: rodar de novo não sobrescreve nada que já tenha preço.

---

## 7. Backend

Nada muda. `materiais` já é `(id, empresa_id, dados JSONB)` com `GET/POST/DELETE
/api/materiais`, e os campos novos entram em `dados`.

Falta `PUT /api/materiais/:id` para editar. Confirme antes se o `POST` já é
upsert por `(id, empresa_id)` — se for, reenviar o objeto com o mesmo `id`
resolve. Se não for, adicione o `PUT` espelhando `PUT /api/fornecedores/:id`.

---

## 8. Testes

- Lançamento de 100 sacos de cimento por R$ 4.000 → `precoReferencia = 40,00`,
  `precoFonte = "compra"`, `precoNCompras` incrementado.
- Lançamento com preço unitário 5× acima do atual → vai para `precoPendente`,
  `precoReferencia` intacto.
- Lançamento com data anterior a `precoData` → ignorado.
- Material com `precoManual` preenchido → nenhuma atualização o altera.
- `precoDoInsumo` de um preço de dez/2023 → corrigido por ×1,194 e marcado
  `confianca: "baixa"`.
- `precoDoInsumo` de um preço de ago/2026 com 253 compras → sem correção,
  `confianca: "alta"`.
- Semeadura rodada duas vezes → segunda execução não altera nada.

---

## 9. O que NÃO fazer

- Não usar média histórica no lugar do último preço (ver §2).
- Não deixar preço hardcoded fora de `precoDoInsumo()` e das taxas de prestador.
- Não sobrescrever `precoManual` em hipótese alguma.
- Não deixar um lançamento com quantidade zero ou valor zero contaminar o preço.
- Não criar tabela nova — os campos vão no `dados` JSONB de `materiais`.
- Não buscar INCC em API externa; constante versionada basta.
