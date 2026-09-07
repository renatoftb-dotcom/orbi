# SPEC — Contratos de obra (gerador e documento)

Dentro da obra do cliente, a aba **Contratos** deixa de ser só um cadastro:
gera o contrato inteiro, guarda com valor e status, e reabre para leitura e
impressão. O CONTRATANTE é sempre **o cliente da obra** (é ele quem contrata
o prestador; o escritório redige). O CONTRATADO vem do cadastro de
**Prestadores** (`data.fornecedores`), que já tem CNPJ/CPF, endereço,
representante e CPF do representante.

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

## Impressão

A tela do contrato injeta um `@media print` que esconde o app e deixa só o
documento, em A4 com margens de 18/16 mm. O botão "Imprimir / salvar PDF"
chama `window.print()` — no navegador, "Salvar como PDF" resolve. Se depois
for preciso o PDF pelo mesmo motor das propostas (Puppeteer), o
`montarContrato` já entrega a estrutura pronta para uma rota de render.
