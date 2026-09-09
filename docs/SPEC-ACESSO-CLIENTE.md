# Acesso do cliente

## "Acesso sem obra vinculada" logo depois do primeiro login

Sintoma: o cliente entra e cai direto na tela "Acesso sem obra vinculada".

Causa: `loadAllData()` pede nove listas em `Promise.all`. Três delas —
`/api/materiais`, `/api/lancamentos`, `/api/receitas` — estão **fora** da lista
branca do cliente no backend (`API_CLIENTE_LEITURA`), então voltam 403. Um 403
em qualquer promessa derruba o `Promise.all` inteiro, `loadData()` cai no
`catch`, faz `setData(SEED)` e marca offline. Com o SEED no lugar dos dados
reais, `data.clientes` não tem o cadastro dele → `cliente` é null → tela de
bloqueio. Não era permissão errada nem cadastro faltando.

Correção: `loadAllData()` detecta o perfil pelo `vicke-user` do localStorage
(`ehAcessoDeCliente()`) e resolve essas três listas como `[]` em vez de pedir
ao backend. O painel da obra não usa nenhuma delas.

Regra que fica: **toda chamada nova em `loadAllData` precisa estar na lista
branca do cliente ou ser pulada para ele.** Se não, o cliente volta a cair no
SEED. `api.admin.sinapi.parametros()` e as do CUB já têm `.catch()` próprio e
por isso não derrubam nada.

## Orçamento e cronograma são só de leitura para o cliente

`podeEditar` é verdadeiro para o cliente — é o que libera dar baixa em conta e
lançar despesa. Por isso, em `OrcamentoObraView` e `CronogramaObraView`, o
portão de edição usa `podeGerenciarObra` (falso para o cliente), não
`podeEditar`.
