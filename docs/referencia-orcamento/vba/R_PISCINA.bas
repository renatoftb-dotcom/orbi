Attribute VB_Name = "R_PISCINA"
'FORMULAS
Dim QTD_COMPACTADOR_PISCINA As Double
Dim QTD_NUMERO_VIGAS_PISCINA As Double
Dim CALC_TABUA_10_MARCACAO_PISCINA As Double
Dim CALC_SARRAFO_5_MARCACAO_PISCINA As Double
Dim CALC_PREGO_18X27_MARCACAO_PISCINA As Double
Dim CALC_PREGO_17X21_MARCACAO_PISCINA As Double
Dim CALC_PERFURACAO_ESTACAS_PISCINA As Double
Dim CALC_AREIA_GROSSA_CONTRAP_PISCINA As Double
Dim CALC_PEDRA_CONTRAP_PISCINA As Double
Dim CALC_CIMENTO_CONTRAP_PISCINA As Double
Dim CALC_MALHA_POP_CONTRAP_PISCINA As Double
Dim CALC_TIJOLINHO_MACICO_PISCINA As Double
Dim CALC_AREIA_FINA_ASSENT_PISCINA As Double
Dim CALC_CIMENTO_FINA_ASSENT_PISCINA As Double
Dim CALC_TABUAS_15_COLUN_PISCINA As Double
Dim CALC_TABUAS_20_COLUN_PISCINA As Double
Dim CALC_TABUAS_30_COLUN_PISCINA As Double
Dim CALC_TABUAS_30_VIGAS_PISCINA As Double
Dim CALC_TABUAS_30_PISCINA_TOTAL As Double
Dim CALC_SARRAFO_5_COLUN_PISCINA As Double
Dim CALC_SARRAFO_5_VIGAS_PISCINA As Double
Dim CALC_SARRAFO_5_PISCINA_TOTAL As Double
Dim CALC_MADERITES_COLUN_PISCINA As Double
Dim CALC_CA60_4MM_PISCINA As Double
Dim CALC_CA50_5MM_PISCINA As Double
Dim CALC_CA50_6MM_PISCINA As Double
Dim CALC_CA50_8MM_PISCINA As Double
Dim CALC_CA50_10MM_PISCINA As Double
Dim CALC_CA50_12MM_PISCINA As Double
Dim CALC_CA50_16MM_PISCINA As Double
Dim CALC_CA60_5MM_PISCINA As Double
Dim CALC_CONCR_PISCINA As Double
Dim CALC_PESO_FERRO_PISCINA As Double
Dim CALC_DISCO_FERRO_PISCINA As Double
Dim CALC_ARAME_PISCINA As Double
Dim CALC_PREGO_18X27_PISCINA As Double
Dim CALC_VEDATOP_BALDRAMES_PISCINA As Double
Dim CALC_VEDATOP_PAREDES_CONTRAPISO_PISCINA As Double
Dim CALC_VEDATOP_PAREDES_EXTERNA_PISCINA As Double
Dim CALC_VEDATOP_TOTAL_PISCINA As Double
Dim CALC_TELA_POLIESTER_PISCINA As Double
Dim CALC_VOLUME_CHAPISCO_PISCINA As Double
Dim CALC_CIMENTO_CHAPISCO_PISCINA As Double
Dim CALC_AREIA_GROSSA_CHAPISCO_PISCINA As Double
Dim CALC_AGUA_CHAPISCO_PISCINA As Double
Dim CALC_VOLUME_REBOCO_PISCINA As Double
Dim CALC_CIMENTO_REBOCO_PISCINA As Double
Dim CALC_AREIA_FINA_REBOCO_PISCINA As Double
Dim CALC_AGUA_REBOCO_PISCINA As Double
Dim CALC_CIMENTO_MASSIAMENTO_PISO As Double
Dim CALC_AREIA_GROSSA_MASSIAMENTO_PISO As Double
Dim CALC_CIMENTO_TOTAL_PISCINA As Double
Dim CALC_AGUA_TOTAL_PISCINA As Double
Dim CALC_VEDALIT_PISCINA As Double
Dim CALC_AREIA_GROSSA_TOTAL_PISCINA As Double
Dim CALC_AREIA_FINA_TOTAL_PISCINA As Double
Dim CALC_REVESTIMENTO_PISCINA As Double
Dim CALC_REJUNTES_PISCINA As Double
Dim CALC_ARGAMASSAS_PISCINA As Double
Dim CALC_DISCO_PORCELANATO_PISCINA As Double


