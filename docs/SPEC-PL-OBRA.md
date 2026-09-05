# SPEC — P&L de Obra (módulo Clientes)

Documento de implementação para o VICKE. Modelo derivado de uma planilha de
gestão de obra em produção (`Métricas.xlsm`, obra Residencial Villa Toscana,
mai/25–mar/26, 151 notas, R$ 303.911,73 de custo). A planilha é a fonte da
lógica; os números dela no fim deste documento são o teste de aceite.

---

## 0. Regras do repositório (leia antes de escrever qualquer linha)

- **Nunca editar `src/AppCombined.jsx`.** Ele é gerado por `node combine.js` a
  partir de `src/modules/*.jsx`. Editar módulo, depois rodar o combine.
- **Sempre reler o arquivo do disco antes de editar.** Este codebase é editado
  em paralelo em várias sessões; já houve perda de alterações por patch em
  versão velha.
- Frontend: `Vite + React`, sem TypeScript, sem CSS framework — estilos são
  objetos inline. Seguir o padrão do arquivo vizinho, não introduzir Tailwind,
  styled-components nem CSS Modules.
- Backend: `server.js` (~4,5k linhas, arquivo único). Editar cirurgicamente,
  ancorado nos comentários de seção `// ═════ NOME ═════`. **Nesta entrega o
  backend não muda** (ver §7).
- Nada de `localStorage` para estado de negócio — só os já existentes
  `vicke-token` / `vicke-user`.

---

## 1. Onde isso entra

Arquivo alvo do gancho: `src/modules/clientes.jsx`, componente
`GestaoObraPanel` (linha ~991). Ele já é uma máquina de estados por `view`:

```
lista → detalheObra → { contratosDaObra → formContrato }
```

Na view `detalheObra` existe um grid de 3 cards: **Contratos** (ativo),
**Cronograma** (em breve), **Documentos** (em breve).

**Adicionar um 4º card, "Financeiro"**, que leva à nova view `financeiro`.
Mudar o grid para `repeat(2, 1fr)` no desktop (4 cards em 2×2 ficam melhor que
4 espremidos numa linha); no mobile continua `1fr`.

### Novo módulo

`clientes.jsx` já tem 77 KB. **Não inchar mais.** Criar
`src/modules/obra-financeiro.jsx` e registrar em `combine.js`:

```js
const ORDER = [
  "shared.jsx",
  "api.js",
  "outros.jsx",
  "obra-financeiro.jsx",   // ← NOVO: antes de clientes.jsx, que o consome
  "clientes.jsx",
  ...
];
```

O módulo exporta (no sentido do bundle concatenado: declara no escopo global)
três coisas:

| Símbolo | Tipo | Papel |
|---|---|---|
| `PLANO_CONTAS`, `ETAPAS_OBRA`, `GRUPOS_MATERIAL` | constantes | taxonomia |
| `calcularPLObra(...)` | função pura | todo o cálculo |
| `<FinanceiroObraPanel />`, `<FormLancamentoObra />` | componentes | UI |

Usar `function Nome() {}` (declaration, não `const Nome = () =>`) para que o
hoisting no bundle concatenado não dependa da ordem.

---

## 2. Taxonomia — plano de contas

Constante `PLANO_CONTAS` em `obra-financeiro.jsx`. Cada conta tem `id`
(estável, usado no lançamento — **nunca renomear id, só o label**), `nome` e
`grupo`.

