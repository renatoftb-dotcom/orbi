Attribute VB_Name = "I_VIGA_RESPALDO_LAJE_PAV_1"

'QUANTIDADES FIXAS
Dim QTD_BOMBA_CONCRET_VIGA_LAJE_PAV_1 As Double

'FORMULAS

Dim CALC_TÁBUAS_25_VIGAS_PAV_1_EDIF As Double
Dim CALC_TÁBUAS_30_VIGAS_RESPALDO_PAV_1_EDIF As Double

Dim CALC_CA50_5MM_VIGA_RESPALDO_PAV_1_EDIF As Double
Dim CALC_CA50_6MM_VIGA_RESPALDO_PAV_1_EDIF As Double
Dim CALC_CA50_8MM_VIGA_RESPALDO_PAV_1_EDIF As Double
Dim CALC_CA50_10MM_VIGA_RESPALDO_PAV_1_EDIF As Double
Dim CALC_CA50_12MM_VIGA_RESPALDO_PAV_1_EDIF As Double
Dim CALC_CA50_16MM_VIGA_RESPALDO_PAV_1_EDIF As Double
Dim CALC_CA60_5MM_VIGA_RESPALDO_PAV_1_EDIF As Double
Dim CALC_PESO_FERRO_VIGA_RESPALDO_PAV_1_EDIF As Double
Dim CALC_ARAME_VIGA_RESPALDO_PAV_1_EDIF As Double
Dim CALC_MALHA_POP_LOJE_PAV_1_EDIF As Double
Dim CALC_TIPO_LOJE_PAV_1_EDIF As String
Dim CALC_NOME_MODELO_LOJE_PAV_1_EDIF As String
Dim CALC_QTD_LOJE_PAV_1_EDIF As Double
Dim CALC_QTD_ESCORAS_PAV_1_EDIF As Double
Dim CALC_LOJE_MACICA_PAV_1_EDIF As Double
Dim CALC_MADERITE_LOJE_MACICA_PAV_1_EDIF As Double
Dim CALC_ESCORAS_LOJE_MACICA_PAV_1_EDIF As Double
Dim CALC_SARRAFO_5_VIGA_RESPALDO_PAV_1_EDIF As Double
Dim CALC_TÁBUAS_10_VIGAS_RESPALDO_PAV_1_EDIF As Double


'MASSIAMENTO
Dim CALC_CIMENTO_MASSIAM_INT_PAV_1_EDIF As Double
Dim CALC_AREIA_GROSSA_MASSIAM_INT_PAV_1_EDIF As Double
Dim CALC_BIANCO_MASSIAM_INT_PAV_1_EDIF As Double






Sub VIGA_RESPALDO_LAJE_PAV_1()



Call DECLARAR_VARIAVEIS
Call ATUALIZAR_CAMPOS


Windows("NOVO MODELO ORÇAMENTO.xlsm").Activate

Sheets("RESUMO").Select


'QUANTIDADES FIXAS

QTD_BOMBA_CONCRET_VIGA_LOJE_PAV_1 = 1


'FORMULAS

CALC_TÁBUAS_10_VIGAS_RESPALDO_PAV_1_EDIF = WorksheetFunction.Ceiling(((((CP_PERIMETRO_LOJE_PAV_1_EDIF) * 2 / 3) _
                                   + (CP_PERIMETRO_LOJE_PAV_1_EDIF) * 2 / 3 * 0.45 / 3)) * 1.1, 1)

CALC_TÁBUAS_30_VIGAS_RESPALDO_PAV_1_EDIF = WorksheetFunction.Ceiling(((((CP_PERIMETRO_PAREDES_PAV_1_EDIF) * 2 / 3) _
                                   + (CP_PERIMETRO_PAREDES_PAV_1_EDIF) * 2 / 3 * 0.45 / 3)) * 1.1, 1)
                                   
                                   