Sub PISCINA()


'QUANTIDADES FIXAS

QTD_COMPACTADOR_PISCINA = 2

QTD_NUMERO_VIGAS_PISCINA = 3


'FORMULAS

'MARCAÇÃO OBRA
CALC_TABUA_10_MARCACAO_PISCINA = WorksheetFunction.Ceiling(CP_GABARITO_OBRA_PISCINA / 3 * 1.2, 1)
CALC_SARRAFO_5_MARCACAO_PISCINA = WorksheetFunction.Ceiling((CP_GABARITO_OBRA_PISCINA * 1.2 / 1.3 * 0.6 / 3) + 20, 1)
CALC_PREGO_18X27_MARCACAO_PISCINA = WorksheetFunction.Ceiling(0.05 * CALC_TABUA_10_MARCACAO_PISCINA / 2, 1)
CALC_PREGO_17X21_MARCACAO_PISCINA = CALC_PREGO_18X27_MARCACAO_PISCINA


'PREFURAÇÃO BROCAS
CALC_PERFURACAO_ESTACAS_PISCINA = CP_QTD_ESTACAS_PISCINA * CP_PROFUNDIDADE_ESTACAS_PISCINA * 1.15

'CONTRAPISO
CALC_AREIA_GROSSA_CONTRAP_PISCINA = WorksheetFunction.Ceiling(CP_AREA_CONSTRUIDA_PISCINA * 0.6 * 0.1 * 1.1, 1)
CALC_PEDRA_CONTRAP_PISCINA = WorksheetFunction.Ceiling(CP_AREA_CONSTRUIDA_PISCINA * 0.1 * 1.1, 1)
CALC_CIMENTO_CONTRAP_PISCINA = WorksheetFunction.Ceiling(CALC_PEDRA_CONTRAP_PISCINA * 6 * 1.1, 1)
CALC_MALHA_POP_CONTRAP_PISCINA = WorksheetFunction.Ceiling(CP_AREA_CONSTRUIDA_PISCINA / (2.9 * 1.9 * 1.1), 1)

'ASSENTAMENTO PAREDES
CALC_TIJOLINHO_MACICO_PISCINA = WorksheetFunction.Ceiling(CP_PAREDES_M2_TOTAL_PISCINA * 84.2 * 1.1, 1)
CALC_AREIA_FINA_ASSENT_PISCINA = WorksheetFunction.Ceiling(CALC_TIJOLINHO_MACICO_PISCINA * 0.0291 * 1.1, 1)
CALC_CIMENTO_FINA_ASSENT_PISCINA = WorksheetFunction.Ceiling(CALC_AREIA_FINA_ASSENT_PISCINA * 2 * 1.1, 1)

'CAIXARIAS
CALC_TABUAS_15_COLUN_PISCINA = WorksheetFunction.Ceiling(CP_COLUNAS_15_PISCINA * CP_PROFUNDIDADE_PISCINA * 2 / 3 * 1.1, 1)
CALC_TABUAS_20_COLUN_PISCINA = WorksheetFunction.Ceiling(CP_COLUNAS_20_PISCINA * CP_PROFUNDIDADE_PISCINA * 2 / 3 * 1.1, 1)


CALC_TABUAS_30_COLUN_PISCINA = WorksheetFunction.Ceiling(CP_COLUNAS_25_PISCINA * CP_PROFUNDIDADE_PISCINA * 2 / 3 * 1.1, 1)
CALC_TABUAS_30_VIGAS_PISCINA = WorksheetFunction.Ceiling(((CP_PERIMETRO_PAREDES_PISCINA * 2 / 3) + CP_PERIMETRO_PAREDES_PISCINA * 2 / 3 * 0.45 / 3) _
                                                        * QTD_NUMERO_VIGAS_PISCINA * 1.1, 1)
CALC_TABUAS_30_PISCINA_TOTAL = CALC_TABUAS_30_COLUN_PISCINA + CALC_TABUAS_30_VIGAS_PISCINA


CALC_SARRAFO_5_COLUN_PISCINA = WorksheetFunction.Ceiling(((CP_COLUNAS_15_PISCINA * CP_PROFUNDIDADE_PISCINA * 2 / 0.5 * 0.2) _
                                   + (CP_COLUNAS_20_PISCINA * CP_PROFUNDIDADE_PISCINA * 2 / 0.5 * 0.25) _
                                   + (CP_COLUNAS_25_PISCINA * CP_PROFUNDIDADE_PISCINA * 2 / 0.5 * 0.35)) * 1.1 / 3, 1)