```js
const GRUPOS_PL = [
  { id: "receitas",  titulo: "ENTRADAS TOTAIS",           sinal: +1, entra_no_resultado: true  },
  { id: "materiais", titulo: "MATERIAL & INSUMOS",        sinal: -1, entra_no_resultado: true  },
  { id: "maoDeObra", titulo: "MÃO DE OBRA & PRESTADORES", sinal: -1, entra_no_resultado: true  },
  { id: "servicos",  titulo: "SERVIÇOS & TAXAS",          sinal: -1, entra_no_resultado: true  },
  { id: "excluidas", titulo: "EXCLUÍDAS",                 sinal:  0, entra_no_resultado: false },
];

const PLANO_CONTAS = [
  // ── receitas ──────────────────────────────────────────────
  { id: "deposito_proprio",   nome: "Depósito Recurso Próprio",  grupo: "receitas" },
  { id: "liberacao_financ",   nome: "Liberação de financiamento", grupo: "receitas" },
  { id: "cartao_credito",     nome: "Cartão de crédito",          grupo: "receitas" },

  // ── material & insumos ────────────────────────────────────
  { id: "material",           nome: "Material",                          grupo: "materiais" },
  { id: "frete",              nome: "Frete",                             grupo: "materiais" },
  { id: "aluguel_equip",      nome: "Aluguel de ferramentas e equipamentos", grupo: "materiais" },
  { id: "combustivel",        nome: "Combustível",                       grupo: "materiais" },
  { id: "compra_ferramentas", nome: "Compra de ferramentas",             grupo: "materiais" },
  { id: "agua",               nome: "Conta de água",                     grupo: "materiais" },
  { id: "energia",            nome: "Energia elétrica",                  grupo: "materiais" },
  { id: "instalacoes_obra",   nome: "Instalações da obra",               grupo: "materiais" },
  { id: "manutencao_equip",   nome: "Manutenção de equipamentos",        grupo: "materiais" },
  { id: "terraplanagem",      nome: "Terraplanagem",                     grupo: "materiais" },

  // ── mão de obra & prestadores ─────────────────────────────
  { id: "ajudantes",          nome: "Ajudantes",                grupo: "maoDeObra" },
  { id: "carpinteiro",        nome: "Carpinteiro",              grupo: "maoDeObra" },
  { id: "eletricista",        nome: "Eletricista",              grupo: "maoDeObra" },
  { id: "empreiteiro",        nome: "Empreiteiro",              grupo: "maoDeObra" },
  { id: "encarregados",       nome: "Encarregados",             grupo: "maoDeObra" },
  { id: "mo_diversos",        nome: "Mão de obra — diversos",   grupo: "maoDeObra" },
  { id: "marceneiro",         nome: "Marceneiro",               grupo: "maoDeObra" },
  { id: "pedreiros",          nome: "Pedreiros",                grupo: "maoDeObra" },
  { id: "pintor",             nome: "Pintor",                   grupo: "maoDeObra" },
  { id: "serralheiro",        nome: "Serralheiro",              grupo: "maoDeObra" },
  { id: "impermeabilizacao",  nome: "Impermeabilização",        grupo: "maoDeObra" },
  { id: "encanador",          nome: "Encanador",                grupo: "maoDeObra" },
  { id: "gesseiro",           nome: "Gesseiro",                 grupo: "maoDeObra" },
  { id: "instalador_ar",      nome: "Instalador de ar condicionado", grupo: "maoDeObra" },
  { id: "assentador_pisos",   nome: "Assentador de pisos e revestimentos", grupo: "maoDeObra" },
  { id: "vale_refeicao",      nome: "Vale refeição",            grupo: "maoDeObra" },
  { id: "fgts",               nome: "FGTS",                     grupo: "maoDeObra" },
  { id: "darf",               nome: "DARF",                     grupo: "maoDeObra" },

  // ── serviços & taxas ──────────────────────────────────────
  { id: "impostos",           nome: "Impostos",                          grupo: "servicos" },
  { id: "impressao_plantas",  nome: "Impressão de plantas",              grupo: "servicos" },
  { id: "outras_taxas",       nome: "Outras taxas e serviços",           grupo: "servicos" },
  { id: "tarifas_bancarias",  nome: "Tarifas bancárias",                 grupo: "servicos" },
  { id: "projetos_docs",      nome: "Projetos e documentação",           grupo: "servicos" },
  { id: "taxa_admin_obra",    nome: "Taxa de administração da obra",     grupo: "servicos" },
  { id: "contabilidade",      nome: "Escritório de contabilidade",       grupo: "servicos" },

  // ── excluídas (fora do resultado) ─────────────────────────
  { id: "reembolsos",         nome: "Reembolsos",               grupo: "excluidas" },
];
```

