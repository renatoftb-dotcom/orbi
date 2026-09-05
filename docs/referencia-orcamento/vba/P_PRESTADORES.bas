Attribute VB_Name = "P_PRESTADORES"
'VALORES CALCULADOS
Dim CALC_PRESTADORES_EQUIPE_PEDREIROS_EDIF As Double
Dim CALC_PRESTADORES_ELETRICISTA As Double
Dim CALC_PRESTADORES_ENCANADOR As Double
Dim CALC_PRESTADORES_PINTOR_EDIF As Double
Dim CALC_PRESTADORES_CARPINTEIRO As Double
Dim CALC_PRESTADORES_IMPERMEABILIZADOR As Double
Dim CALC_PRESTADORES_INSTALADOR_AR As Double
Dim CALC_PRESTADORES_MARCENEIRO_PORTAS As Double
Dim CALC_PRESTADORES_INSTALADOR_AQUECEDORES As Double
Dim CALC_PRESTADORES_SERRALHEIRO As Double
Dim CALC_PRESTADORES_TERRAPLANAGEM As Double
Dim CALC_PRESTADORES_PAVIMENTAÇÃO_EXTERNA As Double
Dim CALC_PRESTADORES_MURO_DIVISA As Double
Dim CALC_PRESTADORES_MURO_ARRIMO As Double
Dim CALC_PRESTADORES_PEDREIROS_PISCINA As Double
Dim CALC_PRESTADORES_INSTALADOR_EQUIP_PISCINA As Double
Dim CALC_PRESTADORES_GESTAO_OBRA As Double



Sub RUN_PRESTADORES()


Windows("NOVO MODELO ORÇAMENTO.xlsm").Activate

Sheets("INPUT").Select

On Error Resume Next

CALC_PRESTADORES_EQUIPE_PEDREIROS_EDIF = WorksheetFunction.VLookup("CP_PRESTADORES_EQUIPE_PEDREIROS_EDIF", Columns("J:K"), 2, False)
CALC_PRESTADORES_ELETRICISTA = WorksheetFunction.VLookup("CP_PRESTADORES_ELETRICISTA", Columns("J:K"), 2, False)
CALC_PRESTADORES_ENCANADOR = WorksheetFunction.VLookup("CP_PRESTADORES_ENCANADOR", Columns("J:K"), 2, False)
CALC_PRESTADORES_PINTOR_EDIF = WorksheetFunction.VLookup("CP_PRESTADORES_PINTOR_EDIF", Columns("J:K"), 2, False)
CALC_PRESTADORES_CARPINTEIRO = WorksheetFunction.VLookup("CP_PRESTADORES_CARPINTEIRO", Columns("J:K"), 2, False)
CALC_PRESTADORES_IMPERMEABILIZADOR = WorksheetFunction.VLookup("CP_PRESTADORES_IMPERMEABILIZADOR", Columns("J:K"), 2, False)
CALC_PRESTADORES_INSTALADOR_AR = WorksheetFunction.VLookup("CP_PRESTADORES_INSTALADOR_AR", Columns("J:K"), 2, False)
CALC_PRESTADORES_MARCENEIRO_PORTAS = WorksheetFunction.VLookup("CP_PRESTADORES_MARCENEIRO_PORTAS", Columns("J:K"), 2, False)
CALC_PRESTADORES_INSTALADOR_AQUECEDORES = WorksheetFunction.VLookup("CP_PRESTADORES_INSTALADOR_AQUECEDORES", Columns("J:K"), 2, False)
CALC_PRESTADORES_SERRALHEIRO = WorksheetFunction.VLookup("CP_PRESTADORES_SERRALHEIRO", Columns("J:K"), 2, False)
CALC_PRESTADORES_TERRAPLANAGEM = WorksheetFunction.VLookup("CP_PRESTADORES_TERRAPLANAGEM", Columns("J:K"), 2, False)
CALC_PRESTADORES_PAVIMENTAÇÃO_EXTERNA = WorksheetFunction.VLookup("CP_PRESTADORES_PAVIMENTAÇÃO_EXTERNA", Columns("J:K"), 2, False)
CALC_PRESTADORES_MURO_DIVISA = WorksheetFunction.VLookup("CP_PRESTADORES_MURO_DIVISA", Columns("J:K"), 2, False)
CALC_PRESTADORES_MURO_ARRIMO = WorksheetFunction.VLookup("CP_PRESTADORES_MURO_ARRIMO", Columns("J:K"), 2, False)
CALC_PRESTADORES_PEDREIROS_PISCINA = WorksheetFunction.VLookup("CP_PRESTADORES_PEDREIROS_PISCINA", Columns("J:K"), 2, False)
CALC_PRESTADORES_INSTALADOR_EQUIP_PISCINA = WorksheetFunction.VLookup("CP_PRESTADORES_INSTALADOR_EQUIP_PISCINA", Columns("J:K"), 2, False)
CALC_PRESTADORES_GESTAO_OBRA = WorksheetFunction.VLookup("CP_PRESTADORES_GESTAO_OBRA", Columns("J:K"), 2, False)

