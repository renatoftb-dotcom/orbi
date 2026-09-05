Attribute VB_Name = "O_MURO_DIVISA"
'VALORES FIXOS
Dim PROF_BROCAS As Double
Dim DIAM_BROCAS As Double

'FORMULAS
Dim CALC_AREA_MURO As Double
Dim CALC_VOL_CHAPISCO As Double
Dim CALC_VOL_REBOCO As Double
Dim CALC_TIJOLOS As Double
Dim CALC_AREIA_FINA_ASSENT As Double
Dim CALC_AREIA_FINA_REBOCO As Double
Dim CALC_AREIA_FINA_TOTAL As Double
Dim CALC_AREIA_GROSSA_CHAPISCO As Double
Dim CALC_VEDALIT As Double
Dim CALC_CIMENTO_CHAPISCO As Double
Dim CALC_CIMENTO_REBOCO As Double
Dim CALC_CIMENTO_ASSENTAMENTO As Double
Dim CALC_CIMENTO_TOTAL As Double
Dim CALC_VEDATOP As Double
Dim CALC_NUM_BROCAS_COLUNAS As Double
Dim CALC_VOL_BROCAS As Double
Dim CALC_VOL_COLUNAS As Double
Dim CALC_VOL_VIGAS As Double
Dim CALC_CONCRETO As Double
Dim CALC_AGUA As Double
Dim CALC_PERFURACAO As Double
Dim CALC_TABUAS_30 As Double
Dim CALC_SARRAFO_5 As Double
Dim CALC_FERRO_5 As Double
Dim CALC_FERRO_8 As Double
Dim CALC_ARAME As Double
Dim CALC_PREGO As Double



Sub MURO_DIVISA()

'VALORES FIXOS

PROF_BROCAS = 4
DIAM_BROCAS = 0.125



'FORMULAS

CALC_NUM_BROCAS_COLUNAS = WorksheetFunction.Ceiling(CP_COMPRIMENTO_MURO_DIVISA / 2.5, 1)

CALC_PERFURACAO = CALC_NUM_BROCAS_COLUNAS * PROF_BROCAS * 1.15

CALC_VOL_BROCAS = (CALC_NUM_BROCAS_COLUNAS * 3.14 * (DIAM_BROCAS ^ 2) * PROF_BROCAS) * 1.1
CALC_VOL_COLUNAS = CP_ALTURA_MURO_DIVISA * CALC_NUM_BROCAS_COLUNAS * 0.2 * 0.25 * 1.1
CALC_VOL_VIGAS = CP_COMPRIMENTO_MURO_DIVISA * 2 * 0.3 * 0.2 * 1.1
CALC_CONCRETO = CALC_VOL_BROCAS + CALC_VOL_COLUNAS + CALC_VOL_VIGAS
CALC_TABUAS_30 = WorksheetFunction.Ceiling(((CP_COMPRIMENTO_MURO_DIVISA * 2 / 3) + CP_COMPRIMENTO_MURO_DIVISA * 2 / 3 * 0.45 / 3) * 2 * 1.1, 1)
CALC_SARRAFO_5 = WorksheetFunction.Ceiling(((CP_COMPRIMENTO_MURO_DIVISA * 2 / 0.7 * 0.45) + (CP_COMPRIMENTO_MURO_DIVISA / 0.75 * 0.3)) / 3 * 1.1, 1)
CALC_FERRO_5 = WorksheetFunction.Ceiling(((PROF_BROCAS / 0.15 * DIAM_BROCAS * 2 * 1.1 * CALC_NUM_BROCAS_COLUNAS) + (CP_ALTURA_MURO_DIVISA / 0.15 * 0.9 * 1.1 * CALC_NUM_BROCAS_COLUNAS) + (CP_COMPRIMENTO_MURO_DIVISA / 0.15 * 1 * 1.1)) / 12 * 1.1, 1)
CALC_FERRO_8 = WorksheetFunction.Ceiling(((CALC_NUM_BROCAS_COLUNAS * PROF_BROCAS * 3 * 1.1) + (CP_ALTURA_MURO_DIVISA * 4 * CALC_NUM_BROCAS_COLUNAS * 1.1) + (CP_COMPRIMENTO_MURO_DIVISA * 2 * 4 * 1.1)) / 12 * 1.1, 1)
CALC_ARAME = WorksheetFunction.Ceiling(0.06 * ((CALC_FERRO_5 * 1.1 * PESO_CA50_5MM) + (CALC_FERRO_8 * 1.1 * PESO_CA50_8MM)), 1)
CALC_PREGO = WorksheetFunction.Ceiling(0.55 * CALC_ARAME, 1)


