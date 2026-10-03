# CLAUDE.md

Este arquivo fornece orientação ao Claude Code (claude.ai/code) ao trabalhar com o código deste repositório.

## Projeto

Orbi (também chamado **Vicke** internamente — marca antiga ainda hard-coded em IDs/chaves/nomes de storage como `vicke-token`, `vicke-sidebar-colapsada`, prefixos de tabela, subject do JWT) é um SaaS em português para escritórios de arquitetura/construção: clientes, projetos, orçamentos, fornecedores, materiais, financeiro e propostas em PDF.

- **Frontend**: React 19 + Vite, deploy na Vercel (`vercel.json` com SPA rewrite). Sem TypeScript, sem framework de CSS — estilos inline em todo o código.
- **Backend**: Node 18+ Express + PostgreSQL, deploy na Railway (serviço `sparkling-patience`, `orbi-production-5f5c.up.railway.app`). **O backend em produção é o repositório separado `vicke-backend`** (`C:\Users\renat\vicke-backend`, GitHub `renatoftb-dotcom/vicke-backend`). A pasta `backend/` deste repo é uma cópia antiga, parada desde set/2026 (não tem, por exemplo, o coletor SINAPI) — não edite nela achando que vai para produção. Os arquivos `orbi.db*` são resíduo de SQLite — o backend atual é só Postgres via `DATABASE_URL`.
- **E-mail**: Resend (domínio `vicke.com.br`), com webhook de entrada em `/webhook/resend-inbound` (Svix, precisa de `express.raw()` antes do `express.json()` global).
- **Idioma do domínio é português** (`cliente`, `orçamento`, `escritório`, `obra`, `lançamento`, `receita`, `fornecedor`, `material`). Mantenha isso em identificadores e strings de UI.

## Trabalhando com este codebase

- **Sempre releia arquivos do disco antes de editar.** Este codebase é editado em paralelo a partir de múltiplas sessões; visões em cache ou desatualizadas no contexto já causaram perda de alterações no passado.
- **Módulos grandes — edite cirurgicamente, não reescreva:** `orcamento-teste.jsx` (~9.900 linhas), `cotacoes-obra.jsx` (~8.300), `orcamento-obra.jsx` (~6.700), `clientes.jsx` (~5.600), `escritorio-financeiro.jsx` (~3.400), `resultado-pdf.jsx`. Use substituições de string específicas; nunca reescreva esses arquivos por inteiro.
- **Smoke test em HTML standalone antes do deploy.** Ao iterar em um único módulo, teste-o em uma página HTML standalone (carregando React + o módulo via CDN) antes de rodar `npm run cpush`. Isso pega bugs de escopo/ordem que o dev server esconde.

## Regras do usuário (Renato) — valem sempre

- **Comandos de terminal sempre num único bloco**, um por linha, para colar de uma vez — nunca um comando por bloco.
- **`git push` é sempre manual**, feito por ele no VSCode/Windows. Claude não roda git na máquina dele e não guarda credenciais.
- **Nunca pedir nem receber tokens/credenciais pelo chat** — ele cola direto no Railway/Vercel.
- **Antes de gravar qualquer dado em produção** (SQL, script, endpoint admin), mostrar exatamente o que vai mudar e esperar o ok.
- **Edições no backend são cirúrgicas.** Quando as duas pontas mudam, o backend publica primeiro.
- **Toda tela mexida é conferida no celular e no desktop**, e o resultado dos dois vai no relato da entrega.
- **Visual** (detalhes em `docs/SPEC-VISUAL.md`): azul de interação `#0474f4`; nada de fundos cobre/âmbar/verde; texto `#111827` / `#4b5563` / `#6b7280`.
- **Números sempre em pt-BR**: dinheiro com duas casas e vírgula (`14,80`, nunca `14.8`), em todas as telas.
- **A interface não mostra valores negativos** — única exceção: saldos financeiros reais no extrato do escritório.
- **Saldos do escritório conciliados até ago/2026 não podem mudar** — reclassificar contas pode, alterar cálculo ou saldo final não.
- Rotinas de parâmetros compartilhados (SINAPI etc.) rodam **no backend para todas as empresas**, nunca numa tarefa local nem só para a Padovan.
- IA dentro do VICKE: para a Padovan usa o plano Claude do Renato (não API paga); outros escritórios ficariam com API cobrada à parte ou sem IA.

