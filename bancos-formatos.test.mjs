// Formatos de extrato e de fatura de cartão de vários bancos — node puro.
//   node bancos-formatos.test.mjs
//
// Cada arquivo abaixo imita o que o banco exporta (cabeçalho, separador,
// linhas antes da tabela, sinal, parcela). Os nomes e valores são fictícios.
// "conferido": o formato saiu de um arquivo real (do usuário ou de projeto
// público que o testou com arquivo real). "referência": montado pelo que se
// sabe do formato, ainda sem arquivo real — quando chegar um, troca aqui.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const raiz = dirname(fileURLToPath(import.meta.url));
const arquivo = readFileSync(join(raiz, "src", "modules", "escritorio-financeiro.jsx"), "utf8");
const src = arquivo.slice(0, arquivo.indexOf("// UI — daqui para baixo"));
const M = new Function(src + `
  return { efTabelaDoArquivo, detectarColunasTabela, movimentosDaTabela, efCabecalhoDeCartao, efPareceFatura, movimentosDoCartao, efCentavos, colunasParaEscolher, efData };`)();

const soma = (l) => M.efCentavos(l.reduce((t, m) => t + Number(m.valor), 0));
async function ler(nome, texto) { return M.efTabelaDoArquivo({ name: nome, text: async () => texto }); }
async function extrato(nome, texto) {
  const t = await ler(nome, texto);
  assert.ok(M.efCabecalhoDeCartao(t.linhas) < 0 && !M.efPareceFatura(t.linhas), "leu como fatura");
  const mapa = M.detectarColunasTabela(t.linhas);
  assert.ok(mapa.completo, "não achou data e valor");
  return M.movimentosDaTabela(t.linhas, mapa).filter((m) => Number(m.valor) && !/^saldo|^s a l d o|^total/i.test(String(m.historico || "").trim()));
}
async function fatura(nome, texto) {
  const t = await ler(nome, texto);
  assert.ok(M.efCabecalhoDeCartao(t.linhas) >= 0 || M.efPareceFatura(t.linhas), "não reconheceu como fatura");
  const r = M.movimentosDoCartao(t.linhas, { forcar: true, hoje: "2026-10-29" });
  assert.ok(!r.erro, r.erro);
  return r;
}

