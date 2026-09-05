Attribute VB_Name = "E_CONTRAPISO_INTERNO_TERREO"

'QUANTIDADES FIXAS
Dim QTD_COMPACTADOR_INT_TERREO As Double


'FORMULAS
Dim CALC_AREIA_GROSSA_CONTRAP_INT_TERREO As Double
Dim CALC_PEDRA_CONTRAP_INT_TERREO As Double
Dim CALC_CIMENTO_CONTRAP_INT_TERREO As Double
Dim CALC_MALHA_POP_CONTRAP_INT_TERREO As Double

Dim CALC_AREIA_GROSSA_MASSIAM_INT_TERREO As Double
Dim CALC_CIMENTO_MASSIAM_INT_TERREO As Double
Dim CALC_BIANCO_MASSIAM_INT_TERREO As Double






Sub CONTRAPISO_INTERNO_TERREO()


Windows("NOVO MODELO ORÇAMENTO.xlsm").Activate

Sheets("RESUMO").Select


'QUANTIDADES FIXAS

QTD_COMPACTADOR_INT_TERREO = 2


'FORMULAS


'CONTRAPISO
CALC_AREIA_GROSSA_CONTRAP_INT_TERREO = WorksheetFunction.Ceiling(CP_AREA_M2_TERREO_EDIF * 0.6 * 0.1 * 1.1, 1)
CALC_PEDRA_CONTRAP_INT_TERREO = WorksheetFunction.Ceiling(CP_AREA_M2_TERREO_EDIF * 0.1 * 1.1, 1)
CALC_CIMENTO_CONTRAP_INT_TERREO = WorksheetFunction.Ceiling(CALC_PEDRA_CONTRAP_INT_TERREO * 6 * 1.1, 1)
CALC_MALHA_POP_CONTRAP_INT_TERREO = WorksheetFunction.Ceiling(CP_AREA_M2_TERREO_EDIF / (2.9 * 1.9 * 1.1), 1)

'MASSIAMENTO
CALC_CIMENTO_MASSIAM_INT_TERREO = WorksheetFunction.Ceiling(CP_AREA_M2_TERREO_EDIF * 0.05 * 0.25 * 1200 / 50 * 1.1, 1)
CALC_AREIA_GROSSA_MASSIAM_INT_TERREO = WorksheetFunction.Ceiling(CP_AREA_M2_TERREO_EDIF * 0.05 * 0.75 * 1.1, 1)
CALC_BIANCO_MASSIAM_INT_TERREO = WorksheetFunction.Ceiling(CP_AREA_M2_TERREO_EDIF / 60 * 1.1, 1)



'CONTRAPISO
PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1


If QTD_COMPACTADOR_INT_TERREO <> 0 Then
Range("a" & PLIN).Value = ORD_CONTRAPISO_INTERNO_TERREO
Range("B" & PLIN).Value = "Locação Ferramentas -  Compactador"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Contrapiso Interno"
Range("E" & PLIN).Value = "Contrapiso Interno Pav. Térreo"
Range("F" & PLIN).Value = "Dias"
Range("G" & PLIN).Value = QTD_COMPACTADOR_INT_TERREO
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_AREIA_GROSSA_CONTRAP_INT_TERREO <> 0 Then
Range("a" & PLIN).Value = ORD_CONTRAPISO_INTERNO_TERREO
Range("B" & PLIN).Value = "Areia Grossa"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Contrapiso Interno"
Range("E" & PLIN).Value = "Contrapiso Interno Pav. Térreo"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_AREIA_GROSSA_CONTRAP_INT_TERREO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PEDRA_CONTRAP_INT_TERREO <> 0 Then
Range("a" & PLIN).Value = ORD_CONTRAPISO_INTERNO_TERREO
Range("B" & PLIN).Value = "Pedra"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Contrapiso Interno"
Range("E" & PLIN).Value = "Contrapiso Interno Pav. Térreo"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_PEDRA_CONTRAP_INT_TERREO
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CIMENTO_CONTRAP_INT_TERREO <> 0 Then
Range("a" & PLIN).Value = ORD_CONTRAPISO_INTERNO_TERREO
Range("B" & PLIN).Value = "Sacos de cimento 50kg"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Contrapiso Interno"
Range("E" & PLIN).Value = "Contrapiso Interno Pav. Térreo"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_CIMENTO_CONTRAP_INT_TERREO
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_MALHA_POP_CONTRAP_INT_TERREO <> 0 Then
Range("a" & PLIN).Value = ORD_CONTRAPISO_INTERNO_TERREO
Range("B" & PLIN).Value = "Aço - Malha Pop EQ061 3.4mm 15x15"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Contrapiso Interno"
Range("E" & PLIN).Value = "Contrapiso Interno Pav. Térreo"
Range("F" & PLIN).Value = "Unidade"
Range("G" & PLIN).Value = CALC_MALHA_POP_CONTRAP_INT_TERREO
End If



'MASSIAMENTO
PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CIMENTO_MASSIAM_INT_TERREO <> 0 Then
Range("a" & PLIN).Value = ORD_CONTRAPISO_INTERNO_TERREO
Range("B" & PLIN).Value = "Sacos de cimento 50kg"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Contrapiso Interno"
Range("E" & PLIN).Value = "Massiamento contrap Pav. Térreo"
Range("F" & PLIN).Value = "Unidade"
Range("G" & PLIN).Value = CALC_CIMENTO_MASSIAM_INT_TERREO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_AREIA_GROSSA_MASSIAM_INT_TERREO <> 0 Then
Range("a" & PLIN).Value = ORD_CONTRAPISO_INTERNO_TERREO
Range("B" & PLIN).Value = "Areia Grossa"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Contrapiso Interno"
Range("E" & PLIN).Value = "Massiamento contrap Pav. Térreo"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_AREIA_GROSSA_MASSIAM_INT_TERREO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_BIANCO_MASSIAM_INT_TERREO <> 0 Then
Range("a" & PLIN).Value = ORD_CONTRAPISO_INTERNO_TERREO
Range("B" & PLIN).Value = "Impermeabilizantes - Bianco 18KG"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Contrapiso Interno"
Range("E" & PLIN).Value = "Massiamento contrap Pav. Térreo"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_BIANCO_MASSIAM_INT_TERREO
End If




End Sub
