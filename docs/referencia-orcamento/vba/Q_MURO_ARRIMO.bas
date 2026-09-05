Attribute VB_Name = "Q_MURO_ARRIMO"
'FORMULAS

Dim CALC_TIJOLOS_8F_ARRIMO As Double
Dim CALC_AREIA_FINA_ASSENT_ARRIMO As Double
Dim CALC_VEDALIT_FINA_ASSENT_ARRIMO As Double
Dim CALC_CIMENTO_FINA_ASSENT_ARRIMO As Double
Dim CALC_TABUAS_15_COLUN_ARRIMO As Double
Dim CALC_TABUAS_20_COLUN_ARRIMO As Double
Dim CALC_TABUAS_30_COLUN_ARRIMO As Double
Dim CALC_SARRAFO_5_COLUN_ARRIMO As Double
Dim CALC_MADERITES_COLUN_ARRIMO As Double
Dim CALC_TABUAS_30_ARRIMO As Double
Dim CALC_SARRAFO_5_ARRIMO As Double
Dim CALC_PERFURACAO_ESTACAS_ARRIMO As Double
Dim CALC_CA60_4MM_ARRIMO As Double
Dim CALC_CA50_5MM_ARRIMO As Double
Dim CALC_CA50_6MM_ARRIMO As Double
Dim CALC_CA50_8MM_ARRIMO As Double
Dim CALC_CA50_10MM_ARRIMO As Double
Dim CALC_CA50_12MM_ARRIMO As Double
Dim CALC_CA50_16MM_ARRIMO As Double
Dim CALC_CA60_5MM_ARRIMO As Double
Dim CALC_CONCR_ARRIMO As Double
Dim CALC_PESO_FERRO_ARRIMO As Double
Dim CALC_DISCO_FERRO_ARRIMO As Double
Dim CALC_ARAME_ARRIMO As Double
Dim CALC_PREGO_18X27_ARRIMO As Double
Dim CALC_VEDATOP_ARRIMO As Double
Dim CALC_TABUAS_30_ARRIMO_TOTAL As Double
Dim CALC_SARRAFO_5_ARRIMO_TOTAL As Double

Sub MURO_DE_CONTENCAO()


'FORMULAS


CALC_TIJOLOS_8F_ARRIMO = WorksheetFunction.Ceiling((CP_ALTURA_ARRIMO * CP_COMPRIMENTO_ARRIMO * 40) * 1.1, 1)
CALC_AREIA_FINA_ASSENT_ARRIMO = WorksheetFunction.Ceiling((CALC_TIJOLOS_8F_ARRIMO * 0.002223 * 1.1), 1)
CALC_VEDALIT_FINA_ASSENT_ARRIMO = WorksheetFunction.Ceiling(CALC_AREIA_FINA_ASSENT_ARRIMO / 25 * 1.1, 1)
CALC_CIMENTO_FINA_ASSENT_ARRIMO = WorksheetFunction.Ceiling(CALC_AREIA_FINA_ASSENT_ARRIMO * 2 * 1.1, 1)

CALC_TABUAS_15_COLUN_ARRIMO = WorksheetFunction.Ceiling(CP_COLUNAS_15_ARRIMO * 2.8 * 2 / 3 * 1.1, 1)
CALC_TABUAS_20_COLUN_ARRIMO = WorksheetFunction.Ceiling(CP_COLUNAS_20_ARRIMO * 2.8 * 2 / 3 * 1.1, 1)
CALC_TABUAS_30_COLUN_ARRIMO = WorksheetFunction.Ceiling(CP_COLUNAS_30_ARRIMO * 2.8 * 2 / 3 * 1.1, 1)
CALC_SARRAFO_5_COLUN_ARRIMO = WorksheetFunction.Ceiling(((CP_COLUNAS_15_ARRIMO * 2.8 * 2 / 0.5 * 0.2) _
                                   + (CP_COLUNAS_20_ARRIMO * 2.8 * 2 / 0.5 * 0.25) + (CP_COLUNAS_30_ARRIMO * 2.8 * 2 / 0.5 * 0.35)) * 1.1 / 3, 1)
                                   
