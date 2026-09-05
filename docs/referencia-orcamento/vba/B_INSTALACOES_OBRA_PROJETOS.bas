Attribute VB_Name = "B_INSTALACOES_OBRA_PROJETOS"

'QUANTIDADES FIXAS
Dim QTD_POSTE As Double
Dim QTD_SERRA_CIRCULAR As Double
Dim QTD_FURADERIA As Double
Dim QTD_MANGUEIRA_NIVEL As Double
Dim QTD_LAPIS As Double
Dim QTD_DISCO_SERRA_CIRCULAR As Double
Dim QTD_TORNEIRA_JARDIM As Double
Dim QTD_PA_BICO_CABO As Double
Dim QTD_CAVADERIA As Double
Dim QTD_MAGUEIRA_JARDIM As Double
Dim QTD_ENGATE_MANGUEIRA As Double
Dim QTD_TORQUESA As Double
Dim QTD_LUVA_MUCAMBO As Double
Dim QTD_LINHA_PEDREIRO As Double
Dim QTD_CARRINHO_PEDREIRO As Double



'FORMULAS
Dim CALC_TABUAS_10 As Double
Dim CALC_SARRAFO_5 As Double
Dim CALC_PREGO_18X27 As Double
Dim CALC_PREGO_17X21 As Double




Sub INSTALACOES_OBRA_PROJETOS()


Windows("NOVO MODELO ORÇAMENTO.xlsm").Activate


Sheets("RESUMO").Select


'QUANTIDADES FIXAS

QTD_POSTE = 1
QTD_SERRA_CIRCULAR = 1
QTD_FURADERIA = 1
QTD_MANGUEIRA_NIVEL = 25
QTD_LAPIS = 4
QTD_DISCO_SERRA_CIRCULAR = 2
QTD_TORNEIRA_JARDIM = 1
QTD_PA_BICO_CABO = 4
QTD_CAVADERIA = 4
QTD_MAGUEIRA_JARDIM = 30
QTD_ENGATE_MANGUEIRA = 1
QTD_TORQUESA = 5
QTD_LUVA_MUCAMBO = 10
QTD_LINHA_PEDREIRO = 2
QTD_CARRINHO_PEDREIRO = 4


'FORMULAS

'Madeira Caixarias

CALC_TABUA_10 = WorksheetFunction.Ceiling(CP_GABARITO_EDIF / 3 * 1.2, 1)
CALC_SARRAFO_5 = WorksheetFunction.Ceiling((CP_GABARITO_EDIF * 1.2 / 1.3 * 0.6 / 3) + 20, 1)
CALC_PREGO_18X27 = WorksheetFunction.Ceiling(0.05 * CALC_TABUA_10 / 2, 1)
CALC_PREGO_17X21 = CALC_PREGO_18X27



