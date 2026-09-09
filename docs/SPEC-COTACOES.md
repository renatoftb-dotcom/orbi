# Cotações de fornecedores

Fica dentro da obra, ao lado de Contratos, Cronograma e Contas a pagar. O
escritório abre uma cotação, registra as propostas que recebeu, compara e
escolhe uma; o cliente aprova ou recusa no ambiente dele; o escritório lança
a escolhida em contas a pagar, e o valor entra no P&L pela conta da cotação.

## Onde os dados moram — e por que em dois campos

```
obra.cotacoes[]          escrito SÓ pelo escritório
obra.aprovacoesCotacao[] escrito SÓ pelo cliente
```

A separação é a garantia. O backend libera para o perfil cliente apenas uma
lista curta de campos no `POST /api/obras`
(`contasPagar`, `entradas`, `aceites`, `aprovacoesCotacao`); tudo o mais é
sobrescrito com o que já estava gravado. Se a decisão do cliente morasse
dentro de `obra.cotacoes`, liberar esse campo daria a ele o poder de trocar
valor, fornecedor e vencedor. É o mesmo desenho dos aceites de contrato.

## A cotação

```
{ id, obraId, criadaEm, titulo, escopo, contaId, etapaId, quantidade, unidade,
  prazoResposta, precisaAprovacaoCliente, status, escolhidaId, contaGeradaId,
  propostas: [{ id, fornecedorId, favorecido, valor, prazoDias,
                condicaoPagamento, validade, observacao, recebidaEm }] }
```

`contaId` é a conta do plano (obra-financeiro.jsx) — é ela que decide onde o
gasto cai no P&L quando a cotação virar conta a pagar.

## Situação — a ordem dos testes é a ordem do fluxo

cancelada → lançada → recusada → aprovada → aguardando propostas →
comparando propostas → aguardando o cliente → escolhida.

O primeiro que casar manda, e é isso que faz "lançada" continuar aparecendo
mesmo depois de o cliente ter aprovado.

## Trava do lançamento

`podeLancarCotacao` devolve `{ pode, motivo }` — a tela mostra o motivo ao
lado do botão em vez de só desabilitá-lo. Bloqueia sem escolha, com escolha
sem valor, com recusa do cliente, com aprovação pendente (quando exigida) e
quando já foi lançada.

## Ordenação das propostas

Da mais barata para a mais cara; proposta sem valor vai para o fim. Se fosse
para o começo, "mais barata" mentiria — uma proposta ainda não preenchida
apareceria como a melhor oferta.

## Economia

Comparada com a proposta mais cara recebida. Com uma proposta só devolve
`null` (comparar consigo mesma daria zero e ocuparia espaço à toa). O resumo
soma apenas a economia de cotações já aprovadas ou lançadas — antes disso
não há economia realizada.

## O ambiente do cliente

Não existe tela separada: a área do cliente reaproveita `GestaoObraPanel`
inteiro. Quem separa é `perm.podeGerenciarObra` — sem ele somem criar,
editar, escolher e lançar, e aparecem Aprovar e Recusar. **Toda tela nova no
painel da obra já nasce espelhada; o que precisa ser decidido é o que o
cliente NÃO pode fazer nela.**

## Armadilha ao gravar a obra

`obras` recebido pelas telas da obra é só a fatia do cliente atual. Fazer
`save({ ...data, obras: obras.map(...) })` apaga as obras dos outros
clientes — `saveAllData` compara as duas listas e manda `DELETE` no que
sumiu. Use sempre `mesclarPorCliente(data.obras, clienteId, fatia)`.
Cronograma e orçamento tinham esse bug e foram corrigidos junto.

## Anexo da proposta

O arquivo que o fornecedor mandou (PDF ou foto) é arrastado para o campo no
formulário da proposta e vai para o **Cloudinary**, o mesmo storage do logo e
da capa. A proposta guarda só a referência:

```
proposta.anexo = { url, public_id, nome, bytes, formato, resourceType, enviadoEm }
```

### Por que não guardar o arquivo dentro da obra

A obra é gravada como um documento JSON inteiro a cada `save`. Um PDF em
base64 ali dentro subiria de novo em toda alteração da obra e o app do
cliente o baixaria em toda abertura. A referência custa ~100 bytes.