**Regra de negócio importante:** `taxa_admin_obra` é a receita do escritório
dentro da obra do cliente. Na planilha de origem ela está zerada — o relatório
mostrava o custo da obra, não a margem. No VICKE ela precisa existir e ser
lançável desde o dia 1.

### Etapas (dimensão de execução)

`ETAPAS_OBRA` — cada etapa tem `id`, `nome` e `macro` (a macroetapa usada nos
agrupamentos). Ordem = ordem construtiva; preservar.

```js
const ETAPAS_OBRA = [
  { id:"pre_obra",            nome:"Instalações pré-obra e projetos",  macro:"Pré-obra" },
  { id:"poste_padrao",        nome:"Poste padrão",                     macro:"Pré-obra" },
  { id:"terraplanagem",       nome:"Terraplanagem",                    macro:"Terraplanagem e demolições" },
  { id:"demolicoes",          nome:"Demolições e entulhos",            macro:"Terraplanagem e demolições" },
  { id:"arrimos",             nome:"Arrimos",                          macro:"Arrimos" },
  { id:"imp_arrimo",          nome:"Impermeabilização de arrimo",      macro:"Impermeabilizações" },
  { id:"fundacao",            nome:"Fundação",                         macro:"Fundação" },
  { id:"imp_baldrame",        nome:"Impermeabilização de baldrame",    macro:"Impermeabilizações" },
  { id:"contrapiso_int_1",    nome:"Contrapiso interno pav. 1",        macro:"Contrapisos" },
  { id:"supra_paredes_1",     nome:"Supraestrutura e paredes pav. 1",  macro:"Supraestrutura e paredes" },
  { id:"laje_1",              nome:"Laje pav. 1",                      macro:"Lajes" },
  { id:"supra_paredes_2",     nome:"Supraestrutura e paredes pav. 2",  macro:"Supraestrutura e paredes" },
  { id:"laje_2",              nome:"Laje pav. 2",                      macro:"Lajes" },
  { id:"coberturas",          nome:"Coberturas",                       macro:"Coberturas" },
  { id:"imp_perimetro",       nome:"Impermeabilização perímetro de paredes", macro:"Impermeabilizações" },
  { id:"imp_areas_molhadas",  nome:"Impermeabilização de áreas molhadas",    macro:"Impermeabilizações" },
  { id:"chapisco_reboco",     nome:"Chapisco e reboco",                macro:"Chapisco e reboco" },
  { id:"eletrica",            nome:"Elétrica",                         macro:"Elétrica" },
  { id:"hidraulica",          nome:"Hidráulica",                       macro:"Hidráulica" },
  { id:"esgoto_pluvial",      nome:"Esgoto e pluvial",                 macro:"Hidráulica" },
  { id:"contrapiso_ext",      nome:"Contrapisos externos",             macro:"Contrapisos" },
  { id:"massa_contrapiso_int",nome:"Massa de contrapisos internos",    macro:"Contrapisos" },
  { id:"massa_contrapiso_ext",nome:"Massa de contrapisos externos",    macro:"Contrapisos" },
  { id:"muros",               nome:"Muros",                            macro:"Muros" },
  { id:"portoes",             nome:"Portões",                          macro:"Portões" },
  { id:"pisos_revest",        nome:"Pisos e revestimentos",            macro:"Pisos e revestimentos" },
  { id:"forros",              nome:"Forros",                           macro:"Forros" },
  { id:"pintura",             nome:"Pintura",                          macro:"Pintura" },
  { id:"soleiras_peitoris",   nome:"Soleiras e peitoris",              macro:"Granito" },
  { id:"bancadas",            nome:"Bancadas",                         macro:"Granito" },
  { id:"portas_internas",     nome:"Portas internas",                  macro:"Portas e esquadrias" },
  { id:"esquadrias",          nome:"Esquadrias",                       macro:"Portas e esquadrias" },
  { id:"vidros_plasticos",    nome:"Vidros e plásticos",               macro:"Vidros e plásticos" },
  { id:"acab_eletrico",       nome:"Acabamento elétrico e luminárias", macro:"Elétrica" },
  { id:"loucas_metais",       nome:"Louças, metais e cubas",           macro:"Louças, metais e cubas" },
  { id:"marcenaria",          nome:"Marcenaria",                       macro:"Marcenaria" },
  { id:"calcadas",            nome:"Calçadas",                         macro:"Calçadas" },
  { id:"aquecimento",         nome:"Aquecimento e pressurização",      macro:"Aquecimento e pressurização" },
  { id:"piscina_equip",       nome:"Piscina — filtro, hidro e aquecimento", macro:"Piscina" },
  { id:"piscina_fundacao",    nome:"Piscina — fundação",               macro:"Piscina" },
  { id:"piscina_supra",       nome:"Piscina — supraestrutura e paredes", macro:"Piscina" },
  { id:"piscina_imp",         nome:"Piscina — impermeabilizações",     macro:"Piscina" },
  { id:"piscina_chapisco",    nome:"Piscina — chapisco e reboco",      macro:"Piscina" },
  { id:"piscina_revest",      nome:"Piscina — revestimento",           macro:"Piscina" },
  { id:"piscina_hidraulica",  nome:"Piscina — hidráulica",             macro:"Piscina" },
  { id:"piscina_deck",        nome:"Piscina — deck",                   macro:"Piscina" },
  { id:"limpeza_final",       nome:"Limpeza final",                    macro:"Limpeza final" },
  { id:"locacao_equip",       nome:"Locação de equipamentos",          macro:"Locação de equipamentos" },
  { id:"prestadores",         nome:"Prestadores de serviços",          macro:"Prestadores de serviços" },
  { id:"outros",              nome:"Outros",                           macro:"Outros" },
];
```

