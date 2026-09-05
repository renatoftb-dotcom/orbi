Attribute VB_Name = "J_SUPRA_COBERTURA"

'FORMULAS

Dim CALC_TÁBUAS_20_COLUNA_COBERTURA_EDIF As Double
Dim CALC_TÁBUAS_25_COLUNA_COBERTURA_EDIF As Double
Dim CALC_TÁBUAS_30_COLUNA_COBERTURA_EDIF As Double
Dim CALC_MADERITES_COLUNA_COBERTURA_EDIF As Double


Dim CALC_CA50_5MM_VIGA_COLUNA_COBERTURA_EDIF As Double
Dim CALC_CA50_6MM_VIGA_COLUNA_COBERTURA_EDIF As Double
Dim CALC_CA50_8MM_VIGA_COLUNA_COBERTURA_EDIF As Double
Dim CALC_CA50_10MM_VIGA_COLUNA_COBERTURA_EDIF As Double
Dim CALC_CA50_12MM_VIGA_COLUNA_COBERTURA_EDIF As Double
Dim CALC_CA50_16MM_VIGA_COLUNA_COBERTURA_EDIF As Double
Dim CALC_CA60_5MM_VIGA_COLUNA_COBERTURA_EDIF As Double
Dim CALC_PESO_FERRO_VIGA_COLUNA_COBERTURA_EDIF As Double
Dim CALC_ARAME_VIGA_COLUNA_COBERTURA_EDIF As Double
Dim CALC_PREGO_18X27_VIGA_COLUNA_COBERTURA_EDIF As Double
Dim CALC_VOLUME_CONCRETO_VIGA_COLUNA_RESPALDO_COBERTURA_EDIF As Double
Dim CALC_AREIA_GROSSA_COLUNAS_VIGAS_COBERTURA_EDIF As Double
Dim CALC_PEDRA_COLUNAS_VIGAS_COBERTURA_EDIF As Double
Dim CALC_CIMENTO_COLUNAS_VIGAS_COBERTURA_EDIF As Double
Dim CALC_SARRAFO_5_COLUN_COBERTURA_EDIF As Double


Sub SUPRA_COBERTURA()


'Call DECLARAR_VARIAVEIS


Windows("NOVO MODELO ORÇAMENTO.xlsm").Activate

Sheets("RESUMO").Select


'FORMULAS

CALC_CA50_5MM_VIGA_COLUNA_COBERTURA_EDIF = WorksheetFunction.Ceiling((CP_CA50_5MM_VIGA_COBERTURA_EDIF + CP_CA50_5MM_COLUNA_COBERTURA_EDIF) / 12 * 1.1, 1)
CALC_CA50_6MM_VIGA_COLUNA_COBERTURA_EDIF = WorksheetFunction.Ceiling((CP_CA50_6MM_VIGA_COBERTURA_EDIF + CP_CA50_6MM_COLUNA_COBERTURA_EDIF) / 12 * 1.1, 1)
CALC_CA50_8MM_VIGA_COLUNA_COBERTURA_EDIF = WorksheetFunction.Ceiling((CP_CA50_8MM_VIGA_COBERTURA_EDIF + CP_CA50_8MM_COLUNA_COBERTURA_EDIF) / 12 * 1.1, 1)
CALC_CA50_10MM_VIGA_COLUNA_COBERTURA_EDIF = WorksheetFunction.Ceiling((CP_CA50_10MM_VIGA_COBERTURA_EDIF + CP_CA50_10MM_COLUNA_COBERTURA_EDIF) / 12 * 1.1, 1)
CALC_CA50_12MM_VIGA_COLUNA_COBERTURA_EDIF = WorksheetFunction.Ceiling((CP_CA50_12MM_VIGA_COBERTURA_EDIF + CP_CA50_12MM_COLUNA_COBERTURA_EDIF) / 12 * 1.1, 1)
CALC_CA50_16MM_VIGA_COLUNA_COBERTURA_EDIF = WorksheetFunction.Ceiling((CP_CA50_16MM_VIGA_COBERTURA_EDIF + CP_CA50_16MM_COLUNA_COBERTURA_EDIF) / 12 * 1.1, 1)
CALC_CA60_5MM_VIGA_COLUNA_COBERTURA_EDIF = WorksheetFunction.Ceiling((CP_CA60_5MM_VIGA_COBERTURA_EDIF + CP_CA60_5MM_COLUNA_COBERTURA_EDIF) / 12 * 1.1, 1)