## Modo Dev — empresa de teste isolada

Pra iterar em features novas (ex: novo onboarding de orçamento) sem afetar clientes em produção (Padovan etc), o sistema tem um modo dev por empresa. Empresas com `escritorio.dados.dev_mode = true` ganham um banner amarelo no topo do app com 4 botões de reset.

**Setup inicial (uma vez):**

1. Criar empresa "Vicke Dev" via admin → "Nova empresa" (modal padrão). Cria usuário admin junto.
2. Ativar `dev_mode` na empresa criada (PostgreSQL no Railway):
   ```sql
   UPDATE escritorio
      SET dados = jsonb_set(COALESCE(dados, '{}'::jsonb), '{dev_mode}', 'true')
    WHERE empresa_id = '<id-da-vicke-dev>';
   ```
   Substitua `<id-da-vicke-dev>` pelo `id` da empresa criada (visível na lista do admin).

3. Logout do master e login com user da Vicke Dev. Banner "🧪 Modo Dev" aparece no topo.

**Botões de reset disponíveis** (gated por `dev_mode` no backend):

- **Resetar orçamentos** — apaga todos os orçamentos e propostas da empresa dev. Mantém clientes/projetos.
- **Resetar onboarding empresa** — limpa `escritorio.dados` (mantém `dev_mode`) e marca `precisa_fazer_onboarding=true` nos usuários.
- **Resetar onboarding orçamento** — remove a flag `onboarding_orcamento_concluido` do escritório.
- **Resetar tudo** — apaga clientes, fornecedores, materiais, obras, lançamentos, orçamentos, receitas. Mantém empresa, usuários e escritório (com `dev_mode`).

**Defesa em profundidade:** as rotas `POST /api/dev/reset/*` no backend re-checam o flag. Mesmo se um JWT de Padovan chamar essas rotas, retorna 403.

**Feature flags por empresa:** use `temFeature(escritorio, "nome")` em `shared.jsx`. Lê `escritorio.features.<nome>` (ou retorna true se `dev_mode=true`). Adicione a flag via SQL idêntico ao de cima, trocando o path:
```sql
UPDATE escritorio SET dados = jsonb_set(dados, '{features,onboarding_orcamento_v2}', 'true') WHERE empresa_id = '...';
```

## Branch dev + preview deploys (Vercel)

Pra desenvolvimento contínuo sem afetar produção (URL principal `orbi.log.br` / `vicke.com.br`):

```
git checkout -b dev      # cria branch dev local
git push -u origin dev   # publica
```

Vercel detecta branches novas e cria URL de preview automática (algo como `orbi-git-dev-<user>.vercel.app`). Cada `git push` na `dev` redeploya só o preview. Quando estável, abre PR `dev → main` e merge.

Backend (Railway) por padrão segue o mesmo branch `main`. Pra ter um backend preview separado por branch, configure environments no Railway (fora do escopo deste repo).

## Comandos

Frontend (rode da raiz do repositório):

| Comando | O que faz |
|---|---|
| `npm run dev` | Vite dev server na porta 5173 |
| `npm run combine` | Regera `src/AppCombined.jsx` a partir de `src/modules/*` |
| `npm run build` | Build de produção do Vite em `dist/` (**não** roda combine antes) |
| `npm run cb` | `combine` e depois `build` — use isso antes de fazer deploy |
| `npm run cpush` | `combine` + `build` + `git add . && git commit -m "update" && git push` (atalho antigo — ver publicação abaixo) |

**Publicação (desde set/2026)** — a integração GitHub→Vercel do projeto `orbi-pouk` parou de disparar builds, então o deploy é pela CLI (projeto já linkado). Detalhes e o problema da tela branca em `docs/SPEC-DEPLOY.md`:

```
cd C:\Users\renat\orbi
git push
npx vercel --prod
```

Backend (`vicke-backend`, Railway publica no push para `main`):