CALC_SARRAFO_5_VIGAS_PISCINA = WorksheetFunction.Ceiling(((CP_PERIMETRO_PAREDES_PISCINA * 2 / 0.7 * 0.45) + (CP_PERIMETRO_PAREDES_PISCINA / 0.75 * 0.3)) / 3 _
                                                 * QTD_NUMERO_VIGAS_PISCINA * 1.1, 1)
CALC_SARRAFO_5_PISCINA_TOTAL = CALC_SARRAFO_5_COLUN_PISCINA + CALC_SARRAFO_5_VIGAS_PISCINA + CALC_SARRAFO_5_MARCACAO_PISCINA
                                

CALC_MADERITES_COLUN_PISCINA = WorksheetFunction.Ceiling(CP_AREA_FORMA_COLUNA_MAIOR_25CM_PISCINA / 2.42 * 1.1, 1)

'AÇO
CALC_CA60_4MM_PISCINA = WorksheetFunction.Ceiling((CP_CA60_4MM_ESTACAS_PISCINA + CP_CA60_4MM_SAPATAS_PISCINA + _
                        CP_CA60_4MM_ARRANQUES_PISCINA + CP_CA60_4MM_BALDRAME_PISCINA + CP_CA60_4MM_CONTRAPISO_PISCINA + _
                        CP_CA60_4MM_COLUNAS_PISCINA + CP_CA60_4MM_VIGAS_PISCINA) / 12 * 1.1, 1)
CALC_CA50_5MM_PISCINA = WorksheetFunction.Ceiling((CP_CA50_5MM_ESTACAS_PISCINA + CP_CA50_5MM_SAPATAS_PISCINA _
                       + CP_CA50_5MM_ARRANQUES_PISCINA + CP_CA50_5MM_BALDRAME_PISCINA + CP_CA50_5MM_CONTRAPISO_PISCINA _
                       + CP_CA50_5MM_COLUNAS_PISCINA + CP_CA50_5MM_VIGAS_PISCINA) / 12 * 1.1, 1)
CALC_CA50_6MM_PISCINA = WorksheetFunction.Ceiling((CP_CA50_6MM_ESTACAS_PISCINA + CP_CA50_6MM_SAPATAS_PISCINA _
                       + CP_CA50_6MM_ARRANQUES_PISCINA + CP_CA50_6MM_BALDRAME_PISCINA + CP_CA50_6MM_CONTRAPISO_PISCINA _
                       + CP_CA50_6MM_COLUNAS_PISCINA + CP_CA50_6MM_VIGAS_PISCINA) / 12 * 1.1, 1)
CALC_CA50_8MM_PISCINA = WorksheetFunction.Ceiling((CP_CA50_8MM_ESTACAS_PISCINA + CP_CA50_8MM_SAPATAS_PISCINA _
                        + CP_CA50_8MM_ARRANQUES_PISCINA + CP_CA50_8MM_BALDRAME_PISCINA + CP_CA50_8MM_CONTRAPISO_PISCINA _
                        + CP_CA50_8MM_COLUNAS_PISCINA + CP_CA50_8MM_VIGAS_PISCINA) / 12 * 1.1, 1)
CALC_CA50_10MM_PISCINA = WorksheetFunction.Ceiling((CP_CA50_10MM_ESTACAS_PISCINA + CP_CA50_10MM_SAPATAS_PISCINA _
                        + CP_CA50_10MM_ARRANQUES_PISCINA + CP_CA50_10MM_BALDRAME_PISCINA + CP_CA50_10MM_CONTRAPISO_PISCINA _
                        + CP_CA50_10MM_COLUNAS_PISCINA + CP_CA50_10MM_VIGAS_PISCINA) / 12 * 1.1, 1)
CALC_CA50_12MM_PISCINA = WorksheetFunction.Ceiling((CP_CA50_12MM_ESTACAS_PISCINA + CP_CA50_12MM_SAPATAS_PISCINA _
                        + CP_CA50_12MM_ARRANQUES_PISCINA + CP_CA50_12MM_BALDRAME_PISCINA + CP_CA50_12MM_CONTRAPISO_PISCINA _
                        + CP_CA50_12MM_COLUNAS_PISCINA + CP_CA50_12MM_VIGAS_PISCINA) / 12 * 1.1, 1)