'INSERINDO NA PLANILHA

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If QTD_POSTE <> 0 Then
Range("a" & PLIN).Value = ORD_INSTALACOES_OBRA_PROJETOS
Range("B" & PLIN).Value = "Elétrica - Poste Padrão - Trifásica C3"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Instalações pré obra e projetos"
Range("E" & PLIN).Value = "Bruto - Elétrica"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = QTD_POSTE
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If QTD_SERRA_CIRCULAR <> 0 Then
Range("a" & PLIN).Value = ORD_INSTALACOES_OBRA_PROJETOS
Range("B" & PLIN).Value = "Ferramentas - Serra Circular Dewalt DWE560-B2"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Instalações pré obra e projetos"
Range("E" & PLIN).Value = "Marcação Obra"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = QTD_SERRA_CIRCULAR
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If QTD_FURADERIA <> 0 Then
Range("a" & PLIN).Value = ORD_INSTALACOES_OBRA_PROJETOS
Range("B" & PLIN).Value = "Ferramentas - Furadeira Dewalt 1/2 DWD502-BR 710W"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Instalações pré obra e projetos"
Range("E" & PLIN).Value = "Marcação Obra"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = QTD_FURADERIA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If QTD_MANGUEIRA_NIVEL <> 0 Then
Range("a" & PLIN).Value = ORD_INSTALACOES_OBRA_PROJETOS
Range("B" & PLIN).Value = "Ferramentas - Mangueira de Nível"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Instalações pré obra e projetos"
Range("E" & PLIN).Value = "Marcação Obra"
Range("F" & PLIN).Value = "Mts"
Range("G" & PLIN).Value = QTD_MANGUEIRA_NIVEL
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If QTD_LAPIS <> 0 Then
Range("a" & PLIN).Value = ORD_INSTALACOES_OBRA_PROJETOS
Range("B" & PLIN).Value = "Ferramentas - Lapis"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Instalações pré obra e projetos"
Range("E" & PLIN).Value = "Marcação Obra"
Range("F" & PLIN).Value = "Rolos"
Range("G" & PLIN).Value = QTD_LAPIS
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If QTD_DISCO_SERRA_CIRCULAR <> 0 Then
Range("a" & PLIN).Value = ORD_INSTALACOES_OBRA_PROJETOS
Range("B" & PLIN).Value = "Disco Serra Circular"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Instalações pré obra e projetos"
Range("E" & PLIN).Value = "Marcação Obra"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = QTD_DISCO_SERRA_CIRCULAR
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If QTD_TORNEIRA_JARDIM <> 0 Then
Range("a" & PLIN).Value = ORD_INSTALACOES_OBRA_PROJETOS
Range("B" & PLIN).Value = "Metal - Hidráulica - Torneira Jardim"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Instalações pré obra e projetos"
Range("E" & PLIN).Value = "Marcação Obra"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = QTD_TORNEIRA_JARDIM
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If QTD_PA_BICO_CABO <> 0 Then
Range("a" & PLIN).Value = ORD_INSTALACOES_OBRA_PROJETOS
Range("B" & PLIN).Value = "Ferramentas - Pá de bico com cabo"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Instalações pré obra e projetos"
Range("E" & PLIN).Value = "Marcação Obra"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = QTD_PA_BICO_CABO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If QTD_CAVADERIA <> 0 Then
Range("a" & PLIN).Value = ORD_INSTALACOES_OBRA_PROJETOS
Range("B" & PLIN).Value = "Ferramentas - Cavadeira"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Instalações pré obra e projetos"
Range("E" & PLIN).Value = "Marcação Obra"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = QTD_CAVADERIA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If QTD_MAGUEIRA_JARDIM <> 0 Then
Range("a" & PLIN).Value = ORD_INSTALACOES_OBRA_PROJETOS
Range("B" & PLIN).Value = "Ferramentas - Mangueira de Jardim"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Instalações pré obra e projetos"
Range("E" & PLIN).Value = "Marcação Obra"
Range("F" & PLIN).Value = "Mts"
Range("G" & PLIN).Value = QTD_MAGUEIRA_JARDIM
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If QTD_ENGATE_MANGUEIRA <> 0 Then
Range("a" & PLIN).Value = ORD_INSTALACOES_OBRA_PROJETOS
Range("B" & PLIN).Value = "Ferramentas - Engate Rápido Mangueira Jardim"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Instalações pré obra e projetos"
Range("E" & PLIN).Value = "Marcação Obra"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = QTD_ENGATE_MANGUEIRA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If QTD_TORQUESA <> 0 Then
Range("a" & PLIN).Value = ORD_INSTALACOES_OBRA_PROJETOS
Range("B" & PLIN).Value = "Ferramentas - Torquesa Ferragem"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Instalações pré obra e projetos"
Range("E" & PLIN).Value = "Marcação Obra"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = QTD_TORQUESA
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If QTD_LUVA_MUCAMBO <> 0 Then
Range("a" & PLIN).Value = ORD_INSTALACOES_OBRA_PROJETOS
Range("B" & PLIN).Value = "Ferramentas - Luva Mucambo"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Instalações pré obra e projetos"
Range("E" & PLIN).Value = "Marcação Obra"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = QTD_LUVA_MUCAMBO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If QTD_LINHA_PEDREIRO <> 0 Then
Range("a" & PLIN).Value = ORD_INSTALACOES_OBRA_PROJETOS
Range("B" & PLIN).Value = "Ferramentas - Linha de pedreiro"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Marcação Obra"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = QTD_LINHA_PEDREIRO
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If QTD_CARRINHO_PEDREIRO <> 0 Then
Range("a" & PLIN).Value = ORD_INSTALACOES_OBRA_PROJETOS
Range("B" & PLIN).Value = "Ferramentas - Carrinho Pedreiro"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Marcação Obra"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = QTD_CARRINHO_PEDREIRO
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TABUA_10 <> 0 Then
Range("a" & PLIN).Value = ORD_INSTALACOES_OBRA_PROJETOS
Range("B" & PLIN).Value = "Madeira Caixaria - Tábuas de 10cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Marcação Obra"
Range("F" & PLIN).Value = "Barras 3mts"
Range("G" & PLIN).Value = CALC_TABUA_10
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_SARRAFO_5 <> 0 Then
Range("a" & PLIN).Value = ORD_INSTALACOES_OBRA_PROJETOS
Range("B" & PLIN).Value = "Madeira Caixaria - Sarrafos de 05cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Marcação Obra"
Range("F" & PLIN).Value = "Barras 3mts"
Range("G" & PLIN).Value = CALC_SARRAFO_5
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PREGO_18X27 <> 0 Then
Range("a" & PLIN).Value = ORD_INSTALACOES_OBRA_PROJETOS
Range("B" & PLIN).Value = "Aço - Pregos 18x27"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Marcação Obra"
Range("F" & PLIN).Value = "KG"
Range("G" & PLIN).Value = CALC_PREGO_18X27
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PREGO_17X21 <> 0 Then
Range("a" & PLIN).Value = ORD_INSTALACOES_OBRA_PROJETOS
Range("B" & PLIN).Value = "Aço - Pregos 17x21"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Fundação"
Range("E" & PLIN).Value = "Marcação Obra"
Range("F" & PLIN).Value = "KG"
Range("G" & PLIN).Value = CALC_PREGO_17X21
End If


End Sub