CALC_MADERITES_COLUN_ARRIMO = WorksheetFunction.Ceiling(CP_AREA_FORMA_COLUNA_ARRIMO_MAIOR_25CM / 2.42 * 1.1, 1)
                                   

CALC_TABUAS_30_ARRIMO = WorksheetFunction.Ceiling(((CP_COMPRIMENTO_ARRIMO * 2 / 3) + CP_COMPRIMENTO_ARRIMO * 2 / 3 * 0.45 / 3) * CP_NUMERO_VIGAS_ARRIMO * 1.1, 1)
CALC_SARRAFO_5_ARRIMO = WorksheetFunction.Ceiling(((CP_COMPRIMENTO_ARRIMO * 2 / 0.7 * 0.45) + (CP_COMPRIMENTO_ARRIMO / 0.75 * 0.3)) / 3 * CP_NUMERO_VIGAS_ARRIMO * 1.1, 1)
CALC_PERFURACAO_ESTACAS_ARRIMO = CP_QTD_ESTACAS_ARRIMO * CP_PROF_ESTACAS_ARRIMO * 1.15
CALC_CA60_4MM_ARRIMO = WorksheetFunction.Ceiling((CP_CA60_4MM_ESTACAS_ARRIMO + CP_CA60_4MM_SAPATAS_ARRIMO + CP_CA60_4MM_ARRANQUES_ARRIMO + CP_CA60_4MM_BALDRAME_ARRIMO + CP_CA60_4MM_GIGANTE_ARRIMO + CP_CA60_4MM_COLUNAS_ARRIMO + CP_CA60_4MM_VIGAS_ARRIMO) / 12 * 1.1, 1)
CALC_CA50_5MM_ARRIMO = WorksheetFunction.Ceiling((CP_CA50_5MM_ESTACAS_ARRIMO + CP_CA50_5MM_SAPATAS_ARRIMO + CP_CA50_5MM_ARRANQUES_ARRIMO + CP_CA50_5MM_BALDRAME_ARRIMO + CP_CA50_5MM_GIGANTE_ARRIMO + CP_CA50_5MM_COLUNAS_ARRIMO + CP_CA50_5MM_VIGAS_ARRIMO) / 12 * 1.1, 1)
CALC_CA50_6MM_ARRIMO = WorksheetFunction.Ceiling((CP_CA50_6MM_ESTACAS_ARRIMO + CP_CA50_6MM_SAPATAS_ARRIMO + CP_CA50_6MM_ARRANQUES_ARRIMO + CP_CA50_6MM_BALDRAME_ARRIMO + CP_CA50_6MM_GIGANTE_ARRIMO + CP_CA50_6MM_COLUNAS_ARRIMO + CP_CA50_6MM_VIGAS_ARRIMO) / 12 * 1.1, 1)
CALC_CA50_8MM_ARRIMO = WorksheetFunction.Ceiling((CP_CA50_8MM_ESTACAS_ARRIMO + CP_CA50_8MM_SAPATAS_ARRIMO + CP_CA50_8MM_ARRANQUES_ARRIMO + CP_CA50_8MM_BALDRAME_ARRIMO + CP_CA50_8MM_GIGANTE_ARRIMO + CP_CA50_8MM_COLUNAS_ARRIMO + CP_CA50_8MM_VIGAS_ARRIMO) / 12 * 1.1, 1)
CALC_CA50_10MM_ARRIMO = WorksheetFunction.Ceiling((CP_CA50_10MM_ESTACAS_ARRIMO + CP_CA50_10MM_SAPATAS_ARRIMO + CP_CA50_10MM_ARRANQUES_ARRIMO + CP_CA50_10MM_BALDRAME_ARRIMO + CP_CA50_10MM_GIGANTE_ARRIMO + CP_CA50_10MM_COLUNAS_ARRIMO + CP_CA50_10MM_VIGAS_ARRIMO) / 12 * 1.1, 1)
CALC_CA50_12MM_ARRIMO = WorksheetFunction.Ceiling((CP_CA50_12MM_ESTACAS_ARRIMO + CP_CA50_12MM_SAPATAS_ARRIMO + CP_CA50_12MM_ARRANQUES_ARRIMO + CP_CA50_12MM_BALDRAME_ARRIMO + CP_CA50_12MM_GIGANTE_ARRIMO + CP_CA50_12MM_COLUNAS_ARRIMO + CP_CA50_12MM_VIGAS_ARRIMO) / 12 * 1.1, 1)
CALC_CA50_16MM_ARRIMO = WorksheetFunction.Ceiling((CP_CA50_16MM_ESTACAS_ARRIMO + CP_CA50_16MM_SAPATAS_ARRIMO + CP_CA50_16MM_ARRANQUES_ARRIMO + CP_CA50_16MM_BALDRAME_ARRIMO + CP_CA50_16MM_GIGANTE_ARRIMO + CP_CA50_16MM_COLUNAS_ARRIMO + CP_CA50_16MM_VIGAS_ARRIMO) / 12 * 1.1, 1)
CALC_CA60_5MM_ARRIMO = WorksheetFunction.Ceiling((CP_CA60_5MM_ESTACAS_ARRIMO + CP_CA60_5MM_SAPATAS_ARRIMO + CP_CA60_5MM_ARRANQUES_ARRIMO + CP_CA60_5MM_BALDRAME_ARRIMO + CP_CA60_5MM_GIGANTE_ARRIMO + CP_CA60_5MM_COLUNAS_ARRIMO + CP_CA60_5MM_VIGAS_ARRIMO) / 12 * 1.1, 1)
CALC_CONCR_ARRIMO = WorksheetFunction.Ceiling((CP_CONCR_ESTACAS_ARRIMO + CP_CONCR_SAPATAS_ARRIMO + CP_CONCR_ARRANQUES_ARRIMO + CP_CONCR_BALDRAME_ARRIMO + CP_CONCR_GIGANTE_ARRIMO + CP_CONCR_COLUNAS_ARRIMO + CP_CONCR_VIGAS_ARRIMO) * 1.1, 1)

