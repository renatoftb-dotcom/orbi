Attribute VB_Name = "H_PAREDES_PAV_1"

'FORMULAS
Dim CALC_TIJOLOS_6F_PAV_1 As Double
Dim CALC_TIJOLOS_8F_PAV_1 As Double
Dim CALC_AREIA_FINA_ASSENT_PAV_1 As Double
Dim CALC_VEDALIT_FINA_ASSENT_PAV_1 As Double
Dim CALC_CIMENTO_FINA_ASSENT_PAV_1 As Double
Dim CALC_CONTRAVERGA_PAV_1 As Double

Dim CALC_CA50_5MM_COLUN_PAV_1_EDIF As Double
Dim CALC_CA50_6MM_COLUN_PAV_1_EDIF As Double
Dim CALC_CA50_8MM_COLUN_PAV_1_EDIF As Double
Dim CALC_CA50_10MM_COLUN_PAV_1_EDIF As Double
Dim CALC_CA50_12MM_COLUN_PAV_1_EDIF As Double
Dim CALC_CA50_16MM_COLUN_PAV_1_EDIF As Double
Dim CALC_CA60_5MM_COLUN_PAV_1_EDIF As Double
Dim CALC_CONCR_COLUN_PAV_1_EDIF As Double
Dim CALC_TABUAS_15_COLUN_PAV_1_EDIF As Double
Dim CALC_TABUAS_20_COLUN_PAV_1_EDIF As Double
Dim CALC_TABUAS_30_COLUN_PAV_1_EDIF As Double
Dim CALC_MADERITES_COLUN_PAV_1_EDIF As Double
Dim CALC_AREIA_GROSSA_COLUNAS_PAV_1 As Double
Dim CALC_PEDRA_COLUNAS_PAV_1 As Double
Dim CALC_CIMENTO_COLUNAS_PAV_1 As Double
Dim CALC_PESO_FERRO_COLUNAS_PAV_1_EDIF As Double
Dim CALC_ARAME_COLUNAS_PAV_1_EDIF As Double
Dim CALC_PREGO_18X27_COLUN_PAV_1_EDIF As Double
Dim CALC_SARRAFO_5_COLUN_PAV_1_EDIF As Double


Sub PAREDES_PAV_1()

'Call DECLARAR_VARIAVEIS


Windows("NOVO MODELO ORÇAMENTO.xlsm").Activate

Sheets("RESUMO").Select


'FORMULAS

CALC_TIJOLOS_6F_PAV_1 = WorksheetFunction.Ceiling(CP_M2_PAREDES_20_PAV_1_EDIF * 40 * 1.1, 1)
CALC_TIJOLOS_8F_PAV_1 = WorksheetFunction.Ceiling(((CP_M2_PAREDES_25_PAV_1_EDIF * 40) + (CP_M2_PAREDES_15_PAV_1_EDIF * 20)) * 1.1, 1)
CALC_AREIA_FINA_ASSENT_PAV_1 = WorksheetFunction.Ceiling((CALC_TIJOLOS_6F_PAV_1 * 0.001638 * 1.1) + (CALC_TIJOLOS_8F_PAV_1 * 0.002223 * 1.1), 1)
CALC_VEDALIT_FINA_ASSENT_PAV_1 = WorksheetFunction.Ceiling(CALC_AREIA_FINA_ASSENT_PAV_1 / 25 * 1.1, 1)
CALC_CIMENTO_FINA_ASSENT_PAV_1 = WorksheetFunction.Ceiling(CALC_AREIA_FINA_ASSENT_PAV_1 * 2 * 1.1, 1)
CALC_CONTRAVERGA_PAV_1 = WorksheetFunction.Ceiling(CP_VAO_PORTAS_JANELAS_PAV_1_EDIF * 2 / 12 * 1.1, 1)
CALC_TABUAS_15_COLUN_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_COLUNAS_15_PAV_1_EDIF * 2.8 * 2 / 3 * 1.1, 1)
CALC_TABUAS_20_COLUN_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_COLUNAS_20_PAV_1_EDIF * 2.8 * 2 / 3 * 1.1, 1)
CALC_TABUAS_30_COLUN_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_COLUNAS_25_PAV_1_EDIF * 2.8 * 2 / 3 * 1.1, 1)