```
cd C:\Users\renat\vicke-backend
git add server.js
git commit -m "<mensagem>"
git push
```

Backend (`cd backend`):

```
npm start          # roda server.js, escuta na PORT (padrão 3000)
```

Não há suíte de testes, nem script de lint plugado em CI, nem typecheck. O ESLint configurado (`eslint.config.js`) pode ser invocado manualmente com `npx eslint .`, mas não faz parte do fluxo normal.

### Ambiente

- `.env.local` → `VITE_API_URL=http://...` (backend local ou IP da LAN). `.env.production` aponta para a URL da Railway. O frontend tem um fallback hard-coded para a URL da Railway também — veja `src/modules/shared.jsx` e `src/modules/api.js`.
- Env do backend: `DATABASE_URL` (Postgres), `JWT_SECRET` (**obrigatório em produção** — o servidor crasha no boot sem ele), `PORT`, `NODE_ENV`.

## A etapa de build do `combine.js` — leia isso antes de editar qualquer código de frontend

Essa é a peculiaridade arquitetural mais importante do codebase.

`src/AppCombined.jsx` (~64.000 linhas) é **gerado** pelo `combine.js`, que concatena os arquivos em `src/modules/` numa ordem fixa:

```
shared.jsx → api.js → outros.jsx →
insumos-seed-cadastro.jsx → insumos-seed.jsx → composicoes-seed.jsx →
cronograma-seed.jsx → insumos.jsx → obra-financeiro.jsx →
escritorio-financeiro.jsx → orcamento-obra.jsx → cronograma-obra.jsx →
contratos-obra.jsx → contas-pagar.jsx → cotacoes-obra.jsx → clientes.jsx →
resultado-pdf.jsx → shared-textos.jsx → modelo-padrao.jsx →
modelos-registry.jsx → template-edicao.jsx → orcamento-onboarding.jsx →
orcamento-teste.jsx → escritorio.jsx → admin.jsx → login.jsx →
mensagens.jsx → onboarding.jsx → orcamento-config.jsx → app.jsx →
render-pdf-route.jsx
```

A fonte da verdade é o array `ORDER` em `combine.js` (com comentários explicando por que cada bloco vem onde vem — ex.: insumos antes de obra-financeiro, porque o catálogo de insumos é a fonte de preço da estimativa e `insumo.codigo` é a chave que liga estimado e realizado).

Implicações:

- **Nunca edite `src/AppCombined.jsx` diretamente** — ele é sobrescrito a cada `combine`. Edite os arquivos em `src/modules/`.
- A saída é um **único script concatenado**, não módulos ES. Tudo vive num escopo compartilhado: funções/componentes definidos antes ficam visíveis para módulos posteriores sem `import`. Os arquivos de módulo, portanto, não têm `import`/`export` para símbolos cross-module. O primeiro módulo (`shared.jsx`) faz o único import do React (`useState, useEffect, useRef, useCallback, useMemo`) no topo.
- **Ordem importa.** `app.jsx` é o componente de entrada (`export default function ModuloClientesFornecedores`) e depende de todos os módulos anteriores. Adicionar um módulo novo significa editar o array `ORDER` em `combine.js`.
- `render-pdf-route.jsx` é intencionalmente o último e se expõe via `window.RenderPdfRoute` — veja roteamento abaixo.
- Depois de editar módulos, rode `npm run combine` (ou `npm run cb`) antes de testar o build de produção. `npm run dev` re-importa `AppCombined.jsx` em mudanças, então durante o dev você precisa rodar `combine` (ou `cb`) novamente para as mudanças aparecerem.

`src/App.jsx` é só `export { default } from "./AppCombined.jsx";`. `src/api.js` é um cliente de API antigo standalone que ainda está no repositório mas **não é usado em runtime** — o que é usado é `src/modules/api.js` (que vai para dentro do AppCombined e adiciona auth via JWT + auto-logout em 401).

## Roteamento — não tem React Router

`src/main.jsx` faz uma checagem one-shot da URL antes de montar:

- Path começa com `/render-pdf/` → renderiza `<RenderPdfRoute />` (lido de `window.RenderPdfRoute`, exposto pelo último módulo). Usado pelo Puppeteer headless para tirar snapshot de propostas como PDF. Renderiza sem StrictMode (captura single-shot).
- Qualquer outra coisa → renderiza o `<App />` principal.

A Vercel reescreve todo path para `index.html` (`vercel.json`), então a SPA boota independente da URL.

Dentro do app principal, o "roteamento" é uma string de state `aba` em `app.jsx` (`"home"`, `"clientes"`, `"projetos:etapas"`, `"projetos:orcamentos"`, `"obras"`, `"financeiro"`, `"fornecedores"`, `"escritorio"`, `"orcamento"`, `"admin"`, `"admin:empresas"`, `"admin:usuarios-master"`, `"admin:manutencao"`, `"admin:feedback"`, `"admin:cub"`, `"mensagens"`, `"nf"`). O switch grande está por volta de `app.jsx:1905`. `tentarTrocar(fn)` é o portão que executa `fn` só se não houver state dirty de orçamento não salvo.

## Auth e multi-tenancy

JWT mora em `localStorage["vicke-token"]`, assinado por 7 dias, payload inclui `id, nome, email, perfil, nivel, membro_id, empresa_id, empresa_nome`.

- `perfil`: `master` (admin cross-app, vê Master Dashboard, módulo Admin, Mensagens), `cliente` (cliente final do escritório, só leitura da própria obra — lista branca `API_CLIENTE_LEITURA` no backend, ver `docs/SPEC-ACESSO-CLIENTE.md`) ou qualquer outra coisa (usuário tenant).
- `nivel`: `admin | editor | visualizador` (dentro da empresa).

Helpers de auth do frontend ficam no topo de `shared.jsx`: `decodeJWT`, `isTokenExpirado`, `getUsuarioAtual`, `getNivelUsuario`, `getPermissoes`. A UI mostra/esconde ações conforme isso; o backend re-checa (defesa em profundidade).

Backend (`backend/server.js`):

- `authMiddleware` decodifica o JWT e seta `req.user`.
- `masterOnly`/`adminOnly` são portões extras para rotas `/admin/*` e `/empresa/*`.
- **Todas as rotas `/api/*` são tenant-scoped via `req.user.empresa_id`.** Um único middleware `app.use("/api", ...)` impõe:
  - `/api/health` é pública (healthcheck da Railway).
  - Todas as outras precisam de token válido.
  - Writes (`POST/PUT/DELETE`) precisam de `admin` ou `editor`.
  - `DELETE` precisa de `admin`.
  - Paths em `API_ADMIN_ONLY_PATHS` (`/escritorio`, `/config`, `/logo`, `/backup/importar`) precisam de `admin`.
  - **Primary keys compostas** em tabelas de tenant: `(id, empresa_id)` com `CASCADE` no delete quando uma empresa é removida.
  - **`emp_master` é protegida** — o tenant master não pode ser deletado por nenhuma rota, nem por um usuário master.
  - **Log de auditoria** captura 20+ tipos de evento (login, reset de senha, criação/deleção de empresa, etc.) com retenção de 1 ano via cron noturno. Senhas nunca são logadas, nem em eventos de login com falha.
- Toda query faz join em `empresa_id`. INSERTs **sempre forçam `empresa_id` do JWT, nunca do body**. Ao adicionar uma rota, siga esse padrão — use o helper `empresaId(req, res)` no topo de cada handler `/api/*`.
- `/auth/login` tem rate limit em memória (5 tentativas por IP a cada 15 min). App single-process na Railway, então o map em memória é suficiente.
- CORS é allow-list (`vicke.com.br`, `orbi.log.br`, o pattern de domínio de preview da Vercel, localhost). Domínios novos precisam ser adicionados a `ALLOWED_ORIGINS`.