CALC_PESO_FERRO_ARRIMO = ((CALC_CA60_4MM_ARRIMO * PESO_CA60_4MM) + (CALC_CA50_5MM_ARRIMO * PESO_CA50_5MM) + (CALC_CA50_6MM_ARRIMO * PESO_CA50_6MM) + (CALC_CA50_8MM_ARRIMO * PESO_CA50_8MM) _
                        + (CALC_CA50_10MM_ARRIMO * PESO_CA50_10MM) + (CALC_CA50_12MM_ARRIMO * PESO_CA50_12MM) _
                        + (CALC_CA50_16MM_ARRIMO * PESO_CA50_16MM) + (CALC_CA60_5MM_ARRIMO * PESO_CA60_5MM))

CALC_DISCO_FERRO_ARRIMO = WorksheetFunction.Ceiling(CALC_PESO_FERRO_ARRIMO * 0.01, 1)
CALC_ARAME_ARRIMO = WorksheetFunction.Ceiling(CALC_PESO_FERRO_ARRIMO * 0.06, 1)
CALC_PREGO_18X27_ARRIMO = WorksheetFunction.Ceiling(0.55 * CALC_ARAME_ARRIMO, 1)
CALC_VEDATOP_ARRIMO = WorksheetFunction.Ceiling(((CP_ALTURA_ARRIMO * CP_COMPRIMENTO_ARRIMO) * 3 * 1.1) / 18, 1)

CALC_TABUAS_30_ARRIMO_TOTAL = CALC_TABUAS_30_ARRIMO + CALC_TABUAS_30_COLUN_ARRIMO
CALC_SARRAFO_5_ARRIMO_TOTAL = CALC_SARRAFO_5_ARRIMO + CALC_SARRAFO_5_COLUN_ARRIMO