CALC_SARRAFO_5_COLUN_PAV_1_EDIF = WorksheetFunction.Ceiling(((CP_COLUNAS_15_PAV_1_EDIF * 2.8 * 2 / 0.5 * 0.2) _
                                   + (CP_COLUNAS_20_PAV_1_EDIF * 2.8 * 2 / 0.5 * 0.25) + (CP_COLUNAS_30_PAV_1_EDIF * 2.8 * 2 / 0.5 * 0.35)) * 1.1 / 3, 1)

CALC_MADERITES_COLUN_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_AREA_FORMA_COLUNA_PAV_1_MAIOR_25CM / 2.42 * 1.1, 1)
CALC_AREIA_GROSSA_COLUNAS_PAV_1 = WorksheetFunction.Ceiling(CP_CONCR_COLUN_PAV_1_EDIF * 0.6 * 1.1, 1)
CALC_PEDRA_COLUNAS_PAV_1 = WorksheetFunction.Ceiling(CP_CONCR_COLUN_PAV_1_EDIF * 1.1, 1)
CALC_CIMENTO_COLUNAS_PAV_1 = WorksheetFunction.Ceiling(CALC_PEDRA_COLUNAS_PAV_1 * 6 * 1.1, 1)

CALC_CA50_5MM_COLUN_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_CA50_5MM_COLUN_PAV_1_EDIF / 12 * 1.1, 1)
CALC_CA50_6MM_COLUN_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_CA50_6MM_COLUN_PAV_1_EDIF / 12 * 1.1, 1)
CALC_CA50_8MM_COLUN_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_CA50_8MM_COLUN_PAV_1_EDIF / 12 * 1.1, 1)
CALC_CA50_10MM_COLUN_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_CA50_10MM_COLUN_PAV_1_EDIF / 12 * 1.1, 1)
CALC_CA50_12MM_COLUN_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_CA50_12MM_COLUN_PAV_1_EDIF / 12 * 1.1, 1)
CALC_CA50_16MM_COLUN_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_CA50_16MM_COLUN_PAV_1_EDIF / 12 * 1.1, 1)
CALC_CA60_5MM_COLUN_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_CA60_5MM_COLUN_PAV_1_EDIF / 12 * 1.1, 1)

CALC_PESO_FERRO_COLUNAS_PAV_1_EDIF = ((CALC_CA60_4MM_COLUN_PAV_1_EDIF * PESO_CA60_4MM) + (CALC_CA50_5MM_COLUN_PAV_1_EDIF * PESO_CA50_5MM) + (CALC_CA50_6MM_COLUN_PAV_1_EDIF * PESO_CA50_6MM) + (CALC_CA50_8MM_COLUN_PAV_1_EDIF * PESO_CA50_8MM) _
                        + (CALC_CA50_10MM_COLUN_PAV_1_EDIF * PESO_CA50_10MM) + (CALC_CA50_12MM_COLUN_PAV_1_EDIF * PESO_CA50_12MM) _
                        + (CALC_CA50_16MM_COLUN_PAV_1_EDIF * PESO_CA50_16MM) + (CALC_CA60_5MM_COLUN_PAV_1_EDIF * PESO_CA60_5MM))

CALC_ARAME_COLUNAS_PAV_1_EDIF = WorksheetFunction.Ceiling(CALC_PESO_FERRO_COLUNAS_PAV_1_EDIF * 0.06 * 1.1, 1)
CALC_PREGO_18X27_COLUN_PAV_1_EDIF = WorksheetFunction.Ceiling(CALC_ARAME_COLUNAS_PAV_1_EDIF * 0.55, 1)