CALC_SARRAFO_5_VIGA_RESPALDO_PAV_1_EDIF = WorksheetFunction.Ceiling(((CP_PERIMETRO_PAREDES_PAV_1_EDIF * 2 / 0.7 * 0.45) _
                                 + (CP_PERIMETRO_PAREDES_PAV_1_EDIF / 0.75 * 0.3)) / 3 * 1.1, 1)


CALC_CA50_5MM_VIGA_RESPALDO_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_CA50_5MM_VIGA_RESPALDO_PAV_1_EDIF / 12 * 1.1, 1)
CALC_CA50_6MM_VIGA_RESPALDO_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_CA50_6MM_VIGA_RESPALDO_PAV_1_EDIF / 12 * 1.1, 1)
CALC_CA50_8MM_VIGA_RESPALDO_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_CA50_8MM_VIGA_RESPALDO_PAV_1_EDIF / 12 * 1.1, 1)
CALC_CA50_10MM_VIGA_RESPALDO_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_CA50_10MM_VIGA_RESPALDO_PAV_1_EDIF / 12 * 1.1, 1)
CALC_CA50_12MM_VIGA_RESPALDO_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_CA50_12MM_VIGA_RESPALDO_PAV_1_EDIF / 12 * 1.1, 1)
CALC_CA50_16MM_VIGA_RESPALDO_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_CA50_16MM_VIGA_RESPALDO_PAV_1_EDIF / 12 * 1.1, 1)
CALC_CA60_5MM_VIGA_RESPALDO_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_CA60_5MM_VIGA_RESPALDO_PAV_1_EDIF / 12 * 1.1, 1)

CALC_PESO_FERRO_VIGA_RESPALDO_PAV_1_EDIF = ((CALC_CA50_5MM_VIGA_RESPALDO_PAV_1_EDIF * PESO_CA50_5MM) + (CALC_CA50_6MM_VIGA_RESPALDO_PAV_1_EDIF * PESO_CA50_6MM) + (CALC_CA50_8MM_VIGA_RESPALDO_PAV_1_EDIF * PESO_CA50_8MM) _
                        + (CALC_CA50_10MM_VIGA_RESPALDO_PAV_1_EDIF * PESO_CA50_10MM) + (CALC_CA50_12MM_VIGA_RESPALDO_PAV_1_EDIF * PESO_CA50_12MM) _
                        + (CALC_CA50_16MM_VIGA_RESPALDO_PAV_1_EDIF * PESO_CA50_16MM) + (CALC_CA60_5MM_VIGA_RESPALDO_PAV_1_EDIF * PESO_CA60_5MM))

CALC_ARAME_VIGA_RESPALDO_PAV_1_EDIF = WorksheetFunction.Ceiling(CALC_PESO_FERRO_VIGA_RESPALDO_PAV_1_EDIF * 0.06 * 1.1, 1)

CALC_PREGO_18X27_VIGA_RESPALDO_PAV_1_EDIF = WorksheetFunction.Ceiling(CALC_ARAME_VIGA_RESPALDO_PAV_1_EDIF * 0.55, 1)

CALC_VOLUME_CONCRETO_LOJE_VIGA_PAV_1_EDIF = WorksheetFunction.Ceiling(((CP_AREA_LOJE_PAV_1_EDIF * 0.1) + (CP_VOLUME_CONCRETO_VIGA_RESPALDO_PAV_1_EDIF)) * 1.1, 1)

CALC_MALHA_POP_LOJE_PAV_1_EDIF = WorksheetFunction.Ceiling((CP_AREA_LOJE_PAV_1_EDIF / (2.9 * 1.9)) * 1.1, 1)

CALC_TIPO_LOJE_PAV_1_EDIF = WorksheetFunction.Concat(CP_TIPOLOGIA_EDIF, CP_TIPO_LOJE_PAV_1_EDIF)


If CALC_TIPO_LOJE_PAV_1_EDIF = "TérreoProtendida" Then
    CALC_NOME_MODELO_LOJE_PAV_1_EDIF = "Laje Pré Moldada Protendida Forro"
    
ElseIf CALC_TIPO_LOJE_PAV_1_EDIF = "SobradoProtendida" Then
    CALC_NOME_MODELO_LOJE_PAV_1_EDIF = "Laje Pré Moldada Protendida Piso"
    