### Por que não converter o PDF em imagem

Rasterizar engorda em vez de aliviar: um PDF de proposta é vetorial e
costuma ter 100–300 KB nas duas páginas; a mesma coisa em PNG legível dá
200–500 KB **por página**, e some o texto selecionável, o zoom e as páginas
seguintes. PDF sobe como está.

Foto é o caso oposto: câmera de celular manda 4–6 MB para fotografar um A4.
`comprimirImagem()` reduz para 1600px no maior lado e reencoda em JPEG 0.72
antes de enviar — na prática, de ~6 MB para ~60 KB. Se o resultado ficar
maior que o original (imagem já pequena ou já otimizada), fica com o
original.

### resource_type: PDF é 'raw', imagem é 'image'

Como `image`, o Cloudinary trata o PDF como documento rasterizável e a
entrega passa a depender da opção *Allow delivery of PDF and ZIP files* da
conta, que vem **desligada** — o link voltaria 401. Em `raw` o arquivo é
servido como está, sempre. Por isso `uploads_log` ganhou a coluna
`resource_type`: `cloudinary.uploader.destroy()` também precisa do tipo
certo, senão não acha o arquivo na hora de apagar.

### Permissões

Categoria `proposta_cotacao`, até 5 MB, 500 ativas por empresa. O cliente
**não** anexa: `POST /api/uploads` é escrita, e a lista branca de escrita
dele tem só `/obras`. Ele abre o arquivo pelo link, que é público — mesma
característica do logo e das imagens de projeto.

## Apagar: duas exclusões, com pesos diferentes

**Tirar um fornecedor** da comparação é correção de rotina — nome errado,
proposta duplicada, fornecedor que desistiu. Fica na própria linha da
tabela, ao lado de Editar, e é liberado para quem já gerencia a obra.
Se a proposta apagada era a **escolhida**, `removerProposta()` limpa também o
`escolhidaId`: manter o id apontaria para uma proposta que não existe mais e
o card diria "Escolhida" sem ninguém marcado. A confirmação avisa disso com
todas as letras, porque significa que o cliente vai ter que aprovar de novo.

**Apagar a cotação inteira** leva junto a decisão que o cliente registrou,
então é do admin (`podeExcluir`) e fica separado dos demais botões, no canto
do rodapé. `removerCotacao()` devolve as duas listas — cotações e aprovações
— porque uma decisão órfã em `obra.aprovacoesCotacao` voltaria a valer se um
dia outra cotação nascesse com o mesmo id. A confirmação diz o que vai
junto: quantas propostas e, se houver, a decisão do cliente.

As duas param no mesmo lugar: `podeExcluirCotacao()` recusa o que já tem
`contaGeradaId`. Do outro lado existe um lançamento em contas a pagar, e
apagar por aqui deixaria a conta sem origem — o caminho é cancelar a conta
primeiro. Na tela, os botões nem aparecem nesse estado, como já acontecia
com Escolher, Editar cotação e Lançar.

Os anexos das propostas apagadas voltam de `anexosDasPropostas()` e a tela
tenta removê-los do storage. É best-effort de propósito: apagar arquivo é
permissão de admin, o arquivo já não está mais em lugar nenhum da obra, e
uma recusa ali não pode travar a exclusão.

## Cadastrar o prestador na hora

O select de fornecedor da proposta abria com "— outro —". Escolher aquilo
significava desistir do cadastro: o nome ia no campo ao lado e ficava só
ali, sem CNPJ, sem contato, e sem servir de contratado quando o contrato
daquele serviço fosse gerado.

"— outro —" saiu. No lugar ficaram duas coisas diferentes:

- **"— nenhum —"** — o repouso do campo. Continua possível registrar uma
  proposta sem cadastrar ninguém, digitando o nome ao lado.
- **"＋ Cadastrar prestador"** — não é um fornecedor, é uma ação: abre o
  cadastro dentro da própria tela da proposta.

Os campos são **os mesmos do cadastro rápido do gerador de contratos** —
nome, pessoa, CNPJ/CPF, categoria, telefone, e-mail, endereço com ViaCEP e
representante legal para PJ. Quem cadastra pela cotação já serve de
contratado depois, sem redigitar.