### Grupos de material (dimensão de suprimentos)

```js
const GRUPOS_MATERIAL = [
  "Aço", "Areia e pedra", "Argamassas", "Cimento", "Elétrica e iluminação",
  "Entulhos", "Equipamentos", "Esquadrias", "Ferramentas", "Forros", "Granito",
  "Impermeabilizantes", "Locação de ferramentas", "Louças", "Madeira de caixaria",
  "Marcenaria", "Metais", "Pisos e revestimentos", "Prestadores de serviços",
  "Telhas", "Tijolos e canaletas", "Tintas", "Tubulação PVC", "Outros",
];
```

---

## 3. Modelo de dados

### 3.1 Lançamento — estender o shape que já existe

Hoje o importador de NF em `outros.jsx` (~linha 1380) já cria lançamentos
assim:

```js
{ id, obraId, materialId, fornecedorId, quantidade, valorUnit, total,
  data, etapa, nf, pago, pendente_vincular_obra }
```

**Manter todos esses campos** e acrescentar:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `tipo` | `"custo" \| "receita"` | sim | derivado da conta, mas persistido para query rápida |
| `contaId` | string | sim | id de `PLANO_CONTAS` — **o que dirige o P&L** |
| `descricao` | string | sim | texto livre do lançamento |
| `dataPagamento` | `"YYYY-MM-DD"` | sim | regime de **caixa** |
| `periodoContabil` | `"YYYY-MM"` | sim | regime de **competência** |
| `notaId` | string | não | agrupa itens da mesma nota |
| `notaValorTotal` | number | não | valor cheio da nota (só para conferência do rateio) |
| `grupoMaterial` | string | não | um de `GRUPOS_MATERIAL` |
| `etapa` | string | não | id de `ETAPAS_OBRA` (o campo já existe, passa a guardar `id` e não texto livre) |

### 3.2 Compatibilidade retroativa — obrigatória

Lançamentos antigos não têm `contaId` nem `periodoContabil`. **Não migrar o
banco.** Normalizar na leitura, com uma função pura:

```js
function normalizarLancamento(l) {
  const data = l.dataPagamento || l.data || "";
  return {
    ...l,
    tipo:            l.tipo            || "custo",
    contaId:         l.contaId         || "material",       // default histórico
    dataPagamento:   data,
    periodoContabil: l.periodoContabil || (data ? data.slice(0, 7) : ""),
    total:           Number(l.total) || 0,
  };
}
```

