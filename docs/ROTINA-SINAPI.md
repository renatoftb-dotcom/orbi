# Rotina de atualização dos parâmetros SINAPI

O VICKE usa três conjuntos de parâmetros do SINAPI (base São Paulo, lidos em
buscadorsinapi.com.br/sp): o preço da hora por ofício (`PRECO_HORA_SEED`), as
horas por unidade de cada serviço do cronograma (`PRODUTIVIDADE_SEED`, via a
`receita` de composições de cada serviço) e o preço de 14 materiais do
cadastro que nunca foram comprados (`insumos-seed-cadastro.jsx`, itens com
URL `…/sp/insumo/<código>` na observação). O SINAPI publica uma base por mês;
esta rotina traz a base nova para dentro do código, com trava de segurança e
relatório.

## Peças

- `scripts/atualizar-sinapi.mjs` — script determinístico, sem acesso à
  internet. `listar` diz o que coletar (códigos, URLs, receitas); `aplicar
  coleta.json` grava os valores novos nas sementes, gera
  `docs/referencia-orcamento/SINAPI-ATUALIZACAO-<mês>.md` e devolve o
  resumo. `--simular` só mostra; `--forcar` aplica variações acima da trava
  (preço > 25 %, horas > 30 %).
- `coleta.json` — o que foi lido das páginas (formato no cabeçalho do
  script). Fica versionado em `docs/referencia-orcamento/sinapi-coleta-<mês>.json`.
- Tarefa agendada no Claude ("Atualização mensal SINAPI") — todo dia 20, 9h:
  roda `listar` no computador, lê as páginas, monta a coleta, aplica, roda os
  testes, faz o commit e avisa o Renato para dar o push. O push é sempre
  manual.

## Por que o script não busca as páginas sozinho

Nem o shell do computador (VM sem rede) nem o do Claude na nuvem
(allowlist) alcançam o buscadorsinapi; só a leitura de páginas do Claude. Por
isso a coleta é feita pelo Claude e o script só aplica — e pode ser rodado à
mão com qualquer `coleta.json`, inclusive montado a partir das planilhas
oficiais da Caixa.

## Rodar à mão

```
cd C:\Users\renat\orbi
node scripts/atualizar-sinapi.mjs listar
node scripts/atualizar-sinapi.mjs aplicar docs\referencia-orcamento\sinapi-coleta-ago-2026.json --simular
node scripts/atualizar-sinapi.mjs aplicar docs\referencia-orcamento\sinapi-coleta-ago-2026.json
node cronograma-obra.test.mjs
node insumos.test.mjs
node combine.js
git add -A && git commit -m "SINAPI ago/2026: atualização mensal" && git push
```

## O que a trava segura

Variação de preço da hora acima de 25 % ou de horas acima de 30 % vai para
"Pendências" e não é gravada — quase sempre é leitura errada da página ou
composição substituída (404). Serviços com `receita: null` (conjuntos
hidráulicos 104660/104676, somados à mão a partir de 21 e 16
sub-composições) são sempre listados para conferência manual. Tudo que muda
fica no relatório com valor antigo, novo e variação.

## Depois da atualização

O cronograma passa a usar os valores novos no próximo cálculo. Os preços de
insumos só entram no catálogo do escritório em Insumos → Carregar catálogo
padrão; item já carregado mantém o preço dele (a semente não sobrescreve
edições).