const EXTRATOS = [
  { banco: "Inter", fonte: "conferido", nome: "Extrato-01-09-2026-a-30-09-2026.csv", n: 3, total: 1445, texto:
`Extrato Conta Corrente 
Conta ;313652376
Período ;01/09/2026 a 30/09/2026
Saldo ;485,59

Data Lançamento;Histórico;Descrição;Valor;Saldo
30/09/2026;Compra no débito;Mercado Exemplo;-1,00;485,59
29/09/2026;Pix recebido;Cliente Exemplo;1.528,00;486,59
28/09/2026;Pix enviado ;Fornecedor Exemplo;-82,00;-1.041,41
` },
  { banco: "Nubank (conta)", fonte: "conferido", nome: "NU_123456_01SET2026_30SET2026.csv", n: 2, total: 954.1, texto:
`Data,Valor,Identificador,Descrição
01/09/2026,-45.90,6510a1b2-0000-0000-0000-000000000001,Transferência enviada pelo Pix - Loja Exemplo
05/09/2026,1000.00,6510a1b2-0000-0000-0000-000000000002,Transferência recebida pelo Pix - Cliente Exemplo
10/09/2026,0.00,6510a1b2-0000-0000-0000-000000000003,Ajuste
` },
  { banco: "Cora", fonte: "conferido", nome: "extrato-cora.csv", n: 3, total: -1625.52, texto:
`Data,Transação,Tipo Transação,Identificação,Valor
15/09/2026,Pagamento da fatura,DÉBITO,Cora SCFI,-2500.00
14/09/2026,Transf Pix recebida,CRÉDITO,Cliente Exemplo,624.48
09/09/2026,Pagamento recebido,CRÉDITO,Cliente Dois,250.00
` },
  { banco: "Banco do Brasil (novo)", fonte: "conferido", nome: "extrato.csv", n: 2, total: 750, texto:
`"Data","Lançamento","Detalhes","Nº documento","Valor","Tipo Lançamento"
"01/09/2026","Saldo Anterior","","","5.000,00",""
"18/09/2026","Pix - Recebido","CLIENTE EXEMPLO","123","1.000,00","Entrada"
"19/09/2026","Pagamento de Boleto","LOJA EXEMPLO","456","250,00","Saída"
"30/09/2026","S A L D O","","","5.750,00",""
` },
  { banco: "Banco do Brasil (antigo)", fonte: "referência", nome: "Extrato conta corrente - 092026.csv", n: 2, total: 850, texto:
`"Data","Dependencia Origem","Histórico","Data do Balancete","Número do documento","Valor",
"01/09/2026","","Saldo Anterior","","0","5000.00",
"03/09/2026","","Pix - Enviado","","1","-150.00",
"05/09/2026","","Pix - Recebido","","2","1000.00",
"30/09/2026","","S A L D O","","0","5850.00",
` },
  { banco: "Bradesco", fonte: "referência", nome: "Bradesco_30092026.csv", n: 3, total: 1299.5, texto:
`Extrato de: Agência: 1234 | Conta: 12345-6
Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)
01/09/2026;SALDO ANTERIOR;;;;2.000,00
02/09/2026;TRANSFERENCIA PIX REM: CLIENTE EXEMPLO;1234567;1.500,00;;3.500,00
03/09/2026;TARIFA BANCARIA CESTA;0;;40,50;3.459,50
04/09/2026;PAGTO ELETRON COBRANCA LOJA;2345;;160,00;3.299,50
;Total;;1.500,00;200,50;
` },
  { banco: "Itaú", fonte: "referência", nome: "extrato-itau.csv", n: 3, total: 650, texto:
`01/09/2026;PIX TRANSF CLIENTE01/09;1.000,00
02/09/2026;TAR PACOTE ITAU;-50,00
05/09/2026;BOLETO PAGO LOJA EXEMPLO;-300,00
` },
  { banco: "Santander", fonte: "referência", nome: "extrato-santander.csv", n: 2, total: 820, texto:
`Conta Corrente: 1234 01.012345.6
Data;Descrição;Docto;Situação;Crédito (R$);Débito (R$);Saldo (R$)
01/09/2026;PIX RECEBIDO CLIENTE EXEMPLO;000001;;1.000,00;;3.000,00
02/09/2026;PAGAMENTO DE BOLETO LOJA;000002;;;180,00;2.820,00
` },
  { banco: "Caixa", fonte: "referência", nome: "extrato-caixa.csv", n: 2, total: 875.6, texto:
`"Conta";"Data_Mov";"Nr_Doc";"Historico";"Valor";"Deb_Cred"
"0001.001.00001234-5";"20260901";"000001";"SALDO DIA";"2000.00";"C"
"0001.001.00001234-5";"20260902";"000002";"CRED PIX CLIENTE";"1000.00";"C"
"0001.001.00001234-5";"20260903";"000003";"DEB TARIFA";"124.40";"D"
` },
  { banco: "Sicredi", fonte: "referência", nome: "extrato-sicredi.csv", n: 2, total: 700, texto:
`Associado: EMPRESA EXEMPLO
Cooperativa: 0101 Conta: 12345-6
Data;Descrição;Documento;Valor (R$);Saldo (R$)
01/09/2026;RECEBIMENTO PIX CLIENTE EXEMPLO;PIX001;1.000,00;3.000,00
03/09/2026;LIQUIDACAO BOLETO LOJA;BOL002;-300,00;2.700,00
` },
  { banco: "C6 (conta)", fonte: "referência", nome: "01K0000_extrato_c6.csv", n: 2, total: 789.1, texto:
`Data Lançamento,Data Contábil,Título,Descrição,Entrada(R$),Saída(R$),Saldo do Dia(R$)
01/09/2026,01/09/2026,Pix recebido,Cliente Exemplo,1000.00,0.00,1000.00
02/09/2026,02/09/2026,Pagamento de boleto,Loja Exemplo,0.00,210.90,789.10
` },
  { banco: "Mercado Pago (conta)", fonte: "referência", nome: "account_statement.csv", n: 2, total: 400, texto:
`INITIAL_BALANCE;CREDITS;DEBITS;FINAL_BALANCE
100,00;500,00;-100,00;500,00

RELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE
01-09-2026;Transferência Pix recebida Cliente Exemplo;123456789;500,00;600,00
02-09-2026;Pagamento Loja Exemplo;123456790;-100,00;500,00
` },
];