CALC_AREA_MURO = CP_COMPRIMENTO_MURO_DIVISA * CP_ALTURA_MURO_DIVISA * 1.1
CALC_VOL_CHAPISCO = CALC_AREA_MURO * 1.1 * 2 * 0.005
CALC_VOL_REBOCO = CALC_AREA_MURO * 1.1 * 2 * 0.025
CALC_TIJOLOS = WorksheetFunction.Ceiling(CALC_AREA_MURO * 46.458 * 1.1, 1)
CALC_AREIA_FINA_ASSENT = CALC_TIJOLOS * 0.002223 * 1.1
CALC_AREIA_FINA_REBOCO = CALC_VOL_REBOCO * 0.875 * 1.1
CALC_AREIA_FINA_TOTAL = WorksheetFunction.Ceiling(CALC_AREIA_FINA_ASSENT + CALC_AREIA_FINA_REBOCO, 1)
CALC_AREIA_GROSSA_CHAPISCO = CALC_VOL_CHAPISCO * 0.8 * 1.1
CALC_AGUA = ((CALC_VOL_CHAPISCO * 0.36) + (CALC_VOL_REBOCO * 0.36)) * 1.1
CALC_VEDALIT = WorksheetFunction.Ceiling((CALC_AREIA_FINA_TOTAL / 25) * 1.1, 1)
CALC_CIMENTO_CHAPISCO = (0.2 * CALC_VOL_CHAPISCO * 1200 / 50) * 1.1
CALC_CIMENTO_REBOCO = (0.125 * CALC_VOL_REBOCO * 1200 / 50) * 1.1
CALC_CIMENTO_ASSENTAMENTO = CALC_AREIA_FINA_ASSENT * 2 * 1.1
CALC_CIMENTO_TOTAL = WorksheetFunction.Ceiling(CALC_CIMENTO_CHAPISCO + CALC_CIMENTO_REBOCO + CALC_CIMENTO_ASSENTAMENTO, 1)
CALC_VEDATOP = WorksheetFunction.Ceiling(((0.3 * CP_COMPRIMENTO_MURO_DIVISA) * 3 / 10) * 1.1 + ((CP_COMPRIMENTO_MURO_DIVISA) * 3 / 18) * 1.1, 1)


'INSERINDO NA PLANILHA


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CIMENTO_TOTAL <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_DIVISA
Range("B" & PLIN).Value = "Sacos de cimento 50kg"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Divisa"
Range("E" & PLIN).Value = "Muros"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_CIMENTO_TOTAL
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_AREIA_FINA_TOTAL <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_DIVISA
Range("B" & PLIN).Value = "Areia fina"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Divisa"
Range("E" & PLIN).Value = "Muros"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_AREIA_FINA_TOTAL
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_AREIA_GROSSA_CHAPISCO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_DIVISA
Range("B" & PLIN).Value = "Areia Grossa"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Divisa"
Range("E" & PLIN).Value = "Muros"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_AREIA_GROSSA_CHAPISCO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_AGUA <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_DIVISA
Range("B" & PLIN).Value = "Água"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Divisa"
Range("E" & PLIN).Value = "Muros"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_AGUA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PERFURACAO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_DIVISA
Range("B" & PLIN).Value = "Maquinário - Perfuração"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Divisa"
Range("E" & PLIN).Value = "Perfuração"
Range("F" & PLIN).Value = "Mts"
Range("G" & PLIN).Value = CALC_PERFURACAO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TABUAS_30 <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_DIVISA
Range("B" & PLIN).Value = "Madeira Caixaria - Tábuas de 30cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Divisa"
Range("E" & PLIN).Value = "Caixaria"
Range("F" & PLIN).Value = "Barras 3mts"
Range("G" & PLIN).Value = CALC_TABUAS_30
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_SARRAFO_5 <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_DIVISA
Range("B" & PLIN).Value = "Madeira Caixaria - Sarrafos de 05cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Divisa"
Range("E" & PLIN).Value = "Caixaria"
Range("F" & PLIN).Value = "Barras 3mts"
Range("G" & PLIN).Value = CALC_SARRAFO_5
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_ARAME <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_DIVISA
Range("B" & PLIN).Value = "Aço - Arame Recozido"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Divisa"
Range("E" & PLIN).Value = "Caixaria"
Range("F" & PLIN).Value = "KG"
Range("G" & PLIN).Value = CALC_ARAME
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PREGO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_DIVISA
Range("B" & PLIN).Value = "Aço - Pregos 18x27"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Divisa"
Range("E" & PLIN).Value = "Caixaria"
Range("F" & PLIN).Value = "KG"
Range("G" & PLIN).Value = CALC_PREGO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_FERRO_5 <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_DIVISA
Range("B" & PLIN).Value = "Aço - Barras de CA50 5.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Divisa"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_FERRO_5
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_FERRO_8 <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_DIVISA
Range("B" & PLIN).Value = "Aço - Barras de CA50 8.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Divisa"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_FERRO_8
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CONCRETO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_DIVISA
Range("B" & PLIN).Value = "Concreto - FCK20"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Divisa"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_CONCRETO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_VEDATOP <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_DIVISA
Range("B" & PLIN).Value = "Impermeabilizantes - Vedatop 18KG"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Divisa"
Range("E" & PLIN).Value = "Impermeabilização"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_VEDATOP
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TIJOLOS <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_DIVISA
Range("B" & PLIN).Value = "Cerâmicas - Tijolo - Bloco 8 Furos"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Divisa"
Range("E" & PLIN).Value = "Paredes"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_TIJOLOS
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_VEDALIT <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_DIVISA
Range("B" & PLIN).Value = "Impermeabilizantes - Vedalit 18L"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Divisa"
Range("E" & PLIN).Value = "Paredes"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_VEDALIT
End If


End Sub
