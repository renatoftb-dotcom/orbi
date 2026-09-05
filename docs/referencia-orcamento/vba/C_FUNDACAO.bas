Attribute VB_Name = "C_FUNDACAO"

'QUANTIDADES FIXS
Dim QTD_BOMBA_CONCRETO As Double

'FORMULAS
Dim CALC_TABUAS_30_FUNDACAO_EDIF As Double
Dim CALC_SARRAFO_5_FUNDACACAO_EDIF As Double
Dim CALC_PERFURACAO_ESTACAS_EDIF As Double
Dim CALC_CA60_4MM_FUND_EDIF As Double
Dim CALC_CA50_5MM_FUND_EDIF As Double
Dim CALC_CA50_6MM_FUND_EDIF As Double
Dim CALC_CA50_8MM_FUND_EDIF As Double
Dim CALC_CA50_10MM_FUND_EDIF As Double
Dim CALC_CA50_12MM_FUND_EDIF As Double
Dim CALC_CA50_16MM_FUND_EDIF As Double
Dim CALC_CA60_5MM_FUND_EDIF As Double
Dim CALC_CONCR_FUND_EDIF As Double
Dim CALC_DISCO_FERRO_FUND As Double
Dim CALC_PESO_FERRO_FUND As Double
Dim CALC_ARAME_FUND As Double
Dim CALC_PREGO_18X27_FUND As Double
Dim CALC_VEDATOP_FUND As Double


Sub FUNDACAO()


Windows("NOVO MODELO ORÇAMENTO.xlsm").Activate

Sheets("RESUMO").Select

'QUANTIDADES FIXAS

QTD_BOMBA_CONCRETO = 1

'FORMULAS

CALC_TABUAS_30_FUNDACAO_EDIF = WorksheetFunction.Ceiling(((CP_PERIMETRO_PAREDES_TERREO_EDIF * 2 / 3) + CP_PERIMETRO_PAREDES_TERREO_EDIF * 2 / 3 * 0.45 / 3) * 1.1, 1)
CALC_SARRAFO_5_FUNDACACAO_EDIF = WorksheetFunction.Ceiling(((CP_PERIMETRO_PAREDES_TERREO_EDIF * 2 / 0.7 * 0.45) + (CP_PERIMETRO_PAREDES_TERREO_EDIF / 0.75 * 0.3)) / 3 * 1.1, 1)
CALC_PERFURACAO_ESTACAS_EDIF = CP_QTD_ESTACAS_EDIF * CP_PROF_ESTACAS_EDIF * 1.15
CALC_CA60_4MM_FUND_EDIF = WorksheetFunction.Ceiling((CP_CA60_4MM_EST_EDIF + CP_CA60_4MM_SAP_EDIF + CP_CA60_4MM_ARR_EDIF + CP_CA60_4MM_BALD_EDIF) / 12 * 1.1, 1)
CALC_CA50_5MM_FUND_EDIF = WorksheetFunction.Ceiling((CP_CA50_5MM_EST_EDIF + CP_CA50_5MM_SAP_EDIF + CP_CA50_5MM_ARR_EDIF + CP_CA50_5MM_BALD_EDIF) / 12 * 1.1, 1)
CALC_CA50_6MM_FUND_EDIF = WorksheetFunction.Ceiling((CP_CA50_6MM_EST_EDIF + CP_CA50_6MM_SAP_EDIF + CP_CA50_6MM_ARR_EDIF + CP_CA50_6MM_BALD_EDIF) / 12 * 1.1, 1)
CALC_CA50_8MM_FUND_EDIF = WorksheetFunction.Ceiling((CP_CA50_8MM_EST_EDIF + CP_CA50_8MM_SAP_EDIF + CP_CA50_8MM_ARR_EDIF + CP_CA50_8MM_BALD_EDIF) / 12 * 1.1, 1)
CALC_CA50_10MM_FUND_EDIF = WorksheetFunction.Ceiling((CP_CA50_10MM_EST_EDIF + CP_CA50_10MM_SAP_EDIF + CP_CA50_10MM_ARR_EDIF + CP_CA50_10MM_BALD_EDIF) / 12 * 1.1, 1)
CALC_CA50_12MM_FUND_EDIF = WorksheetFunction.Ceiling((CP_CA50_12MM_EST_EDIF + CP_CA50_12MM_SAP_EDIF + CP_CA50_12MM_ARR_EDIF + CP_CA50_12MM_BALD_EDIF) / 12 * 1.1, 1)
CALC_CA50_16MM_FUND_EDIF = WorksheetFunction.Ceiling((CP_CA50_16MM_EST_EDIF + CP_CA50_16MM_SAP_EDIF + CP_CA50_16MM_ARR_EDIF + CP_CA50_16MM_BALD_EDIF) / 12 * 1.1, 1)
CALC_CA60_5MM_FUND_EDIF = WorksheetFunction.Ceiling((CP_CA60_5MM_EST_EDIF + CP_CA60_5MM_SAP_EDIF + CP_CA60_5MM_ARR_EDIF + CP_CA60_5MM_BALD_EDIF) / 12 * 1.1, 1)
CALC_CONCR_FUND_EDIF = WorksheetFunction.Ceiling((CP_CONCR_EST_EDIF + CP_CONCR_SAP_EDIF + CP_CONCR_ARR_EDIF + CP_CONCR_BALD_EDIF) * 1.1, 1)