ElseIf CALC_TIPO_LOJE_PAV_1_EDIF = "TérreoTreliça" Then
    CALC_NOME_MODELO_LOJE_PAV_1_EDIF = "Laje Pré Moldada Treliça Forro"
    
ElseIf CALC_TIPO_LOJE_PAV_1_EDIF = "SobradoTreliça" Then
    CALC_NOME_MODELO_LOJE_PAV_1_EDIF = "Laje Pré Moldada Treliça Piso"
    
End If

CALC_QTD_LOJE_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_AREA_LOJE_PAV_1_EDIF * 1.1, 1)

If CP_TIPO_LOJE_PAV_1_EDIF = "Protendida" Then
CALC_QTD_ESCORAS_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_AREA_LOJE_PAV_1_EDIF * 0.6 * 1.5 * 1.1, 1)
Else: CALC_QTD_ESCORAS_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_AREA_LOJE_PAV_1_EDIF * 1.5 * 1.1, 1)
End If

CALC_LOJE_MACICA_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_AREA_LOJE_MACICA_PAV_1_EDIF * 0.15 * 1.1, 1)
CALC_MADERITE_LOJE_MACICA_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_AREA_LOJE_MACICA_PAV_1_EDIF / 2.42 * 1.1, 1)
CALC_ESCORAS_LOJE_MACICA_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_AREA_LOJE_MACICA_PAV_1_EDIF * 1.5 * 1.1, 1)


'CÁLCULO MASSIAMENTO
CALC_CIMENTO_MASSIAM_INT_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_AREA_LOJE_TERREO_EDIF * 0.05 * 0.25 * 1200 / 50 * 1.1, 1)
CALC_AREIA_GROSSA_MASSIAM_INT_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_AREA_LOJE_TERREO_EDIF * 0.05 * 0.75 * 1.1, 1)
CALC_BIANCO_MASSIAM_INT_PAV_1_EDIF = WorksheetFunction.Ceiling(CP_AREA_LOJE_TERREO_EDIF / 60 * 1.1, 1)


'INSERINDO NA PLANILHA


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TÁBUAS_10_VIGAS_RESPALDO_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_VIGA_RESPALDO_LAJE_PAV_1
Range("B" & PLIN).Value = "Madeira Caixaria - Tábuas de 10cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Viga Respaldo e Laje"
Range("E" & PLIN).Value = "Viga Respaldo Pav 1"
Range("F" & PLIN).Value = "Barras 3 mts"
Range("G" & PLIN).Value = CALC_TÁBUAS_10_VIGAS_RESPALDO_PAV_1_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TÁBUAS_30_VIGAS_RESPALDO_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_VIGA_RESPALDO_LAJE_PAV_1
Range("B" & PLIN).Value = "Madeira Caixaria - Tábuas de 30cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Viga Respaldo e Laje"
Range("E" & PLIN).Value = "Viga Respaldo Pav 1"
Range("F" & PLIN).Value = "Barras 3 mts"
Range("G" & PLIN).Value = CALC_TÁBUAS_30_VIGAS_RESPALDO_PAV_1_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_SARRAFO_5_VIGA_RESPALDO_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_VIGA_RESPALDO_LAJE_PAV_1
Range("B" & PLIN).Value = "Madeira Caixaria - Sarrafos de 05cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Viga Respaldo e Laje"
Range("E" & PLIN).Value = "Viga Respaldo Pav 1"
Range("F" & PLIN).Value = "Barras 3 mts"
Range("G" & PLIN).Value = CALC_SARRAFO_5_VIGA_RESPALDO_PAV_1_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_5MM_VIGA_RESPALDO_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_VIGA_RESPALDO_LAJE_PAV_1
Range("B" & PLIN).Value = "Aço - Barras de CA50 5.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Viga Respaldo e Laje"
Range("E" & PLIN).Value = "Viga Respaldo Pav 1"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_5MM_VIGA_RESPALDO_PAV_1_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_6MM_VIGA_RESPALDO_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_VIGA_RESPALDO_LAJE_PAV_1
Range("B" & PLIN).Value = "Aço - Barras de CA50 6.3mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Viga Respaldo e Laje"
Range("E" & PLIN).Value = "Viga Respaldo Pav 1"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_6MM_VIGA_RESPALDO_PAV_1_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_8MM_VIGA_RESPALDO_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_VIGA_RESPALDO_LAJE_PAV_1
Range("B" & PLIN).Value = "Aço - Barras de CA50 8.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Viga Respaldo e Laje"
Range("E" & PLIN).Value = "Viga Respaldo Pav 1"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_8MM_VIGA_RESPALDO_PAV_1_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1