Só o nome é obrigatório: exigir CNPJ na hora de lançar uma proposta
devolveria o usuário ao "outro" de antes. A categoria nasce **"Outro"**, e
não a primeira da lista — a primeira é "Carpinteiro", e sair dali com um
ofício que ninguém escolheu é pior que sair sem ofício, porque é por essa
categoria que o gerador de contratos filtra os contratados.

Ao salvar, o prestador entra em `data.fornecedores` com `ativo: true` e
`origem: "cotacao"`, e **já sai escolhido na proposta**, com o nome copiado
para "Nome que vai na conta" — é para isso que o usuário abriu o cadastro.

Duas travas pequenas: o select fica desabilitado enquanto o cadastro está
aberto (senão trocar de fornecedor no meio deixaria um formulário órfão na
tela), e salvar a proposta com o cadastro aberto avisa em vez de jogar fora
o que já foi digitado nele.

## O anexo abre numa janela, não baixa

Clicar no anexo abria a URL do storage numa aba e o navegador **baixava** o
arquivo. Pior: baixava sem extensão — um `a3f9c1d2e8b4` de 154 KB que o
Windows não sabe abrir, embora fosse um PDF íntegro.

Duas causas, duas correções.

**A causa no storage.** Arquivo `raw` no Cloudinary é entregue pelo nome, e o
nome é o `public_id`. Com `unique_filename` o Cloudinary gerava um id
aleatório sem extensão, e servia o PDF como `application/octet-stream`. O
upload passou a acrescentar `.pdf` ao id (que segue aleatório — o nome do
fornecedor pode ter acento, espaço e barra). Vale só para anexos novos: o
`public_id` é o próprio nome do arquivo no storage, então o que já subiu não
muda.

**A causa na tela**, e é ela que conserta também o que já subiu. O anexo
agora abre em `VisorProposta`, uma janela sobre a tela com o PDF dentro. O
arquivo é buscado e **reembalado num Blob com `application/pdf`** antes de ir
para o `<iframe>`. Parece rodeio, mas é o que torna o visor independente do
cabeçalho que o storage manda: anexo antigo, servido como octet-stream, abre
igual — sem reanexar.

Três camadas, da melhor para a pior:

1. **Blob** — o caminho normal. Funciona para anexo novo e antigo.
2. **URL direta no iframe** — se o `fetch` falhar por CORS. Para os anexos
   novos, que terminam em `.pdf`, o navegador abre inteiro; aparece um aviso
   discreto no rodapé da janela.
3. **Baixar** — se nem isso, a janela explica que o arquivo está inteiro e
   oferece o download.

Com o arquivo reembalado, o botão "Baixar" usa o blob com `download={nome}`:
o anexo antigo, que chegava sem extensão, agora salva como
"Proposta Rossito.pdf".

Imagem não passa por nada disso — vai direto num `<img>`. A janela fecha com
Esc, com o botão Fechar ou clicando fora, e o blob é revogado ao fechar para
não segurar o arquivo na memória da aba.

### A janela diz o que há de errado

Um iframe vazio não informa nada: o usuário não sabe se o problema é o
arquivo, a internet ou o sistema. Antes de montar o visor, a janela confere
o que veio e explica:

| o que veio | o que a janela diz |
|---|---|
| 404 no storage | "O arquivo não está mais no storage. Anexe a proposta de novo." |
| outro status | "O storage respondeu \<n\> ao buscar o arquivo." |
| menos de 1 KB e não é PDF | "O arquivo tem só \<n\> bytes e não é um PDF — o upload deve ter falhado pela metade." |
| não começa com `%PDF-` | "O arquivo anexado não é um PDF válido… tente anexar o PDF original, sem comprimir." |

`pareceMesmoPdf(bytes)` olha os cinco primeiros bytes. A validação do upload
confere o **mimetype**, que o navegador deduz da extensão — então página de
erro de compressor online, zip renomeado e arquivo cortado no meio do upload
passam por ela e só aparecem aqui.

Um PDF que começa certo mas está truncado passa nesta checagem e cai no
visor do navegador; cinco bytes não têm como saber. A mensagem cobre o caso
comum, não todos.