const FATURAS = [
  { banco: "Nubank", fonte: "conferido", nome: "Nubank_2026-10-05.csv", n: 3, total: -937.35, parcelas: ["1/10", "4/12"], texto:
`date,title,amount
2026-10-05,Supermercado Exemplo,387.45
2026-10-07,Smart TV - Parcela 1/10,250.00
2026-07-15,Geladeira - Parcela 4/12,299.90
2026-10-08,Pagamento recebido,-1500.00
` },
  { banco: "Cora", fonte: "conferido", nome: "fatura-80b37799.csv", n: 3, total: -3152.81, final: "1234", parcelas: ["1/5", "2/6"], texto:
`Data,Nome no Cartão,Final do Cartão,Categoria,Descrição,Moeda,Valor Moeda Local,Conversão Dólar na Data,Valor em Dólar,IOF,Valor
21/09/2026,TITULAR EXEMPLO,1234,Lançamentos,LOJA COBERTURAS          1/5,R$,,,,,"1440,00"
16/09/2026,TITULAR EXEMPLO,1234,Lançamentos,LOJA SERVICOS,R$,,,,,"825,00"
08/09/2026,TITULAR EXEMPLO,1234,Lançamentos,CONCRETEIRA                   2/6,R$,,,,,"887,81"
` },
  { banco: "C6", fonte: "referência", nome: "Fatura_2026-10-10.csv", n: 2, total: -410, final: "8821", parcelas: ["1/3"], texto:
`Data de Compra;Nome no Cartão;Final do Cartão;Categoria;Descrição;Parcela;Valor (em US$);Cotação (em R$);Valor (em R$)
01/09/2026;FULANO;8821;Material;LOJA X;1/3;0;0;300,00
05/09/2026;FULANO;8821;Serviços;SOFTWARE INC;Única;20,00;5,50;110,00
` },
  { banco: "Inter", fonte: "referência", nome: "fatura-inter-2026-10.csv", n: 2, total: -125, parcelas: ["2/6"], texto:
`Data,Lançamento,Categoria,Tipo,Valor
02/09/2026,PADARIA EXEMPLO,Alimentação,Compra à vista,"R$ 25,00"
04/09/2026,LOJA DE TINTAS,Casa,Parcela 2 de 6,"R$ 100,00"
10/09/2026,PAGAMENTO ON LINE,Outros,Pagamento,"-R$ 500,00"
` },
  { banco: "XP", fonte: "referência", nome: "Fatura2026-10-15.csv", n: 2, total: -1290, parcelas: ["1/3"], texto:
`Data;Estabelecimento;Portador;Valor;Parcela
01/09/2026;LOJA EXEMPLO;FULANO DE TAL;R$ 1.200,00;1 de 3
03/09/2026;POSTO EXEMPLO;FULANO DE TAL;R$ 90,00;-
10/09/2026;Pagamentos Validos Normais;FULANO DE TAL;R$ -2.000,00;-
` },
  { banco: "Itaú", fonte: "referência", nome: "Fatura-Itau.csv", n: 2, total: -380, parcelas: ["2/6"], texto:
`Itaucard Exemplo Visa
final 4321
data;lançamento;valor
01/09/2026;LOJA EXEMPLO 02/06;200,00
03/09/2026;RESTAURANTE EXEMPLO;180,00
05/09/2026;PAGAMENTO EFETUADO;-1.000,00
` },
  { banco: "Santander", fonte: "referência", nome: "fatura-santander.csv", n: 2, total: -250, texto:
`Data;Descrição;Valor (US$);Valor (R$)
01/09/2026;LOJA EXEMPLO;0,00;150,00
02/09/2026;SERVICO ONLINE;18,00;100,00
` },
  { banco: "BTG", fonte: "referência", nome: "fatura-btg.csv", n: 2, total: -530, parcelas: ["3/10"], texto:
`Data;Descrição;Parcela;Valor
01/09/2026;LOJA EXEMPLO;3/10;R$ 480,00
04/09/2026;APLICATIVO EXEMPLO;;R$ 50,00
` },
  { banco: "Bradesco", fonte: "referência", nome: "fatura-bradesco.csv", n: 2, total: -312.5, parcelas: ["2/4"], texto:
`Data;Histórico;Valor(US$);Valor(R$)
01/09;LOJA EXEMPLO PARC 02/04;0,00;250,00
03/09;FARMACIA EXEMPLO;0,00;62,50
` },
  { banco: "fatura com mês por extenso", fonte: "referência", nome: "fatura-cartao.csv", n: 2, total: -199.8, parcelas: ["2/10"], texto:
`Data;Descrição;Parcela;Valor
15 SET;LOJA EXEMPLO;02/10;R$ 99,90
16 SET;MERCADO EXEMPLO;;R$ 99,90
` },
];