CALC_PESO_FERRO_VIGA_COLUNA_COBERTURA_EDIF = ((CALC_CA50_5MM_VIGA_COLUNA_COBERTURA_EDIF * PESO_CA50_5MM) + (CALC_CA50_6MM_VIGA_COLUNA_COBERTURA_EDIF * PESO_CA50_6MM) + (CALC_CA50_8MM_VIGA_COLUNA_COBERTURA_EDIF * PESO_CA50_8MM) _
                        + (CALC_CA50_10MM_VIGA_COLUNA_COBERTURA_EDIF * PESO_CA50_10MM) + (CALC_CA50_12MM_VIGA_COLUNA_COBERTURA_EDIF * PESO_CA50_12MM) _
                        + (CALC_CA50_16MM_VIGA_COLUNA_COBERTURA_EDIF * PESO_CA50_16MM) + (CALC_CA60_5MM_VIGA_COLUNA_COBERTURA_EDIF * PESO_CA60_5MM))

CALC_ARAME_VIGA_COLUNA_COBERTURA_EDIF = WorksheetFunction.Ceiling(CALC_PESO_FERRO_VIGA_COLUNA_COBERTURA_EDIF * 0.06 * 1.1, 1)

CALC_PREGO_18X27_VIGA_COLUNA_COBERTURA_EDIF = WorksheetFunction.Ceiling(CALC_ARAME_VIGA_COLUNA_COBERTURA_EDIF * 0.55, 1)

CALC_VOLUME_CONCRETO_VIGA_COLUNA_RESPALDO_COBERTURA_EDIF = CP_VOLUME_CONCRETO_COLUNA_RESPALDO_COBERTURA_EDIF + CP_VOLUME_CONCRETO_VIGA_RESPALDO_COBERTURA_EDIF

CALC_AREIA_GROSSA_COLUNAS_VIGAS_COBERTURA_EDIF = WorksheetFunction.Ceiling(CALC_VOLUME_CONCRETO_VIGA_COLUNA_RESPALDO_COBERTURA_EDIF * 0.6 * 1.1, 1)
CALC_PEDRA_COLUNAS_VIGAS_COBERTURA_EDIF = WorksheetFunction.Ceiling(CALC_VOLUME_CONCRETO_VIGA_COLUNA_RESPALDO_COBERTURA_EDIF * 1.1, 1)
CALC_CIMENTO_COLUNAS_VIGAS_COBERTURA_EDIF = WorksheetFunction.Ceiling(CALC_PEDRA_COLUNAS_VIGAS_COBERTURA_EDIF * 6 * 1.1, 1)


CALC_TÁBUAS_20_COLUNAS_COBERTURA_EDIF = WorksheetFunction.Ceiling(CP_COLUNAS_15_COBERTURA_EDIF * 0.6 * 2 / 3 * 1.1, 1)
CALC_TÁBUAS_25_COLUNAS_COBERTURA_EDIF = WorksheetFunction.Ceiling(CP_COLUNAS_20_COBERTURA_EDIF * 0.6 * 2 / 3 * 1.1, 1)
CALC_TÁBUAS_30_COLUNAS_COBERTURA_EDIF = WorksheetFunction.Ceiling(((CP_COLUNAS_25_COBERTURA_EDIF * 0.6 * 2) + (CP_PERIMETRO_LOJE_PAV_1_EDIF * 2)) / 3 * 1.1, 1)
CALC_MADERITES_COLUNA_COBERTURA_EDIF = WorksheetFunction.Ceiling(CP_AREA_FORMA_COLUNA_COBERTURA_MAIOR_25CM / 2.42 * 1.1, 1)

CALC_SARRAFO_5_COLUN_COBERTURA_EDIF = WorksheetFunction.Ceiling(((CP_COLUNAS_15_COBERTURA_EDIF * 0.6 * 2 / 0.5 * 0.2) _
                                   + (CP_COLUNAS_20_COBERTURA_EDIF * 0.6 * 2 / 0.5 * 0.25) + (CP_COLUNAS_25_COBERTURA_EDIF * 0.6 * 2 / 0.5 * 0.35) _
                                   + (CP_PERIMETRO_LOJE_PAV_1_EDIF * 2 / 0.7 * 0.45) + (CP_PERIMETRO_LOJE_PAV_1_EDIF / 0.75 * 0.3)) * 1.1 / 3, 1)





'INSERINDO NA PLANILHA

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_5MM_VIGA_COLUNA_COBERTURA_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_SUPRA_COBERTURA
Range("B" & PLIN).Value = "Aço - Barras de CA50 5.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra Cobertura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_5MM_VIGA_COLUNA_COBERTURA_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_6MM_VIGA_COLUNA_COBERTURA_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_SUPRA_COBERTURA
Range("B" & PLIN).Value = "Aço - Barras de CA50 6.3mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra Cobertura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_6MM_VIGA_COLUNA_COBERTURA_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1


If CALC_CA50_8MM_VIGA_COLUNA_COBERTURA_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_SUPRA_COBERTURA
Range("B" & PLIN).Value = "Aço - Barras de CA50 8.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra Cobertura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_8MM_VIGA_COLUNA_COBERTURA_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1