CALC_CA50_16MM_PISCINA = WorksheetFunction.Ceiling((CP_CA50_16MM_ESTACAS_PISCINA + CP_CA50_16MM_SAPATAS_PISCINA _
                        + CP_CA50_16MM_ARRANQUES_PISCINA + CP_CA50_16MM_BALDRAME_PISCINA + CP_CA50_16MM_CONTRAPISO_PISCINA _
                        + CP_CA50_16MM_COLUNAS_PISCINA + CP_CA50_16MM_VIGAS_PISCINA) / 12 * 1.1, 1)
CALC_CA60_5MM_PISCINA = WorksheetFunction.Ceiling((CP_CA60_5MM_ESTACAS_PISCINA + CP_CA60_5MM_SAPATAS_PISCINA _
                        + CP_CA60_5MM_ARRANQUES_PISCINA + CP_CA60_5MM_BALDRAME_PISCINA + CP_CA60_5MM_CONTRAPISO_PISCINA _
                        + CP_CA60_5MM_COLUNAS_PISCINA + CP_CA60_5MM_VIGAS_PISCINA) / 12 * 1.1, 1)
CALC_CONCR_PISCINA = WorksheetFunction.Ceiling((CP_CONCR_ESTACAS_PISCINA + CP_CONCR_SAPATAS_PISCINA + CP_CONCR_ARRANQUES_PISCINA _
                        + CP_CONCR_BALDRAME_PISCINA + CP_CONCR_CONTRAPISO_PISCINA + CP_CONCR_COLUNAS_PISCINA + CP_CONCR_VIGAS_PISCINA) * 1.1, 1)

CALC_PESO_FERRO_PISCINA = ((CALC_CA60_4MM_PISCINA * PESO_CA60_4MM) + (CALC_CA50_5MM_PISCINA * PESO_CA50_5MM) _
                          + (CALC_CA50_6MM_PISCINA * PESO_CA50_6MM) + (CALC_CA50_8MM_PISCINA * PESO_CA50_8MM) _
                          + (CALC_CA50_10MM_PISCINA * PESO_CA50_10MM) + (CALC_CA50_12MM_PISCINA * PESO_CA50_12MM) _
                          + (CALC_CA50_16MM_PISCINA * PESO_CA50_16MM) + (CALC_CA60_5MM_PISCINA * PESO_CA60_5MM))

CALC_DISCO_FERRO_PISCINA = WorksheetFunction.Ceiling(CALC_PESO_FERRO_PISCINA * 0.01, 1)
CALC_ARAME_PISCINA = WorksheetFunction.Ceiling(CALC_PESO_FERRO_PISCINA * 0.06, 1)
CALC_PREGO_18X27_PISCINA = WorksheetFunction.Ceiling((0.55 * CALC_ARAME_PISCINA) + CALC_PREGO_18X27_MARCACAO_PISCINA, 1)

'IMPERMEABILIZAÇÃO
CALC_VEDATOP_BALDRAMES_PISCINA = WorksheetFunction.Ceiling((((CP_PERIMETRO_PAREDES_PISCINA * 2 * 0.3) + (CP_PERIMETRO_PAREDES_PISCINA * 0.15)) * 3 * 1.1) / 18, 1)
CALC_VEDATOP_PAREDES_CONTRAPISO_PISCINA = WorksheetFunction.Ceiling(((CP_PAREDES_M2_TOTAL_PISCINA + CP_AREA_CONSTRUIDA_PISCINA) * 3 * 1.1) / 18, 1)
CALC_VEDATOP_PAREDES_EXTERNA_PISCINA = WorksheetFunction.Ceiling(((CP_PAREDES_M2_TOTAL_PISCINA) * 3 * 1.1) / 18, 1)
CALC_VEDATOP_TOTAL_PISCINA = CALC_VEDATOP_BALDRAMES_PISCINA + CALC_VEDATOP_PAREDES_CONTRAPISO_PISCINA

CALC_TELA_POLIESTER_PISCINA = WorksheetFunction.Ceiling((CP_PAREDES_M2_TOTAL_PISCINA + CP_AREA_CONSTRUIDA_PISCINA) * 1.1, 1)

'CHAPISCO E REBOCO

