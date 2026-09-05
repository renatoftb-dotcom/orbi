Attribute VB_Name = "M_PINTURA"
Dim PAREDE_INTERNA As Double
Dim PAREDE_EXTERNA As Double
Dim PAREDE_TOTAL As Double
Dim CALC_SELADOR As Double
Dim CALC_MASSA_CORRIDA As Double
Dim CALC_FUNDO_PREPARADOR As Double
Dim CALC_TINTAS As Double




Sub PINTURA()

PAREDE_INTERNA = ((CP_M2_PAREDES_INTERNAS_EDIF - CP_REVESTIMENTO_INTERNO_EDIF) * 2 + CP_M2_PAREDES_EXTERNAS_EDIF) * 1.1
PAREDE_EXTERNA = CP_M2_PAREDES_EXTERNAS_EDIF * 1.1
PAREDE_TOTAL = PAREDE_INTERNA + PAREDE_EXTERNA

CALC_SELADOR = WorksheetFunction.Ceiling((0.2 * PAREDE_TOTAL) / 10 * 1.1, 1)
CALC_MASSA_CORRIDA = WorksheetFunction.Ceiling((((PAREDE_INTERNA / 3) * 2.5) / 15) * 1.1, 1)
CALC_FUNDO_PREPARADOR = WorksheetFunction.Ceiling((0.2 * PAREDE_TOTAL) / 8 * 1.1, 1)
CALC_TINTAS = WorksheetFunction.Ceiling(0.15 * PAREDE_TOTAL / 9 * 1.1, 1)



PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_FUNDO_PREPARADOR <> 0 Or CALC_FUNDO_PREPARADOR <> 0 Then
Range("a" & PLIN).Value = ORD_PINTURA
Range("B" & PLIN).Value = "Tintas - Fundo Preparador 18L"
Range("C" & PLIN).Value = "Acabamento"
Range("D" & PLIN).Value = "Pintura"
Range("E" & PLIN).Value = "Base"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_FUNDO_PREPARADOR
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_SELADOR <> 0 Or CALC_SELADOR <> 0 Then
Range("a" & PLIN).Value = ORD_PINTURA
Range("B" & PLIN).Value = "Tintas - Selador 18L"
Range("C" & PLIN).Value = "Acabamento"
Range("D" & PLIN).Value = "Pintura"
Range("E" & PLIN).Value = "Base"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_SELADOR
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_MASSA_CORRIDA <> 0 Or CALC_MASSA_CORRIDA <> 0 Then
Range("a" & PLIN).Value = ORD_PINTURA
Range("B" & PLIN).Value = "Tintas - Massa Corrida 25KG"
Range("C" & PLIN).Value = "Acabamento"
Range("D" & PLIN).Value = "Pintura"
Range("E" & PLIN).Value = "Base"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_MASSA_CORRIDA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TINTAS <> 0 Or CALC_TINTAS <> 0 Then
Range("a" & PLIN).Value = ORD_PINTURA
Range("B" & PLIN).Value = "Tintas - Tintas 18L"
Range("C" & PLIN).Value = "Acabamento"
Range("D" & PLIN).Value = "Pintura"
Range("E" & PLIN).Value = "Tintas"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_TINTAS
End If


End Sub
