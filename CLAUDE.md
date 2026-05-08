# CLAUDE.md

Este arquivo fornece orientação ao Claude Code (claude.ai/code) ao trabalhar com o código deste repositório.

## Projeto

Orbi (também chamado **Vicke** internamente — marca antiga ainda hard-coded em IDs/chaves/nomes de storage como `vicke-token`, `vicke-sidebar-colapsada`, prefixos de tabela, subject do JWT) é um SaaS em português para escritórios de arquitetura/construção: clientes, projetos, orçamentos, fornecedores, materiais, financeiro e propostas em PDF.

- **Frontend**: React 19 + Vite, deploy na Vercel (`vercel.json` com SPA rewrite). Sem TypeScript, sem framework de CSS — estilos inline em todo o código.
- **Backend**: Node 18+ Express + PostgreSQL, deploy na Railway. Mora em `backend/` com seu próprio `package.json`/`node_modules`. Os arquivos `orbi.db*` são resíduo de SQLite — o backend atual é só Postgres via `DATABASE_URL`.
- **Idioma do domínio é português** (`cliente`, `orçamento`, `escritório`, `obra`, `lançamento`, `receita`, `fornecedor`, `material`). Mantenha isso em identificadores e strings de UI.

## Trabalhando com este codebase

- **Sempre releia arquivos do disco antes de editar.** Este codebase é editado em paralelo a partir de múltiplas sessões; visões em cache ou desatualizadas no contexto já causaram perda de alterações no passado.
- **Módulos grandes — edite cirurgicamente, não reescreva:** `src/modules/orcamento-teste.jsx` (~4400 linhas) e `src/modules/resultado-pdf.jsx` (~1000 linhas). Use substituições de string específicas; nunca reescreva esses arquivos por inteiro.
- **Smoke test em HTML standalone antes do deploy.** Ao iterar em um único módulo, teste-o em uma página HTML standalone (carregando React + o módulo via CDN) antes de rodar `npm run cpush`. Isso pega bugs de escopo/ordem que o dev server esconde.

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
| `npm run cpush` | `combine` + `build` + `git add . && git commit -m "update" && git push` (atalho de deploy do usuário) |

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

`src/AppCombined.jsx` (~26.000 linhas) é **gerado** pelo `combine.js`, que concatena os arquivos em `src/modules/` numa ordem fixa:

```
shared.jsx → api.js → outros.jsx → clientes.jsx → resultado-pdf.jsx →
orcamento-teste.jsx → escritorio.jsx → admin.jsx → login.jsx →
mensagens.jsx → onboarding.jsx → orcamento-config.jsx → app.jsx →
render-pdf-route.jsx
```

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

- `perfil`: `master` (admin cross-app, vê Master Dashboard, módulo Admin, Mensagens) ou qualquer outra coisa (usuário tenant).
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
- **Preço base via CUB:** `precoBase = pct × CUB[estado][R-1][padrão]`. Validado contra cliente Padovan: `0,02388 × 2475,44 = R$59,11/m²`.
- **Imposto é calculado por dentro:** `valor_bruto = liquido / (1 - aliq/100)`. PDFs mostram valores sem imposto, depois adicionam uma linha "Total sem impostos", uma linha "+ Impostos", e uma caixa escura "Total Geral com Impostos".
- **Quatro states de desconto/parcelamento separados**, por contexto:
  - Padrão: `descontoEtapa` (5% / 3x), `descontoPacote` (10% / 4x)
  - Contrato: `descontoEtapaCtrt` (5% / 2x), `descontoPacoteCtrt` (15% / 8x)
  - Cada um mostra OU à vista com desconto OU parcelado sem desconto, nunca os dois.
- **Cinco etapas padrão** (todas editáveis por proposta): Viabilidade 10%, Preliminar 30%, Aprovação 12%, Executivo 38%, Engenharia 10%.
- **Lista "Não Inclusos" é dinâmica:** adiciona "Projetos de Engenharia" quando `!incluiEng`, adiciona "Impostos" quando `!temImposto`.

## Geração de PDF

`/render-pdf/:uuid?token=...` é a rota standalone que o Puppeteer (rodando no backend, não está neste repositório) acessa para renderizar `<PropostaPreview/>` com `lockEdicao=true`. A rota busca `/api/proposta/render-data`, renderiza, e então monta `<div data-render-ready="true"/>` quando tudo está pronto — o Puppeteer espera por esse selector antes de capturar. Veja `src/modules/render-pdf-route.jsx` para o contrato.

## Cron / manutenção do backend

`backend/jobs/manutencao.js` roda toda noite às 03:00 pelo `node-cron` (agendado em `server.js:1347`). Usa a mesma função `query` que as rotas.

## Pegadinhas de nomenclatura

- O nome do package em `package.json` é `orbi`; o `package.json` do backend diz `vicke-backend`. Os dois são o mesmo produto.
- Chaves de storage, prefixos de tabelas e mensagens de console ainda dizem `vicke` — não "conserte" isso a menos que explicitamente pedido; são load-bearing para sessões de usuários e DBs existentes.