'CHAPISCO
CALC_VOLUME_CHAPISCO_PISCINA = CP_PAREDES_M2_TOTAL_PISCINA * 1.1 * 2 * 0.005
CALC_CIMENTO_CHAPISCO_PISCINA = (CALC_VOLUME_CHAPISCO_PISCINA * 0.2 * 1200 / 50) * 1.1
CALC_AREIA_GROSSA_CHAPISCO_PISCINA = WorksheetFunction.Ceiling((CALC_VOLUME_CHAPISCO_PISCINA * 0.8) * 1.1, 1)
CALC_AGUA_CHAPISCO_PISCINA = (CALC_VOLUME_CHAPISCO_PISCINA * 0.36) * 1.1

'REBOCO
CALC_VOLUME_REBOCO_PISCINA = CP_PAREDES_M2_TOTAL_PISCINA * 1.1 * 2 * 0.025
CALC_CIMENTO_REBOCO_PISCINA = (CALC_VOLUME_REBOCO_PISCINA * 0.125 * 1200 / 50) * 1.1
CALC_AREIA_FINA_REBOCO_PISCINA = WorksheetFunction.Ceiling((CALC_VOLUME_REBOCO_PISCINA * 0.875) * 1.1, 1)
CALC_AGUA_REBOCO_PISCINA = (CALC_VOLUME_REBOCO_PISCINA * 0.36) * 1.1

'MASSIAMENTO CONTRAPISO
CALC_CIMENTO_MASSIAMENTO_PISO = WorksheetFunction.Ceiling(CP_AREA_CONSTRUIDA_PISCINA * 0.05 * 0.25 * 1200 / 50 * 1.1, 1)
CALC_AREIA_GROSSA_MASSIAMENTO_PISO = WorksheetFunction.Ceiling(CP_AREA_CONSTRUIDA_PISCINA * 0.05 * 0.75 * 1.1, 1)

'TOTAIS
CALC_CIMENTO_TOTAL_PISCINA = WorksheetFunction.Ceiling(CALC_CIMENTO_CONTRAP_PISCINA + CALC_CIMENTO_FINA_ASSENT_PISCINA + CALC_CIMENTO_CHAPISCO_PISCINA + CALC_CIMENTO_REBOCO_PISCINA, 1)
CALC_AGUA_TOTAL_PISCINA = CALC_AGUA_CHAPISCO_PISCINA + CALC_AGUA_REBOCO_PISCINA
CALC_VEDALIT_PISCINA = WorksheetFunction.Ceiling((0.3 * CALC_CIMENTO_TOTAL_PISCINA / 18) * 1.1, 1)
CALC_AREIA_GROSSA_TOTAL_PISCINA = CALC_AREIA_GROSSA_CONTRAP_PISCINA + CALC_AREIA_GROSSA_CHAPISCO_PISCINA + CALC_AREIA_GROSSA_MASSIAMENTO_PISO
CALC_AREIA_FINA_TOTAL_PISCINA = CALC_AREIA_FINA_ASSENT_PISCINA + CALC_AREIA_FINA_REBOCO_PISCINA


'REVESTIMENTO
CALC_REVESTIMENTO_PISCINA = WorksheetFunction.Ceiling(CP_PAREDES_M2_TOTAL_PISCINA + CP_AREA_CONSTRUIDA_PISCINA * 1.2, 1)
CALC_REJUNTES_PISCINA = WorksheetFunction.Ceiling(CALC_REVESTIMENTO_PISCINA * 0.095 / 5 * 1.1, 1)
CALC_ARGAMASSAS_PISCINA = WorksheetFunction.Ceiling(CALC_REVESTIMENTO_PISCINA * 7.5 / 20 * 1.1, 1)
CALC_DISCO_PORCELANATO_PISCINA = WorksheetFunction.Ceiling(CALC_REVESTIMENTO_PISCINA * 0.005 * 1.1, 1)




'INSERINDO NA PLANILHA


'PERFURAÇÃO BROCAS

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PERFURACAO_ESTACAS_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Maquinário - Perfuração"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Brocas"
Range("F" & PLIN).Value = "Mts"
Range("G" & PLIN).Value = CALC_PERFURACAO_ESTACAS_PISCINA
End If

