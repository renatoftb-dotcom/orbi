# SPEC — Contratos de obra (gerador e documento)

Dentro da obra do cliente, a aba **Contratos** deixa de ser só um cadastro:
gera o contrato inteiro, guarda com valor e status, e reabre para leitura e
impressão. O CONTRATANTE é sempre **o cliente da obra** (é ele quem contrata
o prestador; o escritório redige). O CONTRATADO vem do cadastro de
**Prestadores** (`data.fornecedores`), que já tem CNPJ/CPF, endereço,
representante e CPF do representante.

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
- `objeto` — o subtítulo já escrito, ainda editável. Trocar o tipo só
  sobrescreve o objeto se ele ainda estiver no texto sugerido pelo tipo
  anterior.

`CATEGORIAS_PRESTADOR` (cadastro de Prestadores, `outros.jsx`) foi alinhada a
essa lista. Contratos gravados antes desta versão ficam com
`tipoProfissional: ""` e continuam abrindo normalmente.

## Formulário único

O gerador é o **mesmo para qualquer prestador**: escolher Empreiteiro ou
Serralheiro muda o texto do contrato, nunca os campos da tela. Todo contrato
tem valor total, itens discriminados (opcionais — havendo itens com valor, o
total é a soma deles e o campo de valor total trava), descritivo do ANEXO I
(opcional), modalidade de pagamento, prazo e a lista de cláusulas marcáveis.

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

## Data de assinatura

`dataAssinatura` nasce com a data do dia e é editável no gerador. O fecho do
contrato sai como "Ourinhos/SP, 7 de setembro de 2026." (`dataExtensoCtr`, que
lê a string ISO na mão para não escorregar de dia por fuso). Em branco, volta
a lacuna para preencher à caneta.

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
