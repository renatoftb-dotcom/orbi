# SPEC — Contratos de obra (gerador e documento)

Dentro da obra do cliente, a aba **Contratos** deixa de ser só um cadastro:
gera o contrato inteiro, guarda com valor e status, e reabre para leitura e
impressão. O CONTRATANTE é sempre **o cliente da obra** (é ele quem contrata
o prestador; o escritório redige). O CONTRATADO vem do cadastro de
**Prestadores** (`data.fornecedores`), que já tem CNPJ/CPF, endereço,
representante e CPF do representante.

O cadastro do cliente tem **Representante legal** (nome + CPF), logo abaixo
dos dados principais: é quem assina pelo cliente, e sai no preâmbulo ("neste
ato representada por …") e sob a linha de assinatura. Em branco, o contrato
sai só com o nome da parte — nenhum contato da agenda entra no lugar dele.

## Tipo de profissional (primeira escolha)

O gerador começa pelo **tipo de profissional**, não pelo modelo. A lista
(`TIPOS_PROFISSIONAL`) espelha os prestadores de serviço do catálogo de
insumos (grupo *Prestadores de serviços*, códigos `PRE-001`…`PRE-017`) — é
por eles que a obra é orçada, então é por eles que ela é contratada:

Em ordem alfabética, com *Outro* fechando a lista: Carpinteiro ·
Eletricista · Empreiteiro · Encanador · Gesseiro · Gestão de obra ·
Impermeabilizador · Instalador de aquecedores · Instalador de ar
condicionado · Instalador de equipamentos de piscina · Marceneiro · Pintor ·
Serralheiro · Terraplanagem · Outro.

Cada tipo carrega três coisas:

- `categorias` — como o prestador aparece no cadastro (`fornecedor.categoria`).
  O select de contratado mostra **só** os prestadores dessas categorias
  (`prestadoresDoTipo`): escolhido Encanador, quem não é encanador não
  aparece, e se não houver nenhum cadastrado a lista sai vazia e o caminho é
  ＋ Novo. Serralheiro puxa também *Esquadria de Alumínio*; Empreiteiro puxa
  também *Pedreiro*; o tipo *Outro*, sem categoria, mostra todos.
- `modelo` — o regime que costuma valer para o ofício. Quem só põe mão de
  obra (empreiteiro, eletricista, pintor, carpinteiro, encanador, gestão)
  nasce em `empreitadaMaoDeObra`; quem fornece material (serralheiro,
  marceneiro, impermeabilizador, instaladores, terraplanagem) nasce em
  `empreitadaGlobal`. O usuário pode trocar depois — o tipo sugere, não trava.
- `servico` — o nome do ofício ("serralheria", "instalações elétricas",
  "obra civil"), que escreve o objeto e batiza o contrato.

`CATEGORIAS_PRESTADOR` (cadastro de Prestadores, `outros.jsx`) foi alinhada a
essa lista. Contratos gravados antes desta versão ficam com
`tipoProfissional: ""` e continuam abrindo normalmente.

## O objeto, genérico para qualquer prestador

O objeto sai de dois campos, com o mesmo racional para todo ofício: o **tipo
de profissional** e **o que o contrato inclui** (`ESCOPOS_FORNECIMENTO`):

| escopo | texto | regime |
| --- | --- | --- |
| `ambos` | *Fornecimento de serviços de **serralheria** incluindo mão de obra e fornecimento de material* | empreitada global |
| `maoDeObra` | *… incluindo somente a mão de obra, sendo o material fornecido pelo CONTRATANTE* | empreitada de mão de obra |
| `material` | *… incluindo somente o fornecimento de material, sem mão de obra* | fornecimento |

`objetoPadrao(tipo, escopo)` monta a frase; o campo continua editável e, uma
vez editado à mão, deixa de ser reescrito quando o tipo muda (há um "Voltar
ao padrão"). O escopo é quem decide o modelo por baixo — por isso o antigo
select de "Modelo do contrato" virou **"O que o contrato inclui"**.

O nome do contrato acompanha: *Contrato de Prestação de Serviços de
Serralheria*, de *Instalações Elétricas*, de *Obra Civil* — e, no tipo
"Outro", só *Contrato de Prestação de Serviços*. A cláusula 1.1 é a mesma
para todos ("tem por objeto a prestação, pela CONTRATADA, dos serviços a
seguir descritos: …"), e a cláusula do regime muda conforme o escopo. Nada
disso é mais específico de serralheria, como era antes.

Contratos gravados antes do campo herdam o escopo do modelo
(`escopoContrato`).

## Formulário único

O gerador é o **mesmo para qualquer prestador**: escolher Empreiteiro ou
Serralheiro muda o texto do contrato, nunca os campos da tela. Todo contrato
tem valor total, itens discriminados (opcionais — havendo itens com valor, o
total é a soma deles e o campo de valor total trava), descritivo do ANEXO I
(opcional), modalidade de pagamento, prazo e a lista de cláusulas marcáveis.

### Quando vence a primeira parcela

Todo contrato tem **Primeiro vencimento** (opcional) ao lado do nº de parcelas.
Em branco, a primeira parcela conta da âncora — início previsto, ou a
assinatura — como sempre foi. Preenchido, é ele que manda: serve para
registrar contrato que **já vinha sendo pago** antes de entrar no sistema. As
parcelas anteriores nascem em contas a pagar, aparecem como vencidas e se
marca lá o que já foi quitado.

O texto do contrato acompanha: com a data informada sai "A primeira parcela
vence em 10/08/2026 e as demais no mesmo dia dos meses subsequentes"; sem ela,
a frase padrão da periodicidade.

Nas mensais sem data informada, o **dia de vencimento** (o "todo dia 05" do
gerenciamento) passa a ancorar de verdade as parcelas: a primeira cai no dia
05 seguinte à âncora e as demais no dia 05 dos meses seguintes. Antes as
mensais andavam de 30 em 30 dias e o dia escrito no contrato não valia para
contas a pagar.

No pagamento **entrada + saldo no final** há **Previsão de conclusão** (e, no
modo item a item, duas colunas por item: **Início**, que é quando vence a
entrada daquele item, e **Previsão de conclusão**, quando vence o saldo). É data de estimativa, não
de vencimento: em contas a pagar a parcela aparece marcada como *estimada* e
com "prevista" sob a data. Em branco, vale o fim do prazo de execução.

### Semanal e quinzenal são pagamentos de um dia da semana

A periodicidade diz o que é, no próprio rótulo do gerador:

| opção | o que significa |
| --- | --- |
| Semanal — toda semana, no mesmo dia | 7 dias, sempre no dia escolhido |
| Quinzenal — um dia sim, outro não (14 dias) | sextas alternadas, a praxe do empreiteiro |
| Quinzenal — a cada 15 dias corridos | data fixa, caindo em qualquer dia da semana |
| Mensal — dia fixo do mês | o "todo dia 05" |

`pagaEmDiaDaSemana()` separa as duas famílias: **semanal** e **quinzenal de
14 dias** pagam num dia da semana (têm "Dia do pagamento" e antecipação em
feriado); **15 dias corridos** e **mensal** fecham por data — a cláusula sai
"a cada 15 (quinze) dias subsequentes, em data fixa, independentemente do dia
da semana", sem a frase de feriado.

Ao lado, **Dia do pagamento** (segunda a sexta, sexta por padrão) — o mesmo
mecanismo serve para quem paga na segunda. A cláusula sai com o dia escrito:
"Os pagamentos serão realizados sempre às **segundas-feiras**, em quinzenas
alternadas — uma segunda-feira sim, outra não —, vencendo-se a primeira
parcela na **2ª segunda-feira** posterior ao início dos serviços e as demais a
cada 14 (quatorze) dias subsequentes." (o ordinal em numeral evita a gagueira
de "na segunda segunda-feira").

E a caixa **Antecipar quando cair em feriado**, ligada por padrão, acrescenta:
"Recaindo o vencimento em feriado, o pagamento será antecipado para o dia útil
imediatamente anterior."

### Forma de pagamento: a mesma para todo contrato de serviço

O bloco **Modalidade de pagamento** — parcelado, por medição, entrada +
parcelas, entrada + saldo no final — vale para **todos** os contratos de
prestação de serviço, gestão de obra inclusive, junto com a condição de
pagamento (PIX, boleto, …). O gerenciamento deixou de ser sempre "parcelado
mensal": a cláusula VALORES E FORMA DE PAGAMENTO é escrita conforme a
modalidade escolhida, na voz do modelo do escritório, e as contas a pagar
seguem a mesma escolha.

No gerenciamento continuam próprios apenas os campos do modelo do escritório:
referência da obra, locadora preferida, dias de interrupção que rescindem, e
multa/juros/honorários. O valor é um só (sem itens discriminados) e o
descritivo e as cláusulas marcáveis seguem escondidos — o modelo já os traz.

### O próprio escritório como contratado

A gestão da obra costuma ser do escritório. Ele aparece **no topo da lista de
contratados**, pelo próprio nome, sempre que o tipo escolhido for compatível
— Gestão de obra, pela categoria. Sem marcação de "meu escritório": este
módulo será aberto ao cliente, e para ele o escritório é um contratado como
qualquer outro. Não é preciso cadastrá-lo como
prestador: `prestadorDoEscritorio(data.escritorio)` monta o contratado a
partir do cadastro do escritório, então corrigir um dado lá corrige os
contratos.

O que o cadastro do escritório fornece: **nome** → razão social, **CNPJ**,
**endereço + cidade/UF + CEP** → sede (o cadastro guarda o logradouro numa
linha só, com o número junto), e o primeiro **responsável técnico** → nome,
CPF e CAU do representante, que sai no preâmbulo ("neste ato representada por
LEONARDO PADOVAN, inscrito no CPF sob o nº …, CAU nº …"). Faltando algo,
`faltaNoEscritorio()` lista os campos e o gerador avisa antes de gerar.

Esse aviso é **editável no próprio gerador**: escolhido o escritório como
contratado, o cartão traz "Completar aqui" (ou "Editar aqui", se nada falta) e
abre os campos — razão social, CNPJ, endereço com número, cidade/UF, CEP e o
responsável técnico (nome, CPF, CAU). "Salvar no cadastro" grava em
`data.escritorio` (preservando os demais responsáveis e o resto do cadastro), e
o contrato passa a sair qualificado sem sair da tela. Um cadastro só com nome e
cidade produzia o preâmbulo truncado "PADOVAN ARQUITETOS, sediada na
Ourinhos/SP." — era falta de dado, não de código. `prestadorDoEscritorio()`
também aceita as chaves de cadastros antigos (`cnpjCpf`/`documento` e
`logradouro`/`numero`/`bairro`).

No passo do prestador há **＋ Novo**, que abre o cadastro rápido dentro do
próprio gerador — nome, PJ/PF, CNPJ/CPF, categoria (já vem a do tipo
escolhido), endereço com ViaCEP e representante legal, exatamente os dados
que o preâmbulo usa. Ao salvar, o prestador entra em `data.fornecedores` e já
fica selecionado. A lista de prestadores mostra só o nome — a categoria não
aparece mais colada nele.

## Modalidade de pagamento

`MODALIDADES_PAGAMENTO`, escolhida por rádio no gerador:

| id | O que escreve | Campos |
| --- | --- | --- |
| `parcelado` | valor total dividido em parcelas iguais e sucessivas | nº de parcelas, periodicidade |
| `medicao` | apuração periódica do executado e pagamento do percentual medido | periodicidade da medição, prazo de pagamento após a aprovação |
| `entradaParcelas` | entrada em % na assinatura e o saldo parcelado | entrada %, nº de parcelas, periodicidade |
| `entradaFinal` | entrada em % e o restante na conclusão | entrada %, saldo do contrato todo ou item a item |

Periodicidade aceita **semanal, quinzenal e mensal**, cada uma com a sua
regra de vencimento. `entradaFinal` + *item a item* é o pagamento 50/50 dos
contratos de fornecimento e monta o quadro de parcelas; sem itens com valor
ele cai para entrada + saldo no final. Contratos gravados antes disso caem no
comportamento antigo do seu modelo (`modalidadeContrato`).

## Condição de pagamento

`MEIOS_PAGAMENTO` — como o dinheiro sai: **PIX ou transferência** (padrão),
PIX, transferência bancária, boleto, cheque, dinheiro ou cartão. Cada um tem
a sua frase na cláusula de pagamento, com o gênero do contratado ajustado
("em conta de titularidade **do CONTRATADO**" / "**da CONTRATADA**").

No gerenciamento de obra o padrão é **boleto**, e a condição muda a frase do
vencimento: "Serão gerados boletos com vencimento todo dia 05 de cada mês" ou
"Os pagamentos serão feitos por PIX, com vencimento todo dia 05 de cada mês".

## Prazo

Nada vem pré-preenchido: o usuário digita o número e escolhe **dias corridos
ou meses** (`prazoQtd` + `prazoUnidade`). Em branco, o contrato sai com a
lacuna `______` para preencher à mão. Contratos antigos migram de
`prazoDias`/`prazoMeses` por `prazoContrato()`.

## Cláusulas marcáveis

`CONTRATO_OPCOES` — cada uma entra ou sai do contrato por um checkbox, e as
que pedem número trazem o campo junto:

multa por atraso (% ao dia + teto) · tolerância no atraso (dias) · garantia
(meses) · retenção de garantia (% ou a última parcela) · fornecer ART/RRT ·
contratado fornece ferramentas (só as básicas ou todas) · contratado fornece
todos os equipamentos · fornecer EPI · seguro de responsabilidade civil ·
remoção de entulho · responder por danos · proibir subcontratação · emitir
nota fiscal · relatório de avanço (semanal/quinzenal/mensal) · alimentação,
transporte e alojamento · água e energia por conta do contratante · preço
fixo e irreajustável.

Duas delas — *ferramentas* e *equipamentos* — trazem um botão discreto
**Especificar**, que abre um campo livre para listar quais. O texto entra na
própria cláusula do regime: nas ferramentas como "Consideram-se ferramentas
básicas, para os fins deste contrato, entre outras: …" (ou "Compreendem-se,
entre outras: …" quando são todas); nos equipamentos, a lista digitada
substitui os exemplos padrão. Em branco, o botão fica lá e o texto padrão
segue intacto.

As cláusulas são **numeradas na montagem, não na mão**: o texto é escrito sem
número e `montarContrato` numera no final, resolvendo `{{cl:id}}` para
"Cláusula Quarta" e `{{it:marca}}` para "1.3". Assim uma opção pode sair sem
desalinhar o resto nem quebrar uma referência cruzada. Só a garantia remove
uma cláusula inteira; as demais entram como itens das cláusulas existentes.

## Campos numéricos

Todo campo de número usa `CampoCtrNum`, que formata enquanto se digita — os
dígitos entram pela direita, como no aplicativo do banco: moeda vira
`9.142,86`, percentual vira `0,50%`, inteiro vira `1.200`. O contrato guarda
sempre o número puro. Apagar o `%` ou a vírgula apaga um dígito de verdade
(`digitandoNumero`), senão o campo pareceria travado.

## Endereço da obra

O cadastro da obra (Gestão de Obra → nova/editar obra) tem a marcação
**Endereço do cliente** / **Endereço diferente**:

- *Endereço do cliente* (padrão) — a obra não guarda endereço; o contrato usa
  o endereço do cadastro do cliente. A tela mostra qual é.
- *Endereço diferente* — abre CEP (com ViaCEP), logradouro, número,
  complemento, bairro, cidade e UF na própria obra.

`enderecoDaObra(obra, cliente)` resolve nessa ordem, e `montarContrato` a usa
como padrão. O campo *Endereço da obra* do gerador continua existindo e vence
tudo quando preenchido — em branco, ele mostra como placeholder o endereço
que será usado. Obras cadastradas antes da marcação mantêm o endereço que
tiverem.

## Modelos

São três. `gerenciamentoObra` é escolhido automaticamente pelo tipo **Gestão
de obra** (o tipo traz `modeloFixo`, que vence o escopo); os outros dois saem
do escopo escolhido.

### Gerenciamento de obra

Reproduz o contrato de gerenciamento do escritório, cláusula por cláusula:
objeto, referência da obra, a descrição do serviço em oito itens (mão de
obra, materiais, locação de equipamentos, prestação de contas,
operacionalização dos pagamentos, autorização prévia, pagamentos dos insumos
e vínculo empregatício), valores e forma de pagamento, despesas não
contempladas, prazo de validade, rescisão por inadimplência e por
interrupção, regência e fecho com o foro.

O texto é fixo; o gerador pede só o que muda: **referência da obra**, **valor
total**, **nº de parcelas**, **dia do boleto**, **locadora de equipamentos
preferida** (em branco, a cláusula não cita nenhuma), **dias de interrupção
que rescindem**, **multa por inadimplência**, **juros ao mês** e **honorários
advocatícios**. Blocos que não valem para ele — modalidade de pagamento,
itens, cláusulas marcáveis, exclusões e ANEXO I — somem da tela.

Diferenças de forma, declaradas no próprio modelo: título próprio
(`titulo`), numeração "1 OBJETO DO CONTRATO" em vez de "CLÁUSULA PRIMEIRA"
(`numeracao: "simples"`, com cláusula de item único saindo como parágrafo
corrido), preâmbulo curto com as duas partes qualificadas em uma linha cada
(`preambuloSimples`) e fecho próprio na última cláusula (`fechoProprio`, que
suprime o "E, por estarem assim justas e contratadas"). O gênero do
contratado passa a vir do modelo (`generoContratado`), não do regime — por
isso o escritório é "a CONTRATADA" mesmo sem fornecer material.

### Empreitadas

Tirados de dois contratos reais do escritório (COBOP, set/2026):

| | `empreitadaMaoDeObra` | `empreitadaGlobal` |
| --- | --- | --- |
| Material | do CONTRATANTE | da CONTRATADA |
| Objeto | ANEXO I descritivo, em blocos | tabela de itens com valor cada |
| Preço | valor total digitado | soma dos itens |
| Pagamento | parcelas quinzenais ou mensais, última retida como garantia | 50% na liberação do item + saldo na conclusão daquele item |
| Prazo | meses, a partir da data de início | dias corridos, a partir da liberação da obra |
| Garantia | 6 meses do aceite final | 12 meses da conclusão de cada item |

Ambos trazem as cláusulas de regime, obrigações das duas partes, serviços
extraordinários, atraso (tolerância de 45 dias antes da multa de 0,5% ao dia,
teto de 10%), rescisão, ausência de vínculo, disposições gerais e foro, mais
assinaturas e duas testemunhas.

## Como funciona

`montarContrato(contrato, { cliente, obra, prestador })` devolve a estrutura
do documento — preâmbulo, cláusulas, tabelas e anexo — e `ContratoDocumento`
só desenha. O texto **não é congelado**: o documento é remontado a cada
abertura, então corrigir o CNPJ do prestador ou o endereço do cliente
atualiza os contratos daquele cliente.

O registro fica em `data.contratos` com `gerado: true`, ao lado dos contratos
que eram só cadastro (esses continuam abrindo no formulário antigo). Campos:
modelo, prestadorId, objeto, endereço da obra, exclusões, itens ou escopo,
valor, prazo, parcelas, garantia, status e datas.

Detalhes que vieram dos contratos reais e estão cobertos por teste
(`contratos-obra.test.mjs`):

- **Parcelas**: arredonda ao centavo e joga a diferença na última —
  128.000 em 14 vezes dá 13 × 9.142,86 + 9.142,82, exatamente como no
  contrato assinado.
- **Valor por extenso**: "e" antes da última parcela só quando ela é menor
  que cem ou centena redonda — 9.142 é "nove mil, cento e quarenta e dois".
- **Concordância**: CONTRATADO/CONTRATADA conforme o modelo, com contração
  no objeto indireto ("pagará ao CONTRATADO" / "pagará à CONTRATADA").
- **Pessoa física** troca CNPJ por CPF, "com sede" por "residente e
  domiciliado" e não leva representante.

## Exclusões do objeto

O campo aceita as duas formas de escrever, sem duplicar a abertura: começando
em **minúscula** ("o lixamento do concreto e …"), o contrato monta "Não
integram o objeto deste contrato: …"; começando em **maiúscula** ("Não
integra o objeto deste contrato a revisão da estrutura existente."), o texto
entra como está. O ponto final é garantido uma vez só.

## Data de assinatura

`dataAssinatura` nasce com a data do dia e é editável no gerador. O fecho do
contrato sai como "Ourinhos/SP, 7 de setembro de 2026." (`dataExtensoCtr`, que
lê a string ISO na mão para não escorregar de dia por fuso). Em branco, volta
a lacuna para preencher à caneta.

## Contas a pagar

Salvar o contrato gera, na mesma gravação, as contas a pagar da obra — uma
por parcela da modalidade escolhida. Ver `SPEC-CONTAS-PAGAR.md`.

## Salvar e gerar PDF

São dois botões separados no gerador:

- **Salvar** grava o contrato e continua na tela (mostra "✓ Salvo" por alguns
  segundos), para continuar editando. O contrato fica registrado na obra e
  pode ser reaberto depois; `geradoEm` é preservado e `atualizadoEm` marca a
  última gravação.
- **Gerar PDF** salva e abre o documento já mandando imprimir.
- **Ver contrato** aparece depois da primeira gravação, e **Voltar** sai sem
  gravar.

### Onde o contrato é gravado

O contrato mora **dentro da obra** (`obra.contratos`), ao lado da estimativa.
Motivo: `saveAllData` grava clientes, fornecedores, orçamentos, receitas,
obras, lançamentos, materiais e escritório — `data.contratos` nunca esteve
nessa lista, então o contrato só existia na memória da aba e sumia no
reload. A obra, por sua vez, é gravada como documento JSON (`obras.dados`),
e leva junto o que estiver dentro dela.

`contratosDasObras(obras, clienteId)` lê e `contratosNasObras(obras,
contratos, clienteId, obraPadraoId)` grava. O que tiver sobrado em
`data.contratos` de versões anteriores é migrado para dentro da obra na
primeira renderização em que der.

Duas armadilhas cobertas: gravações da obra que partem de uma cópia antiga
(`obraSelecionada`, `formObra`) preservam explicitamente `contratos` e
`estimativaPL` do registro fresco, senão apagariam o que foi salvo desde que
a cópia foi feita; e `data.obras` guarda as obras de **todos** os clientes,
enquanto o painel trabalha com a fatia de um só — por isso toda escrita passa
por `mesclarPorCliente(colecao, clienteId, fatia)`, que devolve os registros
dos outros clientes acrescidos da fatia nova.

## Impressão

Ao imprimir, `ContratoDocumento` move o próprio nó para dentro do `body`
(eventos `beforeprint`/`afterprint`) e marca `body[data-vk-imprimindo]`.
Dentro dos painéis do app o documento herdava largura e recortes dos
contêineres e saía com o texto cortado nas laterais da folha; solto no body
ele imprime como bloco estático e respeita a margem de `@page` (A4, 18mm ×
16mm). Navegadores sem `beforeprint` caem no recurso antigo (visibilidade +
posicionamento absoluto). As linhas de tabela não se partem entre páginas.

As tabelas (itens do objeto e quadro de parcelas) são desenhadas **logo abaixo
do item que as anuncia** — `tabelaItensApos` / `tabelaParcelasApos` guardam o
índice desse item —, de modo que o quadro fique entre o 1.3 e o 1.4, e não
depois das exclusões.