On Error GoTo 0

Sheets("RESUMO").Select

'INSERINDO NA PLANILHA

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PRESTADORES_EQUIPE_PEDREIROS_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_PRESTADORES_SERVICOS
Range("B" & PLIN).Value = "Pedreiros Casa"
Range("C" & PLIN).Value = "Prestadores de serviços"
Range("D" & PLIN).Value = "Prestadores de serviços"
Range("E" & PLIN).Value = "Prestadores de serviços"
Range("F" & PLIN).Value = "m2"
Range("G" & PLIN).Value = CP_AREA_CONSTRUIDA_EDIF
Range("H" & PLIN).Value = CALC_PRESTADORES_EQUIPE_PEDREIROS_EDIF / CP_AREA_CONSTRUIDA_EDIF
Range("I" & PLIN).Value = CALC_PRESTADORES_EQUIPE_PEDREIROS_EDIF

End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PRESTADORES_ELETRICISTA <> 0 Then
Range("a" & PLIN).Value = ORD_PRESTADORES_SERVICOS
Range("B" & PLIN).Value = "Eletricista"
Range("C" & PLIN).Value = "Prestadores de serviços"
Range("D" & PLIN).Value = "Prestadores de serviços"
Range("E" & PLIN).Value = "Prestadores de serviços"
Range("F" & PLIN).Value = "m2"
Range("G" & PLIN).Value = CP_AREA_CONSTRUIDA_EDIF
Range("H" & PLIN).Value = CALC_PRESTADORES_ELETRICISTA / CP_AREA_CONSTRUIDA_EDIF
Range("i" & PLIN).Value = CALC_PRESTADORES_ELETRICISTA
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PRESTADORES_ENCANADOR <> 0 Then
Range("a" & PLIN).Value = ORD_PRESTADORES_SERVICOS
Range("B" & PLIN).Value = "Encanador"
Range("C" & PLIN).Value = "Prestadores de serviços"
Range("D" & PLIN).Value = "Prestadores de serviços"
Range("E" & PLIN).Value = "Prestadores de serviços"
Range("F" & PLIN).Value = "m2"
Range("G" & PLIN).Value = CP_AREA_CONSTRUIDA_EDIF
Range("H" & PLIN).Value = CALC_PRESTADORES_ENCANADOR / CP_AREA_CONSTRUIDA_EDIF
Range("i" & PLIN).Value = CALC_PRESTADORES_ENCANADOR
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PRESTADORES_PINTOR_EDIF <> 0 Then
Range("a" & PLIN).Value = ORD_PRESTADORES_SERVICOS
Range("B" & PLIN).Value = "Pintor"
Range("C" & PLIN).Value = "Prestadores de serviços"
Range("D" & PLIN).Value = "Prestadores de serviços"
Range("E" & PLIN).Value = "Prestadores de serviços"
Range("F" & PLIN).Value = "m2"
Range("G" & PLIN).Value = CP_AREA_CONSTRUIDA_EDIF
Range("H" & PLIN).Value = CALC_PRESTADORES_PINTOR_EDIF / CP_AREA_CONSTRUIDA_EDIF
Range("i" & PLIN).Value = CALC_PRESTADORES_PINTOR_EDIF
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PRESTADORES_CARPINTEIRO <> 0 Then
Range("a" & PLIN).Value = ORD_PRESTADORES_SERVICOS
Range("B" & PLIN).Value = "Carpinteiro"
Range("C" & PLIN).Value = "Prestadores de serviços"
Range("D" & PLIN).Value = "Prestadores de serviços"
Range("E" & PLIN).Value = "Prestadores de serviços"
Range("F" & PLIN).Value = "m2"
Range("G" & PLIN).Value = CALC_AREA_COBERTURA_TOTAL
Range("H" & PLIN).Value = CALC_PRESTADORES_CARPINTEIRO / CALC_AREA_COBERTURA_TOTAL
Range("I" & PLIN).Value = CALC_PRESTADORES_CARPINTEIRO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PRESTADORES_IMPERMEABILIZADOR <> 0 Then
Range("a" & PLIN).Value = ORD_PRESTADORES_SERVICOS
Range("B" & PLIN).Value = "Impermeabilizador"
Range("C" & PLIN).Value = "Prestadores de serviços"
Range("D" & PLIN).Value = "Prestadores de serviços"
Range("E" & PLIN).Value = "Prestadores de serviços"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_PRESTADORES_IMPERMEABILIZADOR
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CCALC_PRESTADORES_INSTALADOR_AR <> 0 Then
Range("a" & PLIN).Value = ORD_PRESTADORES_SERVICOS
Range("B" & PLIN).Value = "Instalador AR"
Range("C" & PLIN).Value = "Prestadores de serviços"
Range("D" & PLIN).Value = "Prestadores de serviços"
Range("E" & PLIN).Value = "Prestadores de serviços"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_PRESTADORES_INSTALADOR_AR
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PRESTADORES_MARCENEIRO_PORTAS <> 0 Then
Range("a" & PLIN).Value = ORD_PRESTADORES_SERVICOS
Range("B" & PLIN).Value = "Marceneiro Portas Internas"
Range("C" & PLIN).Value = "Prestadores de serviços"
Range("D" & PLIN).Value = "Prestadores de serviços"
Range("E" & PLIN).Value = "Prestadores de serviços"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_PRESTADORES_MARCENEIRO_PORTAS
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PRESTADORES_GESTAO_OBRA <> 0 Then
Range("a" & PLIN).Value = ORD_PRESTADORES_SERVICOS
Range("B" & PLIN).Value = "Gestão Obra"
Range("C" & PLIN).Value = "Prestadores de serviços"
Range("D" & PLIN).Value = "Prestadores de serviços"
Range("E" & PLIN).Value = "Prestadores de serviços"
Range("F" & PLIN).Value = "m2"
Range("G" & PLIN).Value = CP_AREA_CONSTRUIDA_EDIF
Range("H" & PLIN).Value = CALC_PRESTADORES_GESTAO_OBRA / CP_AREA_CONSTRUIDA_EDIF
Range("I" & PLIN).Value = CALC_PRESTADORES_GESTAO_OBRA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PRESTADORES_INSTALADOR_EQUIP_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PRESTADORES_SERVICOS
Range("B" & PLIN).Value = "Instalador Equip. Piscina"
Range("C" & PLIN).Value = "Prestadores de serviços"
Range("D" & PLIN).Value = "Prestadores de serviços"
Range("E" & PLIN).Value = "Prestadores de serviços"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = 1
Range("H" & PLIN).Value = CALC_PRESTADORES_INSTALADOR_EQUIP_PISCINA
Range("I" & PLIN).Value = CALC_PRESTADORES_INSTALADOR_EQUIP_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PRESTADORES_PEDREIROS_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PRESTADORES_SERVICOS
Range("B" & PLIN).Value = "Pedreiros Piscina"
Range("C" & PLIN).Value = "Prestadores de serviços"
Range("D" & PLIN).Value = "Prestadores de serviços"
Range("E" & PLIN).Value = "Prestadores de serviços"
Range("F" & PLIN).Value = "m2"
Range("G" & PLIN).Value = CP_AREA_CONSTRUIDA_PISCINA
Range("H" & PLIN).Value = CALC_PRESTADORES_PEDREIROS_PISCINA / CP_AREA_CONSTRUIDA_PISCINA
Range("i" & PLIN).Value = CALC_PRESTADORES_PEDREIROS_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PRESTADORES_MURO_ARRIMO <> 0 Then
Range("a" & PLIN).Value = ORD_PRESTADORES_SERVICOS
Range("B" & PLIN).Value = "Pedreiros Muro Arrimo"
Range("C" & PLIN).Value = "Prestadores de serviços"
Range("D" & PLIN).Value = "Prestadores de serviços"
Range("E" & PLIN).Value = "Prestadores de serviços"
Range("F" & PLIN).Value = "m2"
Range("G" & PLIN).Value = (CP_ALTURA_ARRIMO * CP_COMPRIMENTO_ARRIMO)
Range("H" & PLIN).Value = CALC_PRESTADORES_MURO_ARRIMO / (CP_ALTURA_ARRIMO * CP_COMPRIMENTO_ARRIMO)
Range("i" & PLIN).Value = CALC_PRESTADORES_MURO_ARRIMO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PRESTADORES_MURO_DIVISA <> 0 Then
Range("a" & PLIN).Value = ORD_PRESTADORES_SERVICOS
Range("B" & PLIN).Value = "Pedreiros Muro Divisa"
Range("C" & PLIN).Value = "Prestadores de serviços"
Range("D" & PLIN).Value = "Prestadores de serviços"
Range("E" & PLIN).Value = "Prestadores de serviços"
Range("F" & PLIN).Value = "m2"
Range("G" & PLIN).Value = (CP_COMPRIMENTO_MURO_DIVISA * CP_ALTURA_MURO_DIVISA)
Range("H" & PLIN).Value = CALC_PRESTADORES_MURO_DIVISA / (CP_COMPRIMENTO_MURO_DIVISA * CP_ALTURA_MURO_DIVISA)
Range("i" & PLIN).Value = CALC_PRESTADORES_MURO_DIVISA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PRESTADORES_PAVIMENTAÇÃO_EXTERNA <> 0 Then
Range("a" & PLIN).Value = ORD_PRESTADORES_SERVICOS
Range("B" & PLIN).Value = "Pedreiros Pavim. Externa"
Range("C" & PLIN).Value = "Prestadores de serviços"
Range("D" & PLIN).Value = "Prestadores de serviços"
Range("E" & PLIN).Value = "Prestadores de serviços"
Range("F" & PLIN).Value = "m2"
Range("G" & PLIN).Value = CP_PAVIMENTACAO_EXTERNA
Range("H" & PLIN).Value = CALC_PRESTADORES_PAVIMENTAÇÃO_EXTERNA / CP_PAVIMENTACAO_EXTERNA
Range("i" & PLIN).Value = CALC_PRESTADORES_PAVIMENTAÇÃO_EXTERNA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PRESTADORES_TERRAPLANAGEM <> 0 Then
Range("a" & PLIN).Value = ORD_PRESTADORES_SERVICOS
Range("B" & PLIN).Value = "Terraplanagem"
Range("C" & PLIN).Value = "Prestadores de serviços"
Range("D" & PLIN).Value = "Prestadores de serviços"
Range("E" & PLIN).Value = "Prestadores de serviços"
Range("F" & PLIN).Value = "Unidades"
Range("g" & PLIN).Value = 1
Range("h" & PLIN).Value = CALC_PRESTADORES_TERRAPLANAGEM
Range("i" & PLIN).Value = CALC_PRESTADORES_TERRAPLANAGEM
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PRESTADORES_INSTALADOR_AQUECEDORES <> 0 Then
Range("a" & PLIN).Value = ORD_PRESTADORES_SERVICOS
Range("B" & PLIN).Value = "Instalador Aquecedores"
Range("C" & PLIN).Value = "Prestadores de serviços"
Range("D" & PLIN).Value = "Prestadores de serviços"
Range("E" & PLIN).Value = "Prestadores de serviços"
Range("F" & PLIN).Value = "Unidades"
Range("g" & PLIN).Value = 1
Range("h" & PLIN).Value = CALC_PRESTADORES_INSTALADOR_AQUECEDORES
Range("i" & PLIN).Value = CALC_PRESTADORES_INSTALADOR_AQUECEDORES
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PRESTADORES_SERRALHEIRO <> 0 Then
Range("a" & PLIN).Value = ORD_PRESTADORES_SERVICOS
Range("B" & PLIN).Value = "Serralheiro"
Range("C" & PLIN).Value = "Prestadores de serviços"
Range("D" & PLIN).Value = "Prestadores de serviços"
Range("E" & PLIN).Value = "Prestadores de serviços"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_PRESTADORES_SERRALHEIRO
End If









End Sub