Todo consumo de `data.lancamentos` passa por ela. Lançamento sem data válida é
descartado do P&L e contado num aviso ("N lançamentos sem data, fora do
relatório") — silenciar o problema é pior que mostrá-lo.

### 3.3 Rateio de nota — decisão deliberada

A planilha de origem tinha duas bases: uma no nível do item (com o valor
rateado) e outra deduplicada no nível da nota, e somava colunas diferentes em
cada visão. Isso é frágil e já produziu divergências de centavos.

**Aqui: uma base só, sempre no nível do item.** As duas visões somam o mesmo
campo (`total`); o que muda entre elas é apenas a chave de data. `notaValorTotal`
existe só para validar:

```
Σ total dos itens com o mesmo notaId  ==  notaValorTotal   (tolerância R$ 0,01)
```

Se não fechar, marcar a nota com um aviso na UI. Não corrigir automaticamente.

### 3.4 Gancho de orçado × realizado (não implementar agora)

Em `obra`, prever o campo:

```js
orcadoPorEtapa: {}   // { [etapaId]: number }
```

Criar o campo, deixar `{}`, e no `calcularPLObra` já devolver `orcado: 0` e
`desvio: null` por etapa. **Nenhuma UI de orçado nesta entrega.** É o gancho
para a comparação futura com o ObraManager.

---

## 4. O cálculo — função pura, sem React

Coração do módulo. Precisa ser testável isoladamente (rodar com `node` e um
array de lançamentos).

```js
/**
 * @param {Array}  lancamentos  data.lancamentos (cru, será normalizado aqui)
 * @param {string} obraId
 * @param {{ regime: "competencia" | "caixa" }} opts
 * @returns {PLObra}
 */
function calcularPLObra(lancamentos, obraId, { regime = "competencia" } = {}) { ... }
```

### Formato de retorno

```js
{
  regime: "competencia",
  meses: ["2025-05", "2025-06", ...],       // range CONTÍNUO, ver regra abaixo
  grupos: [
    {
      id: "receitas",
      titulo: "ENTRADAS TOTAIS",
      contas: [ { contaId, nome, porMes: { "2025-05": 30700, ... }, total } ],
      porMes: { "2025-05": 30700, ... },     // subtotal do grupo
      total: 308500,
    },
    ...
  ],
  saldoPorMes:     { "2025-05": 27427.60, ... },   // entradas − custos do mês
  saldoAcumulado:  { "2025-05": 27427.60, ... },   // soma corrida
  totais: {
    entradas: 308500,
    materiais: 220436.29,
    maoDeObra: 83475.44,
    servicos: 0,
    totalCustos: 303911.73,
    saldo: 4588.27,
  },
  rankings: {
    fornecedores:    [ { chave, nome, total, pct } ],  // desc, top 15 + "Outros"
    etapas:          [ ... ],
    macroEtapas:     [ ... ],
    gruposMaterial:  [ ... ],
  },
  avisos: [ { tipo, mensagem, ids: [] } ],
  lancamentosIgnorados: 0,
}
```

### Regras de cálculo (todas vieram da planilha; as marcadas ⚠ são correções)

1. Filtrar `l.obraId === obraId`. Lançamento sem `obraId` (`pendente_vincular_obra`)
   fica de fora e vira um aviso.
2. Chave de mês: `periodoContabil` se `regime === "competencia"`,
   `dataPagamento.slice(0,7)` se `"caixa"`.
3. **⚠ `meses` é um range contínuo** entre o menor e o maior mês com movimento.
   A planilha deletava colunas zeradas, o que quebrava a leitura de série
   temporal (um mês sem gasto *é* informação). Meses vazios entram com zero.
4. **Contas com `total === 0` são omitidas** da matriz (isso a planilha faz e
   está certo — 39 contas com 30 zeradas é ilegível). Grupos inteiros zerados
   também somem, exceto `receitas`, que sempre aparece.
5. Grupo `excluidas` **nunca entra** em `totais` nem em `saldo`. Aparece numa
   seção própria, recolhida por padrão, rotulada "Fora do resultado".
6. `saldoPorMes[m] = receitas[m] − materiais[m] − maoDeObra[m] − servicos[m]`.
7. `saldoAcumulado[m] = saldoAcumulado[m−1] + saldoPorMes[m]`.
8. Rankings: `SUM(total) GROUP BY` a dimensão, desc. Fornecedor sem
   `fornecedorId` cai em "Não informado" — não descartar.
9. **⚠ Arredondamento:** somar em centavos inteiros
   (`Math.round(v * 100)`) e dividir por 100 só na saída. A planilha carregava
   ruído de ponto flutuante (`17927.45998234865`); não repetir.
10. Nenhum `TOTAL` pode sair zerado por engano — a planilha tinha esse bug em
    duas tabelas. Cobrir com o teste do §8.

---

## 5. UI — view `financeiro`

Herdar a linguagem visual do `detalheObra`: paleta `VKD`
(`fundo #fafafb`, `grafite #1a1a1a`, azul `#1e3a5f`), `SYS_FONT`, cantos 16,
bordas `1.5px solid rgba(38,36,33,0.16)`, foco azul. Reaproveitar o objeto `C`
de `clientes.jsx` (`C.input`, `C.btn`, `C.btnSec`, `C.btnGhost`, `C.tag`,
`C.label`) — **passar via props ou duplicar mínimo**, não criar uma paleta nova.

### 5.1 Cabeçalho

`← Voltar` (para `detalheObra`) + nome da obra.

### 5.2 Faixa de KPIs — 4 cards

| Card | Valor | Cor |
|---|---|---|
| Entradas | `totais.entradas` | verde `#10b981` |
| Custos | `totais.totalCustos` | vermelho `#dc2626` |
| Saldo | `totais.saldo` | verde se ≥ 0, vermelho se < 0 |
| Meses | `meses.length` + faixa (`mai/25 – mar/26`) | neutro |

Formatação monetária: usar `fmt()` de `shared.jsx`. Datas em `pt-BR`,
mês abreviado minúsculo (`mai/25`).

### 5.3 Toggle de regime

Dois botões segmentados: **Competência** | **Caixa**. Estado local
`const [regime, setRegime] = useState("competencia")`.

Abaixo, uma linha de 12px explicando o que está sendo visto — o usuário é
arquiteto, não contador:

- Competência → *"Agrupado pelo mês em que o custo aconteceu."*
- Caixa → *"Agrupado pelo mês em que o dinheiro saiu."*

### 5.4 A matriz conta × mês

O componente central. Uma tabela:

- Coluna 1 fixa (`position: sticky; left: 0`) com o nome da conta.
- Uma coluna por mês + coluna `Total` no fim.
- Linhas de grupo (`ENTRADAS TOTAIS`, `MATERIAL & INSUMOS`, …) em negrito, com
  fundo `#f2f2f4`, e as contas do grupo indentadas abaixo.
- Grupo clicável para recolher/expandir (`useState` de um `Set` de ids abertos,
  todos abertos por padrão).
- Duas linhas finais destacadas: **SALDO FINAL** e **Saldo acumulado**.
  Valores negativos em `#dc2626`.
- Zeros renderizados como `–` cinza, não como `R$ 0,00` — a planilha ficava
  ilegível por isso.
- **A tabela inteira dentro de um `div` com `overflow-x: auto`.** A página
  nunca rola horizontalmente. Com 11+ meses isso é obrigatório.
- Números alinhados à direita, tabular (`fontVariantNumeric: "tabular-nums"`).

### 5.5 Rankings

Abaixo da matriz, três blocos em abas ou lado a lado: **Fornecedores**,
**Etapas**, **Grupos de material**. Cada linha: nome, valor, `%` do total, e uma
barra horizontal proporcional. Top 15 + linha "Outros" agregando o resto.

### 5.6 Estado vazio

Sem lançamentos: card centralizado, borda tracejada — *"Nenhum lançamento
nesta obra"* + botão **Lançar o primeiro**. Nunca renderizar uma matriz vazia.

### 5.7 Avisos

Se `avisos.length > 0`, uma faixa âmbar discreta no topo, recolhível, listando
notas com rateio que não fecha, lançamentos sem data e lançamentos sem obra
vinculada. Cada item leva ao lançamento.

### 5.8 Mobile

`isMobile` já chega por prop em `GestaoObraPanel`. No mobile:

- KPIs em grid 2×2.
- A matriz completa não cabe: mostrar apenas **mês corrente + Total**, com um
  `<select>` para escolher o mês. Não tentar espremer 11 colunas.
- Rankings viram lista simples, um bloco por vez.

---

## 6. UI — formulário de lançamento

View `formLancamento` (nova) dentro do mesmo painel. Campos, em ordem:

1. **Tipo** — segmentado Custo / Entrada. Muda a lista de contas.
2. **Conta** — `<select>` agrupado por grupo (`<optgroup>`). Obrigatório.
3. **Descrição** — texto. Obrigatório.
4. **Valor** — usar o componente `InputMoedaBR` que já existe no
   `onboarding.jsx` (formatação BR automática). Não escrever outro parser de
   moeda. Obrigatório, > 0.
5. **Data do pagamento** — `<input type="date">`. Obrigatório.
6. **Período contábil** — `<input type="month">`, **pré-preenchido com o mês da
   data de pagamento**. Na maioria dos casos o usuário não toca; quem precisa,
   ajusta. Esse default é o que torna o regime duplo indolor.
7. **Fornecedor** — `<select>` de `data.fornecedores` + opção "＋ Novo
   fornecedor" que cria inline (mesmo padrão do importador de NF).
8. **Etapa** — `<select>` de `ETAPAS_OBRA`, agrupado por `macro`. Opcional.
9. **Grupo de material** — `<select>`. Opcional. Só aparece se `tipo === "custo"`.
10. **Nº da nota** — texto, opcional.

Salvar:

```js
save({ ...data, lancamentos: [...(data.lancamentos || []), novoLancamento] });
```

`save` já é passado como prop até `GestaoObraPanel` e o `saveAllData` em
`api.js` faz o diff por `id` e chama `api.lancamentos.save()` só nos novos.
**Não chamar a API direto.**

`id` novo via `uid()` (`shared.jsx`).

### Permissões

`const perm = getPermissoes()` — já usado em `GestaoObraPanel`.

- `perm.podeEditar` → mostra "＋ Lançamento" e o botão Editar.
- `perm.podeExcluir` → mostra Remover.
- `visualizador` vê o P&L inteiro, sem nenhum botão de escrita.

Exclusão sempre via `dialogo.confirmar({ ..., destrutivo: true })`, nunca
`window.confirm`.

---

## 7. Backend — nenhuma mudança nesta entrega

Confirmado por leitura do `server.js`:

- Tabela `lancamentos` já existe com `(id, empresa_id, dados JSONB)`.
- `GET/POST/DELETE /api/lancamentos` já existem (linhas ~4010–4050), já filtram
  por `empresaId(req, res)` vindo do JWT.
- `api.lancamentos.*` já existe em `api.js`; `loadAllData()` já carrega
  `lancamentos`; `saveAllData()` já faz o diff.
- Campos novos vão dentro de `dados` — é exatamente o padrão JSONB do projeto.

Duas coisas ficam registradas como dívida, **não fazer agora**:

- `GET /api/lancamentos` devolve todos os lançamentos da empresa. Com o volume
  atual (centenas) o filtro no cliente é irrelevante. Passando de ~2.000,
  adicionar `?obraId=` com filtro em SQL.
- Falta `PUT /api/lancamentos/:id`. Para editar, por ora, o padrão do
  `POST` já é `ON CONFLICT (id, empresa_id) DO UPDATE`, então reenviar o objeto
  com o mesmo `id` atualiza. Confirmar isso na rota antes de usar; se não for,
  aí sim adicionar o `PUT` (espelhando `PUT /api/fornecedores/:id`, linha 3893).

---

## 8. Critério de aceite — o caso Villa Toscana

Criar `obra-financeiro.test.mjs` (rodável com `node`, sem framework) com um
fixture de lançamentos que reproduza a obra real. Os números abaixo saíram da
planilha em produção e **têm que bater ao centavo**:

| Métrica | Esperado |
|---|---|
| Meses | 11 (`2025-05` … `2026-03`) |
| Entradas totais | R$ 308.500,00 |
| — Depósito Recurso Próprio | R$ 308.500,00 |
| Material & insumos | R$ 220.436,29 |
| — Material | R$ 210.194,99 |
| — Frete | R$ 1.449,90 |
| — Aluguel de equipamentos | R$ 8.791,40 |
| Mão de obra & prestadores | R$ 83.475,44 |
| — Serralheiro | R$ 29.418,39 |
| — Pintor | R$ 22.559,05 |
| — Empreiteiro | R$ 17.670,00 |
| — Impermeabilização | R$ 6.028,00 |
| — Marceneiro | R$ 4.500,00 |
| — Eletricista | R$ 3.300,00 |
| Serviços & taxas | R$ 0,00 (grupo omitido da matriz) |
| **Total de custos** | **R$ 303.911,73** |
| **Saldo** | **R$ 4.588,27** |
| Saldo acumulado em `2025-08` | R$ 56.017,15 |
| Saldo do mês `2025-09` | −R$ 23.170,96 |

Rankings esperados (topo):

- Etapas: Coberturas R$ 91.951,76 · Esquadrias R$ 42.900,00 · Pintura
  R$ 32.308,38 · Forros R$ 32.000,00
- Fornecedores: Pantanal Aço R$ 48.983,65 · B&A Esquadrias R$ 38.000,00 ·
  George Decorações R$ 32.000,00
- Grupos de material: Prestadores de serviços R$ 76.391,44 · Aço R$ 49.603,07 ·
  Esquadrias R$ 42.400,00

Casos de borda a cobrir no mesmo teste:

- Lançamento sem `contaId` (legado) → cai em `material`, não quebra.
- Lançamento sem data → não entra, `lancamentosIgnorados === 1`.
- Mês sem movimento no meio da série → coluna presente, tudo zero.
- Conta `reembolsos` → não altera `totalCustos` nem `saldo`.
- Regime caixa ≠ competência quando `periodoContabil` diverge de
  `dataPagamento` em pelo menos um lançamento.
- Nenhum `total` de grupo pode ser `0` quando há linhas com valor.

Verificação visual antes do deploy: gerar um HTML standalone com a matriz
renderizada e abrir no navegador, conforme o fluxo de teste visual que já é
padrão neste projeto.

---

## 9. Ordem de implementação

1. `obra-financeiro.jsx` com as três constantes de taxonomia. Rodar
   `node combine.js` e conferir que o build passa.
2. `normalizarLancamento` + `calcularPLObra`. Escrever o teste do §8 **antes**
   da UI e fazer passar.
3. Card "Financeiro" no `detalheObra` + grid 2×2 + view `financeiro` com só os
   KPIs. Ver no navegador.
4. Matriz conta × mês, com scroll horizontal e grupos recolhíveis.
5. Toggle de regime.
6. Rankings.
7. `formLancamento` + persistência via `save`.
8. Avisos, estado vazio, mobile.
9. `npm run cb` para conferir o build; deploy com `npm run cpush`.

---

## 10. O que NÃO fazer

- Não editar `src/AppCombined.jsx`.
- Não criar tabela nova no Postgres nem coluna nova — os campos vão no `dados` JSONB.
- Não chamar `api.*` direto dos componentes; usar `save(...)`.
- Não reimplementar checagem de permissão — usar `getPermissoes()`.
- Não usar `localStorage` para estado de negócio.
- Não introduzir biblioteca de tabela, de gráfico ou de CSS. A matriz é uma
  `<table>` com estilos inline, como o resto do projeto.
- Não quebrar o shape de lançamento que o importador de NF em `outros.jsx` grava
  — só estender.
- Não implementar orçado × realizado nesta entrega; só deixar o campo.
- Não renomear `id` de conta ou de etapa depois que houver dado gravado.
