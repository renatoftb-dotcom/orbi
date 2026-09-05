Attribute VB_Name = "N_CONTRAPISOS_EXTERNOS"
Dim CALC_AREIA_GROSSA As Double
Dim CALC_PEDRA As Double
Dim CALC_CIMENTO As Double
Dim CALC_MALHA_POP As Double
Dim CALC_CIMENTO_MASSIAM_CP_EXTERNO As Double
Dim CALC_AREIA_GROSSA_MASSIAM_CP_EXTERNO As Double
Dim CALC_BIANCO_MASSIAM_CP_EXTERNO As Double
Dim CALC_TABUA_20 As Double
Dim CALC_SARRAFO_5 As Double






Sub CONTRAPISOS_EXTERNOS()


'FORMULAS

'CONTRAPISO
CALC_AREIA_GROSSA = WorksheetFunction.Ceiling(CP_PAVIMENTACAO_EXTERNA * 0.6 * 0.1 * 1.1, 1)
CALC_PEDRA = CP_PAVIMENTACAO_EXTERNA * 0.1 * 1.1
CALC_CIMENTO = WorksheetFunction.Ceiling(CALC_PEDRA * 6 * 1.1, 1)
CALC_MALHA_POP = WorksheetFunction.Ceiling((CP_PAVIMENTACAO_EXTERNA / (2.9 * 1.9)) * 1.1, 1)
CALC_TABUA_20 = WorksheetFunction.Ceiling(CP_PERIMETRO_PAV_EXTERNA / 3 * 1.1, 1)
CALC_SARRAFO_5 = WorksheetFunction.Ceiling(CP_PERIMETRO_PAV_EXTERNA / 0.7 * 0.3 / 3 * 1.1, 1)

'MASSIAMENTO
CALC_CIMENTO_MASSIAM_CP_EXTERNO = WorksheetFunction.Ceiling(CP_PAVIMENTACAO_EXTERNA * 0.05 * 0.25 * 1200 / 50 * 1.1, 1)
CALC_AREIA_GROSSA_MASSIAM_CP_EXTERNO = WorksheetFunction.Ceiling(CP_PAVIMENTACAO_EXTERNA * 0.05 * 0.75 * 1.1, 1)
CALC_BIANCO_MASSIAM_CP_EXTERNO = WorksheetFunction.Ceiling(CP_PAVIMENTACAO_EXTERNA / 60 * 1.1, 1)


'INSERIANDO NA PLANILHA

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_AREIA_GROSSA <> 0 Or CALC_AREIA_GROSSA <> 0 Then
Range("a" & PLIN).Value = ORD_CONTRAPISO_EXTERNO
Range("B" & PLIN).Value = "Areia Grossa"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Contrapisos Externos"
Range("E" & PLIN).Value = "Concretagem"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_AREIA_GROSSA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PEDRA <> 0 Then
Range("a" & PLIN).Value = ORD_CONTRAPISO_EXTERNO
Range("B" & PLIN).Value = "Pedra"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Contrapisos Externos"
Range("E" & PLIN).Value = "Concretagem"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_PEDRA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CIMENTO <> 0 Or CALC_CIMENTO <> 0 Then
Range("a" & PLIN).Value = ORD_CONTRAPISO_EXTERNO
Range("B" & PLIN).Value = "Sacos de cimento 50kg"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Contrapisos Externos"
Range("E" & PLIN).Value = "Concretagem"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_CIMENTO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_MALHA_POP <> 0 Or CALC_MALHA_POP <> 0 Then
Range("a" & PLIN).Value = ORD_CONTRAPISO_EXTERNO
Range("B" & PLIN).Value = "Aço - Malha Pop EQ061 3.4mm 15x15"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Contrapisos Externos"
Range("E" & PLIN).Value = "Concretagem"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_MALHA_POP
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TABUA_20 <> 0 Then
Range("a" & PLIN).Value = ORD_CONTRAPISO_EXTERNO
Range("B" & PLIN).Value = "Madeira Caixaria - Tábuas de 20cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Contrapisos Externos"
Range("E" & PLIN).Value = "Caixaria"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_TABUA_20
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_SARRAFO_5 <> 0 Then
Range("a" & PLIN).Value = ORD_CONTRAPISO_EXTERNO
Range("B" & PLIN).Value = "Madeira Caixaria - Sarrafos de 05cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Contrapisos Externos"
Range("E" & PLIN).Value = "Caixaria"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_SARRAFO_5
End If

'MASSIAMENTO
PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CIMENTO_MASSIAM_CP_EXTERNO <> 0 Then
Range("a" & PLIN).Value = ORD_CONTRAPISO_EXTERNO
Range("B" & PLIN).Value = "Sacos de cimento 50kg"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Contrapisos Externos"
Range("E" & PLIN).Value = "Contrapisos Externos Massiamento"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_CIMENTO_MASSIAM_CP_EXTERNO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_AREIA_GROSSA_MASSIAM_CP_EXTERNO <> 0 Then
Range("a" & PLIN).Value = ORD_CONTRAPISO_EXTERNO
Range("B" & PLIN).Value = "Areia Grossa"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Contrapisos Externos"
Range("E" & PLIN).Value = "Contrapisos Externos Massiamento"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_AREIA_GROSSA_MASSIAM_CP_EXTERNO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_BIANCO_MASSIAM_CP_EXTERNO <> 0 Then
Range("a" & PLIN).Value = ORD_CONTRAPISO_EXTERNO
Range("B" & PLIN).Value = "Impermeabilizantes - Bianco 18KG"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Contrapisos Externos"
Range("E" & PLIN).Value = "Contrapisos Externos Massiamento"
Range("F" & PLIN).Value = "Unidade"
Range("G" & PLIN).Value = CALC_BIANCO_MASSIAM_CP_EXTERNO
End If

End Sub
