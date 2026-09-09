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

## O Chrome preenchia a "senha temporária recebida" sozinho

Sintoma: o cliente entra pela primeira vez, cai na tela de troca obrigatória e
o campo "Senha temporária recebida" já vem preenchido — com a senha salva do
escritório naquele navegador. Quem não reparasse enviava a senha errada.

Causa: os três campos de `CampoSenha` não tinham `name` nem `autocomplete`. Sem
isso o Chrome trata o primeiro `input[type=password]` da página como o campo de
login do site e preenche com o que está salvo para o domínio.

Correção: os três campos declaram `autocomplete="new-password"` — inclusive o
da senha temporária, que semanticamente seria `current-password`, mas é
justamente esse valor que dispara o preenchimento. `new-password` é o único que
o Chrome respeita como "não preencha". Vão junto `name` próprio,
`autoCorrect/autoCapitalize=off`, `spellCheck=false` e os opt-outs de
LastPass/1Password.

O texto da tela também passou a distinguir primeiro acesso do cliente
("Digite a senha que o escritório te passou") do reset feito por admin.