A maioria das tabelas de domínio (`clientes`, `fornecedores`, `materiais`, `obras`, `lancamentos`, `orcamentos_projeto`, `receitas`) seguem o mesmo formato: `id TEXT PK, empresa_id TEXT FK, dados JSONB, criado_em, atualizado_em` — a linha carrega um blob JSONB e a rota retorna/salva `r.dados` como o registro canônico. `initDB()` só garante que `empresas`, `usuarios`, `config_geral` existem; as tabelas de negócio foram criadas por um script de migration externo (`migration-sprint2.sql`, não está neste repositório).

## Fluxo de dados do frontend

- `App` (= `ModuloClientesFornecedores` em `app.jsx`) é dono do objeto global `data`: `{ clientes, fornecedores, materiais, obras, lancamentos, orcamentosProjeto, receitasFinanceiro, escritorio }`.
- `loadAllData()` e `saveAllData(newData, oldData)` em `src/modules/api.js` (e na duplicata legada `src/api.js`) fazem o marshalling entre esse objeto e os endpoints REST. `saveAllData` faz um diff por coleção (por `id` + igualdade via `JSON.stringify`) e dispara em paralelo um `Promise.all` de chamadas `save`/`delete` — não há semântica de PATCH no backend.
- Módulos recebem `data` e `save` como props; chamar `save(newData)` dispara o ciclo de diff-e-PUT e atualiza o `data` em memória de forma otimista.
- Um `dataRef` espelha o `data` para callbacks assíncronos lerem a versão mais fresca (evita o bug "edita orçamento → salva proposta → state fica stale" mencionado em `app.jsx:980`).

## ObraManager — regras de precificação (`orcamento-teste.jsx` + `resultado-pdf.jsx`)

O módulo de proposta/orçamento tem matemática de precificação não-óbvia. Não altere fórmulas sem confirmar com o usuário.

- **Preço por m²:** `precoM2Ef = pb × fatorMult`, onde `fatorMult` já incorpora `indiceComodos` e `indicePadrao`.
- **Preço base via CUB:** `precoBase = pct × CUB[categoria][padrão]`, onde categoria é selecionada por tipo de projeto:
  - **Residencial / Clínica:** `CUB[R-1][Baixo|Normal|Alto]` — validado contra Padovan: `0,02388 × 2475,44 = R$59,11/m²`
  - **Conj. Comercial:** `CUB[CSL-8][Normal|Alto]` — Baixo fallback para Normal (CSL-8 não tem padrão Baixo)
  - **Galpão:** `CUB[GI][Único]` — padrão único, sem variações
- **Imposto é calculado por dentro:** `valor_bruto = liquido / (1 - aliq/100)`. PDFs mostram valores sem imposto, depois adicionam uma linha "Total sem impostos", uma linha "+ Impostos", e uma caixa escura "Total Geral com Impostos".
- **Quatro states de desconto/parcelamento separados**, por contexto:
  - Padrão: `descontoEtapa` (5% / 3x), `descontoPacote` (10% / 4x)
  - Contrato: `descontoEtapaCtrt` (5% / 2x), `descontoPacoteCtrt` (15% / 8x)
  - Cada um mostra OU à vista com desconto OU parcelado sem desconto, nunca os dois.
- **Cinco etapas padrão** (todas editáveis por proposta): Viabilidade 10%, Preliminar 30%, Aprovação 12%, Executivo 38%, Engenharia 10%.
- **Lista "Não Inclusos" é dinâmica:** adiciona "Projetos de Engenharia" quando `!incluiEng`, adiciona "Impostos" quando `!temImposto`.

## Geração de PDF

`/render-pdf/:uuid?token=...` é a rota standalone que o Puppeteer (rodando no backend, não está neste repositório) acessa para renderizar `<PropostaPreview/>` com `lockEdicao=true`. A rota busca `/api/proposta/render-data`, renderiza, e então monta `<div data-render-ready="true"/>` quando tudo está pronto — o Puppeteer espera por esse selector antes de capturar. Veja `src/modules/render-pdf-route.jsx` para o contrato.

## Cron / manutenção do backend (repo `vicke-backend`)

