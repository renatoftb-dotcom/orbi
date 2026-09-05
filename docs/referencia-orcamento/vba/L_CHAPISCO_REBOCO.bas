Attribute VB_Name = "L_CHAPISCO_REBOCO"
Dim CALC_VOLUME_CHAPISCO As Double
Dim CALC_CIMENTO_CHAPISCO As Double
Dim CALC_AREIA_GROSSA_CHAPISCO As Double
Dim CALC_AGUA_CHAPISCO As Double
Dim CALC_VOLUME_REBOCO As Double
Dim CALC_CIMENTO_REBOCO As Double
Dim CALC_AREIA_GROSSA_REBOCO As Double
Dim CALC_AGUA_REBOCO As Double
Dim CALC_VEDALIT As Double
Dim CALC_CIMENTO_TOTAL As Double
Dim CALC_AGUA_TOTAL As Double






Sub CHAPISCO_REBOCO()

'FORMULAS

'CHAPISCO
CALC_VOLUME_CHAPISCO = CP_M2_PAREDES_EDIF * 1.1 * 2 * 0.005
CALC_CIMENTO_CHAPISCO = (CALC_VOLUME_CHAPISCO * 0.2 * 1200 / 50) * 1.1
CALC_AREIA_GROSSA_CHAPISCO = WorksheetFunction.Ceiling((CALC_VOLUME_CHAPISCO * 0.8) * 1.1, 1)
CALC_AGUA_CHAPISCO = (CALC_VOLUME_CHAPISCO * 0.36) * 1.1

'REBOCO
CALC_VOLUME_REBOCO = CP_M2_PAREDES_EDIF * 1.1 * 2 * 0.025
CALC_CIMENTO_REBOCO = (CALC_VOLUME_REBOCO * 0.125 * 1200 / 50) * 1.1
CALC_AREIA_FINA_REBOCO = WorksheetFunction.Ceiling((CALC_VOLUME_REBOCO * 0.875) * 1.1, 1)
CALC_AGUA_REBOCO = (CALC_VOLUME_REBOCO * 0.36) * 1.1

CALC_CIMENTO_TOTAL = WorksheetFunction.Ceiling(CALC_CIMENTO_CHAPISCO + CALC_CIMENTO_REBOCO, 1)
CALC_AGUA_TOTAL = CALC_AGUA_CHAPISCO + CALC_AGUA_REBOCO
CALC_VEDALIT = WorksheetFunction.Ceiling((0.3 * CALC_CIMENTO_TOTAL / 18) * 1.1, 1)

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CIMENTO_TOTAL <> 0 Or CALC_CIMENTO_TOTAL <> 0 Then
Range("a" & PLIN).Value = ORD_REBOCO
Range("B" & PLIN).Value = "Sacos de cimento 50kg"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Chapisco e Reboco"
Range("E" & PLIN).Value = "Chapisco e Reboco"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_CIMENTO_TOTAL
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_AREIA_GROSSA_CHAPISCO <> 0 Or CALC_AREIA_GROSSA_CHAPISCO <> 0 Then
Range("a" & PLIN).Value = ORD_REBOCO
Range("B" & PLIN).Value = "Areia Grossa"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Chapisco e Reboco"
Range("E" & PLIN).Value = "Chapisco e Reboco"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_AREIA_GROSSA_CHAPISCO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_AREIA_FINA_REBOCO <> 0 Or CALC_AREIA_FINA_REBOCO <> 0 Then
Range("a" & PLIN).Value = ORD_REBOCO
Range("B" & PLIN).Value = "Areia Fina"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Chapisco e Reboco"
Range("E" & PLIN).Value = "Chapisco e Reboco"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_AREIA_FINA_REBOCO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_AGUA_TOTAL <> 0 Or CALC_AGUA_TOTAL <> 0 Then
Range("a" & PLIN).Value = ORD_REBOCO
Range("B" & PLIN).Value = "Água"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Chapisco e Reboco"
Range("E" & PLIN).Value = "Chapisco e Reboco"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_AGUA_TOTAL
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_VEDALIT <> 0 Or CALC_VEDALIT <> 0 Then
Range("a" & PLIN).Value = ORD_REBOCO
Range("B" & PLIN).Value = "Impermeabilizantes - Vedalit 18L"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Chapisco e Reboco"
Range("E" & PLIN).Value = "Chapisco e Reboco"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_VEDALIT
End If

'INCLUIR ANDAIMES * CRONOGRAMA

End Sub