CALC_PESO_FERRO_FUND = ((CALC_CA60_4MM_FUND_EDIF * PESO_CA60_4MM) + (CALC_CA50_5MM_FUND_EDIF * PESO_CA50_5MM) + (CALC_CA50_6MM_FUND_EDIF * PESO_CA50_6MM) + (CALC_CA50_8MM_FUND_EDIF * PESO_CA50_8MM) _
                        + (CALC_CA50_10MM_FUND_EDIF * PESO_CA50_10MM) + (CALC_CA50_12MM_FUND_EDIF * PESO_CA50_12MM) _
                        + (CALC_CA50_16MM_FUND_EDIF * PESO_CA50_16MM) + (CALC_CA60_5MM_FUND_EDIF * PESO_CA60_5MM))

CALC_DISCO_FERRO_FUND = WorksheetFunction.Ceiling(CALC_PESO_FERRO_FUND * 0.01, 1)
CALC_ARAME_FUND = WorksheetFunction.Ceiling(CALC_PESO_FERRO_FUND * 0.06, 1)
CALC_PREGO_18X27_FUND = WorksheetFunction.Ceiling(0.55 * CALC_ARAME_FUND, 1)
CALC_VEDATOP_FUND = WorksheetFunction.Ceiling((((CP_PERIMETRO_PAREDES_TERREO_EDIF * 2 * 0.3) + (CP_PERIMETRO_PAREDES_TERREO_EDIF * 0.15)) * 3 * 1.1) / 18, 1)





'INSERINDO NA PLANILHA


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA60_4MM_FUND_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_FUNDACAO
Range("B" & PLIN).Value = "Aço - Barras de CA60 4.2mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Brocas e baldrames"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA60_4MM_FUND_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_5MM_FUND_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_FUNDACAO
Range("B" & PLIN).Value = "Aço - Barras de CA50 5.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Brocas e baldrames"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_5MM_FUND_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_6MM_FUND_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_FUNDACAO
Range("B" & PLIN).Value = "Aço - Barras de CA50 6.3mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Brocas e baldrames"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_6MM_FUND_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_8MM_FUND_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_FUNDACAO
Range("B" & PLIN).Value = "Aço - Barras de CA50 8.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Brocas e baldrames"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_8MM_FUND_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_10MM_FUND_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_FUNDACAO
Range("B" & PLIN).Value = "Aço - Barras de CA50 10.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Brocas e baldrames"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_10MM_FUND_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_12MM_FUND_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_FUNDACAO
Range("B" & PLIN).Value = "Aço - Barras de CA50 12.5mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Brocas e baldrames"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_12MM_FUND_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_16MM_FUND_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_FUNDACAO
Range("B" & PLIN).Value = "Aço - Barras de CA50 16mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Brocas e baldrames"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_16MM_FUND_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA60_5MM_FUND_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_FUNDACAO
Range("B" & PLIN).Value = "Aço - Barras de CA60 5.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Brocas e baldrames"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA60_5MM_FUND_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_DISCO_FERRO_FUND <> 0 Then
Range("a" & PLIN).Value = ORD_FUNDACAO
Range("B" & PLIN).Value = "Disco Ferro"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Brocas e baldrames"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_DISCO_FERRO_FUND
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_ARAME_FUND <> 0 Then
Range("a" & PLIN).Value = ORD_FUNDACAO
Range("B" & PLIN).Value = "Aço - Arame Recozido"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Brocas e baldrames"
Range("F" & PLIN).Value = "KG"
Range("G" & PLIN).Value = CALC_ARAME_FUND
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PREGO_18X27_FUND <> 0 Then
Range("a" & PLIN).Value = ORD_FUNDACAO
Range("B" & PLIN).Value = "Aço - Pregos 18x27"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Brocas e baldrames"
Range("F" & PLIN).Value = "KG"
Range("G" & PLIN).Value = CALC_PREGO_18X27_FUND
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PERFURACAO_ESTACAS_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_FUNDACAO
Range("B" & PLIN).Value = "Maquinário - Perfuração"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Brocas e baldrames"
Range("F" & PLIN).Value = "Mts"
Range("G" & PLIN).Value = CALC_PERFURACAO_ESTACAS_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TABUAS_30_FUNDACAO_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_FUNDACAO
Range("B" & PLIN).Value = "Madeira Caixaria - Tábuas de 30cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Brocas e baldrames"
Range("F" & PLIN).Value = "Barras 3mts"
Range("G" & PLIN).Value = CALC_TABUAS_30_FUNDACAO_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_SARRAFO_5_FUNDACACAO_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_FUNDACAO
Range("B" & PLIN).Value = "Madeira Caixaria - Sarrafos de 05cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Brocas e baldrames"
Range("F" & PLIN).Value = "Barras 3mts"
Range("G" & PLIN).Value = CALC_SARRAFO_5_FUNDACACAO_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CONCR_FUND_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_FUNDACAO
Range("B" & PLIN).Value = CP_RESISTENCIA_CONCRETO_EDIF
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Brocas e baldrames"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_CONCR_FUND_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If QTD_BOMBA_CONCRETO <> 0 Then
Range("a" & PLIN).Value = ORD_FUNDACAO
Range("B" & PLIN).Value = "Concreto - Bomba"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Brocas e baldrames"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = QTD_BOMBA_CONCRETO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_VEDATOP_FUND <> 0 Then
Range("a" & PLIN).Value = ORD_FUNDACAO
Range("B" & PLIN).Value = "Impermeabilizantes - Vedatop 18KG"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Impermeabilização"
Range("F" & PLIN).Value = "Baldes 18L"
Range("G" & PLIN).Value = CALC_VEDATOP_FUND
End If

End Sub