- `jobs/manutencao.js` roda toda noite às 03:00 pelo `node-cron`. Usa a mesma função `query` que as rotas.
- `jobs/sinapi-coletor.js` — cron nos dias 20 e 27; grava `config_geral.sinapi_parametros` (R$/h, produtividade HH, preços de insumos) para todas as empresas; endpoints `/api/sinapi/parametros` e `/admin/sinapi/*`; o frontend lê `data.sinapi`. Ver `docs/ROTINA-SINAPI.md`.

## Gestão de obra — módulos e specs

Tudo versionado em `docs/` — **leia a spec antes de mexer no módulo correspondente**:

| Spec | Assunto | Módulo principal |
|---|---|---|
| `SPEC-INSUMOS.md` | catálogo central de insumos, chave única `codigo`, preço manual ou da última compra | `insumos.jsx` + seeds |
| `PRECOS-REFERENCIA.md` | origem dos preços de referência | `insumos-seed*.jsx` |
| `SPEC-ORCAMENTO-OBRA.md` | estimado: quantitativos a partir da geometria | `orcamento-obra.jsx` |
| `SPEC-INSTALACOES.md` | hidráulica/elétrica/louças por contagem de ambientes, kits SINAPI | `orcamento-obra.jsx` |
| `SPEC-PL-OBRA.md` | P&L da obra, estimado × realizado | `obra-financeiro.jsx` |
| `SPEC-CRONOGRAMA.md` | prazo simplificado + opção por produtividade HH | `cronograma-obra.jsx` |
| `SPEC-COTACOES.md` | cotação → escolha → pedido; "conta na loja"; envio por WhatsApp | `cotacoes-obra.jsx` |
| `SPEC-CONTAS-PAGAR.md` | uma linha por pedido sob o nome da loja, pagar vários juntos, PIX copiável | `contas-pagar.jsx` |
| `SPEC-CONTRATOS.md` | contratos de obra | `contratos-obra.jsx` |
| `SPEC-REFORMA.md` | obras de reforma | — |
| `SPEC-ACESSO-CLIENTE.md` | perfil `cliente` e o bug da tela "sem obra vinculada" | `api.js` |
| `SPEC-VISUAL.md` | formato visual de todos os módulos (menos orçamento de projeto) | `app.jsx` |
| `SPEC-DEPLOY.md` | publicação e tela branca | — |
| `ROTINA-SINAPI.md` | coletor SINAPI no backend | `vicke-backend/jobs` |

Referência das planilhas VBA antigas em `docs/referencia-orcamento/` — usar a **mecânica**, nunca copiar as fórmulas antigas.

Regras de negócio já decididas: em obra de cliente o pagamento é do cliente e não entra no extrato do escritório; número do pedido da loja ≠ número da NF (guardar os dois); insumos de etapa definida preenchem a etapa sozinhos, insumos ambíguos (cimento, areia, aço, tábua) ficam em branco de propósito; no orçamento, esquadria aparece como uma linha com preço fechado.

## WhatsApp — estado atual

- **Não há integração por API ainda.** Todo envio é por link `wa.me`: `linkWhatsApp(telefone, msg)` em `cotacoes-obra.jsx` (normaliza para `55` + DDD + número; abaixo de 10 dígitos devolve `""`). O VICKE abre a conversa com o texto pronto e **quem aperta enviar é o usuário**, no WhatsApp dele. Envio para várias lojas é uma fila, uma conversa por vez.
- Contatos de clientes e prestadores têm o flag `whatsapp: true/false` no item de `contatos` (`clientes.jsx`, `outros.jsx`); a proposta usa o primeiro contato com WhatsApp.
- Respostas de loja que chegam pelo WhatsApp são lançadas à mão na cotação.
- **Visão de produto (out/2026):** o WhatsApp como elo entre obra (pedreiros), lojas (vendedores) e escritório — "como se conectasse todos os WhatsApps formando um sistema". Também pendente: entrada por voz no lançamento de pedido/cotação.

## Pegadinhas de nomenclatura

- O nome do package em `package.json` é `orbi`; o `package.json` do backend diz `vicke-backend`. Os dois são o mesmo produto.
- Chaves de storage, prefixos de tabelas e mensagens de console ainda dizem `vicke` — não "conserte" isso a menos que explicitamente pedido; são load-bearing para sessões de usuários e DBs existentes.