'INSERINDO NA PLANILHA

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TIJOLOS_6F_PAV_1 <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Cerâmicas - Tijolo - Bloco  6 Furos"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Paredes Pav 1"
Range("F" & PLIN).Value = "Unidade"
Range("G" & PLIN).Value = CALC_TIJOLOS_6F_PAV_1
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TIJOLOS_8F_PAV_1 <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Cerâmicas - Tijolo - Bloco 8 Furos"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Paredes Pav 1"
Range("F" & PLIN).Value = "Unidade"
Range("G" & PLIN).Value = CALC_TIJOLOS_8F_PAV_1
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_AREIA_FINA_ASSENT_PAV_1 <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Areia Fina"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Paredes Pav 1"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_AREIA_FINA_ASSENT_PAV_1
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_VEDALIT_FINA_ASSENT_PAV_1 <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Impermeabilizantes - Vedalit 18L"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Paredes Pav 1"
Range("F" & PLIN).Value = "Baldes 18L"
Range("G" & PLIN).Value = CALC_VEDALIT_FINA_ASSENT_PAV_1
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CIMENTO_FINA_ASSENT_PAV_1 <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Sacos de cimento 50kg"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Paredes Pav 1"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_CIMENTO_FINA_ASSENT_PAV_1
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CONTRAVERGA_PAV_1 <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Aço - Treliça H8 Barras 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra estrutura Pav. Térreo"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CONTRAVERGA_PAV_1
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TABUAS_15_COLUN_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Madeira Caixaria - Tábuas de 20cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra estrutura Pav. Térreo"
Range("F" & PLIN).Value = "Barras 3 mts"
Range("G" & PLIN).Value = CALC_TABUAS_15_COLUN_PAV_1_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TABUAS_20_COLUN_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Madeira Caixaria - Tábuas de 25cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra estrutura Pav. Térreo"
Range("F" & PLIN).Value = "Barras 3 mts"
Range("G" & PLIN).Value = CALC_TABUAS_20_COLUN_PAV_1_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TABUAS_30_COLUN_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Madeira Caixaria - Tábuas de 30cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra estrutura Pav. Térreo"
Range("F" & PLIN).Value = "Barras 3 mts"
Range("G" & PLIN).Value = CALC_TABUAS_30_COLUN_PAV_1_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_SARRAFO_5_COLUN_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Madeira Caixaria - Sarrafos de 05cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra estrutura Pav. Térreo"
Range("F" & PLIN).Value = "Barras 3 mts"
Range("G" & PLIN).Value = CALC_SARRAFO_5_COLUN_PAV_1_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_MADERITES_COLUN_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Madeira Caixaria - Madeirite Plastif. Preto 2,10x1,10mts 18mm"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra estrutura Pav. Térreo"
Range("F" & PLIN).Value = "Unidade"
Range("G" & PLIN).Value = CALC_MADERITES_COLUN_PAV_1_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_AREIA_GROSSA_COLUNAS_PAV_1 <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Areia Grossa"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra estrutura Pav. Térreo"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_AREIA_GROSSA_COLUNAS_PAV_1
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PEDRA_COLUNAS_PAV_1 <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Pedra"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra estrutura Pav. Térreo"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_PEDRA_COLUNAS_PAV_1
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CIMENTO_COLUNAS_PAV_1 <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Sacos de cimento 50kg"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra estrutura Pav. Térreo"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_CIMENTO_COLUNAS_PAV_1
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA60_4MM_COLUN_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Aço - Barras de CA50 4.2mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra estrutura Pav. Térreo"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_4MM_COLUN_PAV_1_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_5MM_COLUN_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Aço - Barras de CA50 5.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra estrutura Pav. Térreo"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_5MM_COLUN_PAV_1_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_6MM_COLUN_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Aço - Barras de CA50 6.3mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra estrutura Pav. Térreo"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_6MM_COLUN_PAV_1_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_8MM_COLUN_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Aço - Barras de CA50 8.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra estrutura Pav. Térreo"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_8MM_COLUN_PAV_1_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_10MM_COLUN_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Aço - Barras de CA50 10.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra estrutura Pav. Térreo"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_10MM_COLUN_PAV_1_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_12MM_COLUN_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Aço - Barras de CA50 12.5mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra estrutura Pav. Térreo"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_12MM_COLUN_PAV_1_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_16MM_COLUN_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Aço - Barras de CA50 16mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra estrutura Pav. Térreo"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_16MM_COLUN_PAV_1_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA60_5MM_COLUN_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Aço - Barras de CA60 5.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra estrutura Pav. Térreo"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA60_5MM_COLUN_PAV_1_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_ARAME_COLUNAS_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Aço - Arame Recozido"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra estrutura Pav. Térreo"
Range("F" & PLIN).Value = "KG"
Range("G" & PLIN).Value = CALC_ARAME_COLUNAS_PAV_1_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PREGO_18X27_COLUN_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_PAREDES_PAV_1
Range("B" & PLIN).Value = "Aço - Pregos 18x27"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra estrutura Pav. Térreo"
Range("F" & PLIN).Value = "KG"
Range("G" & PLIN).Value = CALC_PREGO_18X27_COLUN_PAV_1_EDIF
End If


End Sub