'CONTRAPISO, MACIAMENTO, ASSENTAMENTO, CHAPISCO, REBOCO

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If QTD_COMPACTADOR_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Locação Ferramentas -  Compactador"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Contrapiso"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = QTD_COMPACTADOR_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PEDRA_CONTRAP_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Pedra"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Contrapiso"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_PEDRA_CONTRAP_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TIJOLINHO_MACICO_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Cerâmicas - Tijolo - Tijolinho Maciço"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Paredes"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_TIJOLINHO_MACICO_PISCINA
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CIMENTO_TOTAL_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Sacos de cimento 50kg"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Diversas"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_CIMENTO_TOTAL_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_AGUA_TOTAL_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Água"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Diversas"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_AGUA_TOTAL_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_VEDALIT_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Impermeabilizantes - Vedalit 18L"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Diversas"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_VEDALIT_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_AREIA_GROSSA_TOTAL_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Areia Grossa"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Diversas"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_AREIA_GROSSA_TOTAL_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_AREIA_FINA_TOTAL_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Areia Fina"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Diversas"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_AREIA_FINA_TOTAL_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_VEDATOP_TOTAL_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Impermeabilizantes - Vedatop Flexível 18KG"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Impermeabilização"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_VEDATOP_TOTAL_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TELA_POLIESTER_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Impermeabilizantes - Tela Poliester 50mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Impermeabilização"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_TELA_POLIESTER_PISCINA
End If

'CAIXARIAS


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TABUA_10_MARCACAO_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Madeira Caixaria - Tábuas de 10cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_TABUA_10_MARCACAO_PISCINA
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TABUAS_15_COLUN_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Madeira Caixaria - Tábuas de 20cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_TABUAS_15_COLUN_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TABUAS_20_COLUN_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Madeira Caixaria - Tábuas de 25cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_TABUAS_20_COLUN_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_TABUAS_30_PISCINA_TOTAL <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Madeira Caixaria - Tábuas de 30cm x 3mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_TABUAS_30_PISCINA_TOTAL
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_MADERITES_COLUN_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Madeira Caixaria - Madeirite Plastif. Preto 2,10x1,10mts 18mm"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_MADERITES_COLUN_PISCINA
End If


'AÇO

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_MALHA_POP_CONTRAP_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Aço - Malha pop EQ092 4.2mm 15x15"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Contrapiso"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_MALHA_POP_CONTRAP_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA60_4MM_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Aço - Barras de CA60 4.2mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA60_4MM_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_5MM_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Aço - Barras de CA50 5.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_5MM_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_6MM_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Aço - Barras de CA50 6.3mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_6MM_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_8MM_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Aço - Barras de CA50 8.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_8MM_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_10MM_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Aço - Barras de CA50 10.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_10MM_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_12MM_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Aço - Barras de CA50 12.5mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_12MM_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA50_16MM_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Aço - Barras de CA50 16mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA50_16MM_PISCINA
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CA60_5MM_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Aço - Barras de CA60 5.0mm 12mts"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Barras 12mts"
Range("G" & PLIN).Value = CALC_CA60_5MM_PISCINA
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_CONCR_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = CP_RESISTENCIA_CONCRETO_PISCINA
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "m3"
Range("G" & PLIN).Value = CALC_CONCR_PISCINA
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_DISCO_FERRO_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Disco Ferro"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_DISCO_FERRO_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_ARAME_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Aço - Arame Recozido"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Kg"
Range("G" & PLIN).Value = CALC_ARAME_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PREGO_18X27_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Aço - Pregos 18x27"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Kg"
Range("G" & PLIN).Value = CALC_PREGO_18X27_PISCINA
End If



PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_PREGO_17X21_MARCACAO_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Aço - Pregos 17x21"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Supra Estrutura"
Range("F" & PLIN).Value = "Kg"
Range("G" & PLIN).Value = CALC_PREGO_17X21_MARCACAO_PISCINA
End If

'REVESTIMENTO

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_REVESTIMENTO_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Revestimento"
Range("C" & PLIN).Value = "Acabamento"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Revestimento"
Range("F" & PLIN).Value = "m2"
Range("G" & PLIN).Value = CALC_REVESTIMENTO_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_REJUNTES_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Rejunte - 5kg"
Range("C" & PLIN).Value = "Acabamento"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Revestimento"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_REJUNTES_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_ARGAMASSAS_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Argamassa AC 3 GF - 20kg"
Range("C" & PLIN).Value = "Acabamento"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Revestimento"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_ARGAMASSAS_PISCINA
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

If CALC_DISCO_PORCELANATO_PISCINA <> 0 Then
Range("a" & PLIN).Value = ORD_PISCINA
Range("B" & PLIN).Value = "Disco Porcelanato"
Range("C" & PLIN).Value = "Acabamento"
Range("D" & PLIN).Value = "Piscina"
Range("E" & PLIN).Value = "Revestimento"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_DISCO_PORCELANATO_PISCINA
End If


End Sub