If CALC_CA50_10MM_VIGA_RESPALDO_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_VIGA_RESPALDO_LAJE_PAV_1
Range("B" & PLIN).Value = "Aço - Barras de CA50 10.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Viga Respaldo e Laje"
Range("E" & PLIN).Value = "Viga Respaldo Pav 1"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_10MM_VIGA_RESPALDO_PAV_1_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1


If CALC_CA50_12MM_VIGA_RESPALDO_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_VIGA_RESPALDO_LAJE_PAV_1
Range("B" & PLIN).Value = "Aço - Barras de CA50 12.5mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Viga Respaldo e Laje"
Range("E" & PLIN).Value = "Viga Respaldo Pav 1"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_12MM_VIGA_RESPALDO_PAV_1_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1


If CALC_CA50_16MM_VIGA_RESPALDO_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_VIGA_RESPALDO_LAJE_PAV_1
Range("B" & PLIN).Value = "Aço - Barras de CA50 16mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Viga Respaldo e Laje"
Range("E" & PLIN).Value = "Viga Respaldo Pav 1"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_16MM_VIGA_RESPALDO_PAV_1_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1


If CALC_CA60_5MM_VIGA_RESPALDO_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_VIGA_RESPALDO_LAJE_PAV_1
Range("B" & PLIN).Value = "Aço - Barras de CA60 5.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Viga Respaldo e Laje"
Range("E" & PLIN).Value = "Viga Respaldo Pav 1"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA60_5MM_VIGA_RESPALDO_PAV_1_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1


If CALC_ARAME_VIGA_RESPALDO_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_VIGA_RESPALDO_LAJE_PAV_1
Range("B" & PLIN).Value = "Aço - Arame Recozido"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Viga Respaldo e Laje"
Range("E" & PLIN).Value = "Viga Respaldo Pav 1"
Range("F" & PLIN).Value = "KG"
Range("G" & PLIN).Value = CALC_ARAME_VIGA_RESPALDO_PAV_1_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1


If CALC_PREGO_18X27_VIGA_RESPALDO_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_VIGA_RESPALDO_LAJE_PAV_1
Range("B" & PLIN).Value = "Aço - Pregos 18x27"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Viga Respaldo e Laje"
Range("E" & PLIN).Value = "Viga Respaldo Pav 1"
Range("F" & PLIN).Value = "KG"
Range("G" & PLIN).Value = CALC_PREGO_18X27_VIGA_RESPALDO_PAV_1_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_VOLUME_CONCRETO_LOJE_VIGA_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_VIGA_RESPALDO_LAJE_PAV_1
Range("B" & PLIN).Value = CP_RESIST_CONCRETO_LOJE_PAV_1_EDIF
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Viga Respaldo e Laje"
Range("E" & PLIN).Value = "Laje Pav 1"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_VOLUME_CONCRETO_LOJE_VIGA_PAV_1_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_MALHA_POP_LOJE_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_VIGA_RESPALDO_LAJE_PAV_1
Range("B" & PLIN).Value = "Aço - Malha pop EQ092 4.2mm 15x15"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Viga Respaldo e Laje"
Range("E" & PLIN).Value = "Laje Pav 1"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_MALHA_POP_LOJE_PAV_1_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1