'INSERINDO NA PLANILHA


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CIMENTO_FINA_ASSENT_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Sacos de cimento 50kg"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Assentamento"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_CIMENTO_FINA_ASSENT_ARRIMO
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_AREIA_FINA_ASSENT_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Areia fina"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Assentamento"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_AREIA_FINA_ASSENT_ARRIMO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PERFURACAO_ESTACAS_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Maquinário - Perfuração"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Perfuração"
Range("F" & PLIN).Value = "Mts"
Range("G" & PLIN).Value = CALC_PERFURACAO_ESTACAS_ARRIMO
End If




PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TABUAS_15_COLUN_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Madeira Caixaria - Tábuas de 20cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Caixaria"
Range("F" & PLIN).Value = "Barras 3 mts"
Range("G" & PLIN).Value = CALC_TABUAS_15_COLUN_ARRIMO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TABUAS_20_COLUN_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Madeira Caixaria - Tábuas de 25cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Caixaria"
Range("F" & PLIN).Value = "Barras 3 mts"
Range("G" & PLIN).Value = CALC_TABUAS_20_COLUN_ARRIMO
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TABUAS_30_ARRIMO_TOTAL <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Madeira Caixaria - Tábuas de 30cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Caixaria"
Range("F" & PLIN).Value = "Barras 3mts"
Range("G" & PLIN).Value = CALC_TABUAS_30_ARRIMO_TOTAL
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_SARRAFO_5_ARRIMO_TOTAL <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Madeira Caixaria - Sarrafos de 05cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Caixaria"
Range("F" & PLIN).Value = "Barras 3mts"
Range("G" & PLIN).Value = CALC_SARRAFO_5_ARRIMO_TOTAL
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_MADERITES_COLUN_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Madeira Caixaria - Madeirite Plastif. Preto 2,10x1,10mts 18mm"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Caixaria"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_MADERITES_COLUN_ARRIMO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_DISCO_FERRO_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Disco Ferro"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_DISCO_FERRO_ARRIMO
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_ARAME_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Aço - Arame Recozido"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "KG"
Range("G" & PLIN).Value = CALC_ARAME_ARRIMO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PREGO_18X27_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Aço - Pregos 18x27"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Caixaria"
Range("F" & PLIN).Value = "KG"
Range("G" & PLIN).Value = CALC_PREGO_18X27_ARRIMO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA60_4MM_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Aço - Barras de CA60 4.2mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA60_4MM_ARRIMO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_5MM_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Aço - Barras de CA50 5.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_5MM_ARRIMO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_6MM_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Aço - Barras de CA50 6.3mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_6MM_ARRIMO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_8MM_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Aço - Barras de CA50 8.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_8MM_ARRIMO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_10MM_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Aço - Barras de CA50 10.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_10MM_ARRIMO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_12MM_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Aço - Barras de CA50 12.5mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_12MM_ARRIMO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_16MM_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Aço - Barras de CA50 16mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_16MM_ARRIMO
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA60_5MM_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Aço - Barras de CA60 5.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA60_5MM_ARRIMO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CONCR_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = CP_RESISTENCIA_CONCRETO_ARRIMO
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_CONCR_ARRIMO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_VEDATOP_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Impermeabilizantes - Vedatop 18KG"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Impermeabilização"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_VEDATOP_ARRIMO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TIJOLOS_8F_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Cerâmicas - Tijolo - Bloco 8 Furos"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Paredes"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_TIJOLOS_8F_ARRIMO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_VEDALIT_FINA_ASSENT_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_MURO_ARRIMO
Range("B" & PLIN).Value = "Impermeabilizantes - Vedalit 18L"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Muro Arrimo"
Range("E" & PLIN).Value = "Paredes"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_VEDALIT_FINA_ASSENT_ARRIMO
End If


End Sub