If CALC_CA50_10MM_VIGA_COLUNA_COBERTURA_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_SUPRA_COBERTURA
Range("B" & PLIN).Value = "Aço - Barras de CA50 10.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra Cobertura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_10MM_VIGA_COLUNA_COBERTURA_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1


If CALC_CA50_12MM_VIGA_COLUNA_COBERTURA_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_SUPRA_COBERTURA
Range("B" & PLIN).Value = "Aço - Barras de CA50 12.5mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra Cobertura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_12MM_VIGA_COLUNA_COBERTURA_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1


If CALC_CA50_16MM_VIGA_COLUNA_COBERTURA_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_SUPRA_COBERTURA
Range("B" & PLIN).Value = "Aço - Barras de CA50 16mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra Cobertura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_16MM_VIGA_COLUNA_COBERTURA_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1


If CALC_CA60_5MM_VIGA_COLUNA_COBERTURA_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_SUPRA_COBERTURA
Range("B" & PLIN).Value = "Aço - Barras de CA60 5.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra Cobertura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA60_5MM_VIGA_COLUNA_COBERTURA_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_ARAME_VIGA_COLUNA_COBERTURA_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_SUPRA_COBERTURA
Range("B" & PLIN).Value = "Aço - Arame Recozido"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra Cobertura"
Range("F" & PLIN).Value = "KG"
Range("G" & PLIN).Value = CALC_ARAME_VIGA_COLUNA_COBERTURA_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1


If CALC_PREGO_18X27_VIGA_COLUNA_COBERTURA_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_SUPRA_COBERTURA
Range("B" & PLIN).Value = "Aço - Pregos 18x27"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra Cobertura"
Range("F" & PLIN).Value = "KG"
Range("G" & PLIN).Value = CALC_PREGO_18X27_VIGA_COLUNA_COBERTURA_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1


If CALC_AREIA_GROSSA_COLUNAS_VIGAS_COBERTURA_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_SUPRA_COBERTURA
Range("B" & PLIN).Value = "Areia Grossa"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra Cobertura"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_AREIA_GROSSA_COLUNAS_VIGAS_COBERTURA_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1


If CALC_PEDRA_COLUNAS_VIGAS_COBERTURA_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_SUPRA_COBERTURA
Range("B" & PLIN).Value = "Pedra"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra Cobertura"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_PEDRA_COLUNAS_VIGAS_COBERTURA_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1


If CALC_CIMENTO_COLUNAS_VIGAS_COBERTURA_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_SUPRA_COBERTURA
Range("B" & PLIN).Value = "Sacos de cimento 50kg"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra Cobertura"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_CIMENTO_COLUNAS_VIGAS_COBERTURA_EDIF
End If



PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TÁBUAS_20_COLUNAS_COBERTURA_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_SUPRA_COBERTURA
Range("B" & PLIN).Value = "Madeira Caixaria - Tábuas de 20cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra Cobertura"
Range("F" & PLIN).Value = "Barras 3 mts"
Range("G" & PLIN).Value = CALC_TÁBUAS_20_COLUNAS_COBERTURA_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TÁBUAS_25_COLUNAS_COBERTURA_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_SUPRA_COBERTURA
Range("B" & PLIN).Value = "Madeira Caixaria - Tábuas de 25cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra Cobertura"
Range("F" & PLIN).Value = "Barras 3 mts"
Range("G" & PLIN).Value = CALC_TÁBUAS_25_COLUNAS_COBERTURA_EDIF
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TÁBUAS_30_COLUNAS_COBERTURA_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_SUPRA_COBERTURA
Range("B" & PLIN).Value = "Madeira Caixaria - Tábuas de 30cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra Cobertura"
Range("F" & PLIN).Value = "Barras 3 mts"
Range("G" & PLIN).Value = CALC_TÁBUAS_30_COLUNAS_COBERTURA_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_SARRAFO_5_COLUN_COBERTURA_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_SUPRA_COBERTURA
Range("B" & PLIN).Value = "Madeira Caixaria - Sarrafos de 05cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra Cobertura"
Range("F" & PLIN).Value = "Barras 3 mts"
Range("G" & PLIN).Value = CALC_SARRAFO_5_COLUN_COBERTURA_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_MADERITES_COLUNA_COBERTURA_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_SUPRA_COBERTURA
Range("B" & PLIN).Value = "Madeira Caixaria - Madeirite Plastif. Preto 2,10x1,10mts 18mm"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Supra estrutura e paredes"
Range("E" & PLIN).Value = "Supra Cobertura"
Range("F" & PLIN).Value = "Unidade"
Range("G" & PLIN).Value = CALC_MADERITES_COLUNA_COBERTURA_EDIF
End If

End Sub