If CALC_QTD_LOJE_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_VIGA_RESPALDO_LAJE_PAV_1
Range("B" & PLIN).Value = CALC_NOME_MODELO_LOJE_PAV_1_EDIF
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Viga Respaldo e Laje"
Range("E" & PLIN).Value = "Laje Pav 1"
Range("F" & PLIN).Value = "m2"
Range("G" & PLIN).Value = CALC_QTD_LOJE_PAV_1_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_QTD_ESCORAS_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_VIGA_RESPALDO_LAJE_PAV_1
Range("B" & PLIN).Value = "Locação Ferramentas - Escoras"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Viga Respaldo e Laje"
Range("E" & PLIN).Value = "Laje Pav 1"
Range("F" & PLIN).Value = "Unidade"
Range("G" & PLIN).Value = CALC_QTD_ESCORAS_PAV_1_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If QTD_BOMBA_CONCRET_VIGA_LOJE_PAV_1 <> 0 Then
Range("a" & PLIN).Value = ORD_VIGA_RESPALDO_LAJE_PAV_1
Range("B" & PLIN).Value = "Concreto - Bomba"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Viga Respaldo e Laje"
Range("E" & PLIN).Value = "Laje Pav 1"
Range("F" & PLIN).Value = "Unidade"
Range("G" & PLIN).Value = QTD_BOMBA_CONCRET_VIGA_LOJE_PAV_1
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_LOJE_MACICA_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_VIGA_RESPALDO_LAJE_PAV_1
Range("B" & PLIN).Value = CP_RESIST_CONCRETO_LOJE_PAV_1_EDIF
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Viga Respaldo e Laje"
Range("E" & PLIN).Value = "Laje Maciça Pav 1"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_LOJE_MACICA_PAV_1_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1


If CALC_MADERITE_LOJE_MACICA_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_VIGA_RESPALDO_LAJE_PAV_1
Range("B" & PLIN).Value = "Madeira Caixaria - Madeirite Plastif. Preto 2,10x1,10mts 18mm"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Viga Respaldo e Laje"
Range("E" & PLIN).Value = "Laje Maciça Pav 1"
Range("F" & PLIN).Value = "Unidade"
Range("G" & PLIN).Value = CALC_MADERITE_LOJE_MACICA_PAV_1_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_ESCORAS_LOJE_MACICA_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_VIGA_RESPALDO_LAJE_PAV_1
Range("B" & PLIN).Value = "Locação Ferramentas - Escoras"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Viga Respaldo e Laje"
Range("E" & PLIN).Value = "Laje Maciça Pav 1"
Range("F" & PLIN).Value = "Unidade"
Range("G" & PLIN).Value = CALC_ESCORAS_LOJE_MACICA_PAV_1_EDIF
End If


'MASSIAMENTO CONTRAPISO PAV 1
PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CIMENTO_MASSIAM_INT_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_CONTRAPISO_INTERNO_TERREO
Range("B" & PLIN).Value = "Sacos de cimento 50kg"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Contrapiso Interno Pav 1"
Range("E" & PLIN).Value = "Massiamento contrap Pav 1"
Range("F" & PLIN).Value = "Unidade"
Range("G" & PLIN).Value = CALC_CIMENTO_MASSIAM_INT_PAV_1_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_AREIA_GROSSA_MASSIAM_INT_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_CONTRAPISO_INTERNO_TERREO
Range("B" & PLIN).Value = "Areia Grossa"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Contrapiso Interno Pav 1"
Range("E" & PLIN).Value = "Massiamento contrap Pav 1"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_AREIA_GROSSA_MASSIAM_INT_PAV_1_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_BIANCO_MASSIAM_INT_PAV_1_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_CONTRAPISO_INTERNO_TERREO
Range("B" & PLIN).Value = "Impermeabilizantes - Bianco 18KG"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Contrapiso Interno Pav 1"
Range("E" & PLIN).Value = "Massiamento contrap Pav 1"
Range("F" & PLIN).Value = "Unidade"
Range("G" & PLIN).Value = CALC_BIANCO_MASSIAM_INT_PAV_1_EDIF
End If



End Sub