const testes = [];
testes.push(["datas: AAAAMMDD, mês por extenso", () => {
  assert.strictEqual(M.efData("20260901"), "2026-09-01");
  assert.strictEqual(M.efData("01 set 2026"), "2026-09-01");
  assert.strictEqual(M.efData("1 de setembro de 2026"), "2026-09-01");
  assert.strictEqual(M.efData("05/MAR/2026"), "2026-03-05");
  assert.strictEqual(M.efData("12345678"), "");
}]);
testes.push(["não travar: fatura que não deu para ler — a pessoa aponta as colunas", async () => {
  // sem cabeçalho e com o valor antes da data: nada a adivinhar com certeza
  const linhas = [["LOJA EXEMPLO", "150,00", "01/09/2026", "x"], ["POSTO EXEMPLO", "80,00", "02/09/2026", "y"]];
  const guia = M.colunasParaEscolher(linhas);
  assert.ok(guia.opcoes.length >= 3 && /150,00/.test(guia.opcoes[1].rotulo));
  const r = M.movimentosDoCartao(linhas, { colunas: { data: 2, valor: 1, historico: 0 } });
  assert.ok(!r.erro, r.erro);
  assert.deepStrictEqual(r.movimentos.map((m) => [m.data, m.valor, m.historico]), [["2026-09-01", -150, "LOJA EXEMPLO"], ["2026-09-02", -80, "POSTO EXEMPLO"]]);
}]);
for (const x of EXTRATOS) testes.push([`extrato ${x.banco} (${x.fonte})`, async () => {
  const movs = await extrato(x.nome, x.texto);
  assert.strictEqual(movs.length, x.n, `linhas: ${movs.length} — ${JSON.stringify(movs.map((m) => [m.data, m.valor, m.historico]))}`);
  assert.strictEqual(soma(movs), x.total, `soma ${soma(movs)}`);
  assert.ok(movs.every((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.data)), "data");
}]);
for (const x of FATURAS) testes.push([`fatura ${x.banco} (${x.fonte})`, async () => {
  const r = await fatura(x.nome, x.texto);
  assert.strictEqual(r.movimentos.length, x.n, `linhas: ${JSON.stringify(r.movimentos)}`);
  assert.strictEqual(soma(r.movimentos), x.total, `soma ${soma(r.movimentos)}`);
  if (x.final) assert.strictEqual(r.final, x.final);
  for (const pc of x.parcelas || []) assert.ok(r.movimentos.some((m) => `${m.parcela}/${m.de}` === pc), `parcela ${pc}: ${JSON.stringify(r.movimentos)}`);
  assert.ok(r.movimentos.every((m) => m.historico && !/^[\d,.\sR$-]+$/.test(m.historico)), "descrição");
}]);

let falhas = 0;
for (const [nome, fn] of testes) {
  try { await fn(); console.log("  ok   " + nome); }
  catch (e) { falhas++; console.log("  FALHOU " + nome + "\n         " + e.message); }
}
console.log(`\n${testes.length - falhas}/${testes.length} passaram`);
process.exit(falhas ? 1 : 0);
