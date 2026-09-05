Attribute VB_Name = "K_COBERTURA"
Dim AREA_BARRO_PORTUGUESA As Double
Dim AREA_BARRO_AMERICANA As Double
Dim AREA_AMERICANA_CONCRETO As Double
Dim AREA_PLANA_CONCRETO As Double
Dim AREA_FIBROCIMENTO_6MM As Double
Dim AREA_FIBROCIMENTO_8MM As Double
Dim AREA_METALICA_SIMPLES As Double
Dim AREA_METALICA_TERMOACUSTICA As Double

Dim AREA_INCLINADA_1 As Double

'CUMEEIRA
Dim CUME_VAR_1 As Double
Dim CUME_VAR_2 As Double
Dim CUME_VAR_3 As Double
Dim CUME_VAR_4 As Double
Dim MTS_CUMEEIRA As Double
Dim CALC_CUMEEIRA As Double

Dim AREA_CUM_PORTUGUESA As Double
Dim AREA_CUM_AMERICANA As Double
Dim AREA_CUM_AMERICANA_CONCRETO As Double
Dim AREA_CUM_PLANA_CONCRETO As Double
Dim AREA_CUM_METALICA As Double
Dim AREA_CUM_FIBROCIMENTO As Double

Dim LARGURA_COBERTURA As Double
Dim COMPRIMENTO_COBERTURA As Double
Dim INCLINACAO_COBERTURA As Double
Dim AGUAS_COBERTURA As Double



'TELHAS
Dim TIPO_TELHA As String
Dim CALC_TELHAS As Double

'ESPAÇAMENTO MADEIRAS
Dim ESP_Tercas_Viga_5x15 As Double
Dim ESP_Caibros_5x5 As Double
Dim ESP_Ripas_25x5 As Double
Dim ESP_Apoio As Double
Dim ESP_BERCOS As Double
Dim ESP_MAO_FRANCESA As Double
Dim CALC_VIGAS As Double
Dim CALC_CAIBROS As Double
Dim CALC_RIPAS As Double
Dim CALC_APOIOS As Double
Dim CALC_ESPIGAO As Double
Dim CALC_BERCO As Double
Dim CALC_MAO_FRANCESA As Double
Dim CAIB_VAR_1 As Double
Dim CAIB_VAR_2 As Double
Dim ESPIG_VAR_1 As Double
Dim ESPIG_VAR_2 As Double
Dim ESPIG_VAR_3 As Double
Dim LASTCOLUMN As Long

Dim LINHA_AGUAS As Long
Dim LINHA_INCLINACAO As Long
Dim LINHA_TIPO_TELHA As Long
Dim CALC_PREGO_1 As Long
Dim CALC_PREGO_2 As Long
Dim CALC_VIGAS_TOTAL As Long
Dim CALC_CAIBROS_TOTAL As Long
Dim CALC_ESPIGAO_TOTAL As Long
Dim CALC_BERCO_TOTAL As Long
Dim CALC_MAO_FRANCESA_TOTAL As Long
Dim CALC_PREGO_1_TOTAL As Long
Dim CALC_PREGO_2_TOTAL As Long
Dim CALC_MANTA_TOTAL As Long
Dim CALC_RIPAS_TOTAL As Long

Dim TIPO_TELHA_1 As String
Dim TIPO_TELHA_2 As String
Dim TIPO_TELHA_3 As String
Dim TIPO_TELHA_4 As String
Dim TIPO_TELHA_5 As String
Dim TIPO_TELHA_6 As String
Dim TIPO_TELHA_7 As String
Dim TIPO_TELHA_8 As String


Dim CALC_TELHAS_1 As Double
Dim CALC_TELHAS_2 As Double
Dim CALC_TELHAS_3 As Double
Dim CALC_TELHAS_4 As Double
Dim CALC_TELHAS_5 As Double
Dim CALC_TELHAS_6 As Double
Dim CALC_TELHAS_7 As Double
Dim CALC_TELHAS_8 As Double

Dim CALC_CUMEEIRA_1 As Double
Dim CALC_CUMEEIRA_2 As Double
Dim CALC_CUMEEIRA_3 As Double
Dim CALC_CUMEEIRA_4 As Double
Dim CALC_CUMEEIRA_5 As Double
Dim CALC_CUMEEIRA_6 As Double
Dim CALC_CUMEEIRA_7 As Double
Dim CALC_CUMEEIRA_8 As Double



    Dim CalcularMedida As Double
    Dim maior As Double, menor As Double
   


Dim CALC_PERIMETRO_TOTAL As Double
Dim CALC_PERIMETRO As Double
Dim CALC_PERIMETRO_1 As Double
Dim CALC_PERIMETRO_2 As Double
Public CALC_AREA_COBERTURA_TOTAL As Double





Sub COBERTURA()

Call ATUALIZAR_CAMPOS

'ÁREA DAS TELHAS

AREA_BARRO_PORTUGUESA = 0.058
AREA_BARRO_AMERICANA = 0.083
AREA_AMERICANA_CONCRETO = 0.095
AREA_PLANA_CONCRETO = 0.095
AREA_FIBROCIMENTO_6MM = 1
AREA_FIBROCIMENTO_8MM = 1
AREA_METALICA_SIMPLES = 1
AREA_METALICA_TERMOACUSTICA = 1


'COMPRIMENTO CUMEEIRAS

AREA_CUM_PORTUGUESA = 0.41
AREA_CUM_AMERICANA = 0.44
AREA_CUM_AMERICANA_CONCRETO = 0.42
AREA_CUM_PLANA_CONCRETO = 0.33
AREA_CUM_METALICA = 1
AREA_CUM_FIBROCIMENTO = 1



CALC_VIGAS_TOTAL = 0
CALC_VIGAS = 0
CALC_CAIBROS_TOTAL = 0
CALC_CAIBROS = 0
CALC_RIPAS_TOTAL = 0
CALC_RIPAS = 0
CALC_ESPIGAO_TOTAL = 0
CALC_ESPIGAO = 0
CALC_BERCO_TOTAL = 0
CALC_BERCO = 0
CALC_MAO_FRANCESA_TOTAL = 0
CALC_MAO_FRANCESA = 0
CALC_PREGO_1_TOTAL = 0
CALC_PREGO_1 = 0
CALC_PREGO_2_TOTAL = 0
CALC_PREGO_2 = 0
CALC_MANTA_TOTAL = 0
CALC_MANTA = 0


CALC_TELHAS = 0
CALC_TELHAS_1 = 0
CALC_TELHAS_2 = 0
CALC_TELHAS_3 = 0
CALC_TELHAS_4 = 0
CALC_TELHAS_5 = 0
CALC_TELHAS_6 = 0
CALC_TELHAS_7 = 0
CALC_TELHAS_8 = 0



CALC_CUMEEIRA = 0
CALC_CUMEEIRA_1 = 0
CALC_CUMEEIRA_2 = 0
CALC_CUMEEIRA_3 = 0
CALC_CUMEEIRA_4 = 0
CALC_CUMEEIRA_5 = 0
CALC_CUMEEIRA_6 = 0
CALC_CUMEEIRA_7 = 0
CALC_CUMEEIRA_8 = 0




CALC_PERIMETRO_TOTAL = 0
CALC_PERIMETRO = 0

TIPO_TELHA_1 = "Telha Barro Portuguesa"
TIPO_TELHA_2 = "Telha Barro Americana"
TIPO_TELHA_3 = "Telha Americana Concreto"
TIPO_TELHA_4 = "Telha Plana Concreto"
TIPO_TELHA_5 = "Telha Fibrocimento 6mm"
TIPO_TELHA_6 = "Telha Fibrocimento 8mm"
TIPO_TELHA_7 = "Telha Metálica Termoacústica"
TIPO_TELHA_8 = "Telha Metálica Simples"


TIPO_TELHA_1 = CP_COBERTURA_1_EDIF



For N = 1 To 16

If N = 1 Then TIPO_TELHA = CP_COBERTURA_1_EDIF
If N = 1 Then COMPRIMENTO_COBERTURA = CP_COMP_COBERTURA_1_EDIF
If N = 1 Then LARGURA_COBERTURA = CP_LARG_COBERTURA_1_EDIF
If N = 1 Then AGUAS_COBERTURA = CP_AGUAS_COBERTURA_1_EDIF
If N = 1 Then INCLINACAO_COBERTURA = CP_INCL_COBERTURA_1_EDIF

If N = 2 Then TIPO_TELHA = CP_COBERTURA_2_EDIF
If N = 2 Then COMPRIMENTO_COBERTURA = CP_COMP_COBERTURA_2_EDIF
If N = 2 Then LARGURA_COBERTURA = CP_LARG_COBERTURA_2_EDIF
If N = 2 Then AGUAS_COBERTURA = CP_AGUAS_COBERTURA_2_EDIF
If N = 2 Then INCLINACAO_COBERTURA = CP_INCL_COBERTURA_2_EDIF

If N = 3 Then TIPO_TELHA = CP_COBERTURA_3_EDIF
If N = 3 Then COMPRIMENTO_COBERTURA = CP_COMP_COBERTURA_3_EDIF
If N = 3 Then LARGURA_COBERTURA = CP_LARG_COBERTURA_3_EDIF
If N = 3 Then AGUAS_COBERTURA = CP_AGUAS_COBERTURA_3_EDIF
If N = 3 Then INCLINACAO_COBERTURA = CP_INCL_COBERTURA_3_EDIF

If N = 4 Then TIPO_TELHA = CP_COBERTURA_4_EDIF
If N = 4 Then COMPRIMENTO_COBERTURA = CP_COMP_COBERTURA_4_EDIF
If N = 4 Then LARGURA_COBERTURA = CP_LARG_COBERTURA_4_EDIF
If N = 4 Then AGUAS_COBERTURA = CP_AGUAS_COBERTURA_4_EDIF
If N = 4 Then INCLINACAO_COBERTURA = CP_INCL_COBERTURA_4_EDIF

If N = 5 Then TIPO_TELHA = CP_COBERTURA_5_EDIF
If N = 5 Then COMPRIMENTO_COBERTURA = CP_COMP_COBERTURA_5_EDIF
If N = 5 Then LARGURA_COBERTURA = CP_LARG_COBERTURA_5_EDIF
If N = 5 Then AGUAS_COBERTURA = CP_AGUAS_COBERTURA_5_EDIF
If N = 5 Then INCLINACAO_COBERTURA = CP_INCL_COBERTURA_5_EDIF


If N = 6 Then TIPO_TELHA = CP_COBERTURA_6_EDIF
If N = 6 Then COMPRIMENTO_COBERTURA = CP_COMP_COBERTURA_6_EDIF
If N = 6 Then LARGURA_COBERTURA = CP_LARG_COBERTURA_6_EDIF
If N = 6 Then AGUAS_COBERTURA = CP_AGUAS_COBERTURA_6_EDIF
If N = 6 Then INCLINACAO_COBERTURA = CP_INCL_COBERTURA_6_EDIF

If N = 7 Then TIPO_TELHA = CP_COBERTURA_7_EDIF
If N = 7 Then COMPRIMENTO_COBERTURA = CP_COMP_COBERTURA_7_EDIF
If N = 7 Then LARGURA_COBERTURA = CP_LARG_COBERTURA_7_EDIF
If N = 7 Then AGUAS_COBERTURA = CP_AGUAS_COBERTURA_7_EDIF
If N = 7 Then INCLINACAO_COBERTURA = CP_INCL_COBERTURA_7_EDIF

If N = 8 Then TIPO_TELHA = CP_COBERTURA_8_EDIF
If N = 8 Then COMPRIMENTO_COBERTURA = CP_COMP_COBERTURA_8_EDIF
If N = 8 Then LARGURA_COBERTURA = CP_LARG_COBERTURA_8_EDIF
If N = 8 Then AGUAS_COBERTURA = CP_AGUAS_COBERTURA_8_EDIF
If N = 8 Then INCLINACAO_COBERTURA = CP_INCL_COBERTURA_8_EDIF

If N = 9 Then TIPO_TELHA = CP_COBERTURA_9_EDIF
If N = 9 Then COMPRIMENTO_COBERTURA = CP_COMP_COBERTURA_9_EDIF
If N = 9 Then LARGURA_COBERTURA = CP_LARG_COBERTURA_9_EDIF
If N = 9 Then AGUAS_COBERTURA = CP_AGUAS_COBERTURA_9_EDIF
If N = 9 Then INCLINACAO_COBERTURA = CP_INCL_COBERTURA_9_EDIF

If N = 10 Then TIPO_TELHA = CP_COBERTURA_10_EDIF
If N = 10 Then COMPRIMENTO_COBERTURA = CP_COMP_COBERTURA_10_EDIF
If N = 10 Then LARGURA_COBERTURA = CP_LARG_COBERTURA_10_EDIF
If N = 10 Then AGUAS_COBERTURA = CP_AGUAS_COBERTURA_10_EDIF
If N = 10 Then INCLINACAO_COBERTURA = CP_INCL_COBERTURA_10_EDIF

If N = 11 Then TIPO_TELHA = CP_COBERTURA_11_EDIF
If N = 11 Then COMPRIMENTO_COBERTURA = CP_COMP_COBERTURA_11_EDIF
If N = 11 Then LARGURA_COBERTURA = CP_LARG_COBERTURA_11_EDIF
If N = 11 Then AGUAS_COBERTURA = CP_AGUAS_COBERTURA_11_EDIF
If N = 11 Then INCLINACAO_COBERTURA = CP_INCL_COBERTURA_11_EDIF

If N = 12 Then TIPO_TELHA = CP_COBERTURA_12_EDIF
If N = 12 Then COMPRIMENTO_COBERTURA = CP_COMP_COBERTURA_12_EDIF
If N = 12 Then LARGURA_COBERTURA = CP_LARG_COBERTURA_12_EDIF
If N = 12 Then AGUAS_COBERTURA = CP_AGUAS_COBERTURA_12_EDIF
If N = 12 Then INCLINACAO_COBERTURA = CP_INCL_COBERTURA_12_EDIF

If N = 13 Then TIPO_TELHA = CP_COBERTURA_13_EDIF
If N = 13 Then COMPRIMENTO_COBERTURA = CP_COMP_COBERTURA_13_EDIF
If N = 13 Then LARGURA_COBERTURA = CP_LARG_COBERTURA_13_EDIF
If N = 13 Then AGUAS_COBERTURA = CP_AGUAS_COBERTURA_13_EDIF
If N = 13 Then INCLINACAO_COBERTURA = CP_INCL_COBERTURA_13_EDIF

If N = 14 Then TIPO_TELHA = CP_COBERTURA_14_EDIF
If N = 14 Then COMPRIMENTO_COBERTURA = CP_COMP_COBERTURA_14_EDIF
If N = 14 Then LARGURA_COBERTURA = CP_LARG_COBERTURA_14_EDIF
If N = 14 Then AGUAS_COBERTURA = CP_AGUAS_COBERTURA_14_EDIF
If N = 14 Then INCLINACAO_COBERTURA = CP_INCL_COBERTURA_14_EDIF

If N = 15 Then TIPO_TELHA = CP_COBERTURA_15_EDIF
If N = 15 Then COMPRIMENTO_COBERTURA = CP_COMP_COBERTURA_15_EDIF
If N = 15 Then LARGURA_COBERTURA = CP_LARG_COBERTURA_15_EDIF
If N = 15 Then AGUAS_COBERTURA = CP_AGUAS_COBERTURA_15_EDIF
If N = 15 Then INCLINACAO_COBERTURA = CP_INCL_COBERTURA_15_EDIF

If N = 16 Then TIPO_TELHA = CP_COBERTURA_16_EDIF
If N = 16 Then COMPRIMENTO_COBERTURA = CP_COMP_COBERTURA_16_EDIF
If N = 16 Then LARGURA_COBERTURA = CP_LARG_COBERTURA_16_EDIF
If N = 16 Then AGUAS_COBERTURA = CP_AGUAS_COBERTURA_16_EDIF
If N = 16 Then INCLINACAO_COBERTURA = CP_INCL_COBERTURA_16_EDIF




'CAIBROS
ESP_Tercas_Viga_5x15 = 1.5
If TIPO_TELHA = "Telha Barro Portuguesa" Or TIPO_TELHA = "Telha Barro Americana" Or TIPO_TELHA = "Telha Americana Concreto" Or TIPO_TELHA = "Telha Plana Concreto" Then ESP_Caibros_5x5 = 0.5
If TIPO_TELHA = "Telha Fibrocimento 6mm" Or TIPO_TELHA = "Telha Fibrocimento 8mm" Then ESP_Caibros_5x5 = 1
If TIPO_TELHA = "Telha Metálica Termoacústica" Or TIPO_TELHA = "Telha Metálica Simples" Then ESP_Caibros_5x5 = 1.5

'RIPAS
If TIPO_TELHA = "Telha Barro Portuguesa" Or TIPO_TELHA = "Telha Plana Concreto" Or TIPO_TELHA = "Telha Americana Concreto" Then ESP_Ripas_25x5 = 0.34
If TIPO_TELHA = "Telha Barro Americana" Then ESP_Ripas_25x5 = 0.3
If TIPO_TELHA = "Telha Fibrocimento 6mm" Or TIPO_TELHA = "Telha Fibrocimento 8mm" Then ESP_Ripas_25x5 = 0
If TIPO_TELHA = "Telha Metálica Termoacústica" Or TIPO_TELHA = "Telha Metálica Simples" Then ESP_Ripas_25x5 = 0

'APOIOS
If TIPO_TELHA = "Telha Barro Portuguesa" Or TIPO_TELHA = "Telha Barro Americana" Or TIPO_TELHA = "Telha Plana Concreto" Then ESP_Apoio = 0
If TIPO_TELHA = "Telha Americana Concreto" Then ESP_Apoio = 0
If TIPO_TELHA = "Telha Fibrocimento 6mm" Or TIPO_TELHA = "Telha Fibrocimento 8mm" Then ESP_Apoio = 1.02
If TIPO_TELHA = "Telha Metálica Termoacústica" Or TIPO_TELHA = "Telha Metálica Simples" Then ESP_Apoio = 1

'BERÇOS
If TIPO_TELHA = "Telha Barro Portuguesa" Or TIPO_TELHA = "Telha Barro Americana" Or TIPO_TELHA = "Telha Plana Concreto" Or TIPO_TELHA = "Telha Americana Concreto" Then ESP_BERCOS = 0.6
If TIPO_TELHA = "Telha Fibrocimento 6mm" Or TIPO_TELHA = "Telha Fibrocimento 8mm" Then ESP_BERCOS = 0
If TIPO_TELHA = "Telha Metálica Termoacústica" Or TIPO_TELHA = "Telha Metálica Simples" Then ESP_BERCOS = 0

'MÃO FRANCESA
If TIPO_TELHA = "Telha Barro Portuguesa" Or TIPO_TELHA = "Telha Barro Americana" Or TIPO_TELHA = "Telha Plana Concreto" Or TIPO_TELHA = "Telha Americana Concreto" Then ESP_MAO_FRANCESA = 1.2
If TIPO_TELHA = "Telha Fibrocimento 6mm" Or TIPO_TELHA = "Telha Fibrocimento 8mm" Then ESP_MAO_FRANCESA = 0
If TIPO_TELHA = "Telha Metálica Termoacústica" Or TIPO_TELHA = "Telha Metálica Simples" Then ESP_MAO_FRANCESA = 0



'VIGAS
CALC_VIGAS = WorksheetFunction.Ceiling(((((LARGURA_COBERTURA / ESP_Tercas_Viga_5x15) + 1) * COMPRIMENTO_COBERTURA) * 1.1), 1)

'CAIBROS
If AGUAS_COBERTURA = 1 Then
CAIB_VAR_1 = WorksheetFunction.Ceiling(LARGURA_COBERTURA * (((INCLINACAO_COBERTURA * 1) ^ 2) + (1 ^ 2)) ^ (1 / 2), 1)
Else: CAIB_VAR_1 = WorksheetFunction.Ceiling((LARGURA_COBERTURA / 2) * (((INCLINACAO_COBERTURA * 1) ^ 2) + (1 ^ 2)) ^ (1 / 2), 1)
End If

If ESP_Caibros_5x5 = 0 Then
CAIB_VAR_2 = 0
ElseIf AGUAS_COBERTURA = 1 Then
CAIB_VAR_2 = WorksheetFunction.Ceiling(((COMPRIMENTO_COBERTURA * 2) + 2) / 2 / ESP_Caibros_5x5, 1)
Else: CAIB_VAR_2 = WorksheetFunction.Ceiling(((COMPRIMENTO_COBERTURA * 2) + 1) / ESP_Caibros_5x5, 1)
End If

CALC_CAIBROS = WorksheetFunction.Ceiling((CAIB_VAR_1 * CAIB_VAR_2) * 1.1, 1)

'RIPAS
If ESP_Ripas_25x5 = 0 Then
CALC_RIPAS = 0
Else: CALC_RIPAS = WorksheetFunction.Ceiling((LARGURA_COBERTURA / ESP_Ripas_25x5 * COMPRIMENTO_COBERTURA) * 1.1, 1)
End If

'APOIOS
If ESP_Apoio = 0 Then
CALC_APOIOS = 0
Else: CALC_APOIOS = WorksheetFunction.Ceiling((LARGURA_COBERTURA / ESP_Apoio * 0.51) * 1.1, 1)
End If

'ESPIGÃO
If AGUAS_COBERTURA = 1 Or AGUAS_COBERTURA = 2 Then
ESPIG_VAR_1 = 0
Else
ESPIG_VAR_1 = LARGURA_COBERTURA / 2
End If

If AGUAS_COBERTURA = 1 Or AGUAS_COBERTURA = 2 Then
ESPIG_VAR_2 = 0
Else
ESPIG_VAR_2 = LARGURA_COBERTURA / 2
End If

If AGUAS_COBERTURA = 3 Then
ESPIG_VAR_3 = 2
ElseIf AGUAS_COBERTURA = 4 Then
ESPIG_VAR_3 = 4
Else
ESPIG_VAR_3 = 0
End If


CALC_ESPIGAO = WorksheetFunction.Ceiling(((((ESPIG_VAR_1 ^ 2) + (ESPIG_VAR_2 ^ 2)) ^ (1 / 2)) * ESPIG_VAR_3) * 1.1, 1)


'BERÇOS
CALC_BERCO = WorksheetFunction.Ceiling((ESP_BERCOS * LARGURA_COBERTURA * 0.5) * 1.1, 1)

CALC_MAO_FRANCESA = WorksheetFunction.Ceiling((ESP_MAO_FRANCESA * LARGURA_COBERTURA * 0.45) * 1.1, 1)


AREA_INCLINADA_1 = COMPRIMENTO_COBERTURA * LARGURA_COBERTURA * (((INCLINACAO_COBERTURA * 1) ^ 2) + (1 ^ 2)) ^ (1 / 2)

If AGUAS_COBERTURA = 3 Then
    CUME_VAR_1 = 2
ElseIf AGUAS_COBERTURA = 4 Then
    CUME_VAR_1 = 4
Else
    CUME_VAR_1 = 0
End If

If AGUAS_COBERTURA = 1 Or AGUAS_COBERTURA = 2 Then
    CUME_VAR_2 = 0
Else
CUME_VAR_2 = LARGURA_COBERTURA / 2
End If

If AGUAS_COBERTURA = 1 Or AGUAS_COBERTURA = 2 Then
    CUME_VAR_3 = 0
Else
CUME_VAR_3 = LARGURA_COBERTURA / 2
End If

If AGUAS_COBERTURA = 3 Then
    CUME_VAR_4 = COMPRIMENTO_COBERTURA - (LARGURA_COBERTURA / 2)
ElseIf AGUAS_COBERTURA = 4 Then
CUME_VAR_4 = COMPRIMENTO_COBERTURA - LARGURA_COBERTURA
Else
CUME_VAR_4 = COMPRIMENTO_COBERTURA
End If


'AREA TELHA
If TIPO_TELHA = "Telha Barro Portuguesa" Then AREA_TELHA = AREA_BARRO_PORTUGUESA
If TIPO_TELHA = "Telha Barro Americana" Then AREA_TELHA = AREA_BARRO_AMERICANA
If TIPO_TELHA = "Telha Americana Concreto" Then AREA_TELHA = AREA_AMERICANA_CONCRETO
If TIPO_TELHA = "Telha Plana Concreto" Then AREA_TELHA = AREA_PLANA_CONCRETO
If TIPO_TELHA = "Telha Fibrocimento 6mm" Then AREA_TELHA = AREA_FIBROCIMENTO_6MM
If TIPO_TELHA = "Telha Fibrocimento 8mm" Then AREA_TELHA = AREA_FIBROCIMENTO_8MM
If TIPO_TELHA = "Telha Metálica Termoacústica" Then AREA_TELHA = AREA_METALICA_TERMOACUSTICA
If TIPO_TELHA = "Telha Metálica Simples" Then AREA_TELHA = AREA_METALICA_SIMPLES

'AREA CUMEEIRA
If TIPO_TELHA = "Telha Barro Portuguesa" Then AREA_CUMEEIRA = AREA_CUM_PORTUGUESA
If TIPO_TELHA = "Telha Barro Americana" Then AREA_CUMEEIRA = AREA_CUM_AMERICANA
If TIPO_TELHA = "Telha Americana Concreto" Then AREA_CUMEEIRA = AREA_CUM_AMERICANA_CONCRETO
If TIPO_TELHA = "Telha Plana Concreto" Then AREA_CUMEEIRA = AREA_CUM_PLANA_CONCRETO
If TIPO_TELHA = "Telha Fibrocimento 6mm" Then AREA_CUMEEIRA = AREA_CUM_FIBROCIMENTO
If TIPO_TELHA = "Telha Fibrocimento 8mm" Then AREA_CUMEEIRA = AREA_CUM_FIBROCIMENTO
If TIPO_TELHA = "Telha Metálica Termoacústica" Then AREA_CUMEEIRA = AREA_CUM_METALICA
If TIPO_TELHA = "Telha Metálica Simples" Then AREA_CUMEEIRA = AREA_CUM_METALICA


' RUFO
CALC_PERIMETRO_1 = (LARGURA_COBERTURA + COMPRIMENTO_COBERTURA) * 2 * 1.1


 maior = Application.WorksheetFunction.Max(LARGURA_COBERTURA, COMPRIMENTO_COBERTURA)
 menor = Application.WorksheetFunction.Min(LARGURA_COBERTURA, COMPRIMENTO_COBERTURA)

    
    Select Case AGUAS_COBERTURA
        Case 1
            CalcularMedida = maior
        Case 2
            CalcularMedida = 2 * maior
        Case 3
            CalcularMedida = (2 * maior) + menor
        Case 4
            CalcularMedida = (LARGURA_COBERTURA + COMPRIMENTO_COBERTURA) * 2 * 1.1
        Case Else
            CalcularMedida = CALC_PERIMETRO_1 ' Valor padrão para casos não definidos
    End Select


'CALHA
CALC_PERIMETRO_2 = CalcularMedida


MTS_CUMEEIRA = (((CUME_VAR_1) * ((CUME_VAR_2 ^ 2) + (CUME_VAR_3 ^ 2)) ^ (1 / 2)) + (CUME_VAR_4)) * 1.1
CALC_TELHAS = WorksheetFunction.Ceiling((AREA_INCLINADA_1 / AREA_TELHA) * 1.1, 1)
CALC_CUMEEIRA = WorksheetFunction.Ceiling((MTS_CUMEEIRA / (AREA_CUMEEIRA - 0.05)) * 1.1, 1)
CALC_PREGO_1 = WorksheetFunction.Ceiling(AREA_INCLINADA_1 * 0.016 * 1.1, 1)
CALC_PREGO_2 = WorksheetFunction.Ceiling(AREA_INCLINADA_1 * 0.021 * 1.1, 1)
CALC_MANTA = WorksheetFunction.Ceiling(AREA_INCLINADA_1 * 1.2, 1)


If TIPO_TELHA = "Telha Barro Portuguesa" Or TIPO_TELHA = "Telha Barro Americana" Or TIPO_TELHA = "Telha Americana Concreto" Or TIPO_TELHA = "Telha Plana Concreto" Then CALC_PERIMETRO_1 = 0


CALC_PERIMETRO_TOTAL_1 = CALC_PERIMETRO_TOTAL_1 + CALC_PERIMETRO_1
CALC_PERIMETRO_TOTAL_2 = CALC_PERIMETRO_TOTAL_2 + CALC_PERIMETRO_2



CALC_VIGAS_TOTAL = CALC_VIGAS_TOTAL + CALC_VIGAS + CALC_ESPIGAO + CALC_MAO_FRANCESA
CALC_CAIBROS_TOTAL = CALC_CAIBROS_TOTAL + CALC_CAIBROS
CALC_RIPAS_TOTAL = CALC_RIPAS_TOTAL + CALC_RIPAS
CALC_BERCO_TOTAL = CALC_BERCO_TOTAL + CALC_BERCO + CALC_APOIOS
CALC_MAO_FRANCESA_TOTAL = CALC_MAO_FRANCESA_TOTAL + CALC_MAO_FRANCESA
CALC_PREGO_2_TOTAL = CALC_PREGO_2_TOTAL + CALC_PREGO_2
CALC_MANTA_TOTAL = CALC_MANTA_TOTAL + CALC_MANTA
CALC_PREGO_1_TOTAL = CALC_PREGO_1_TOTAL + CALC_PREGO_1
CALC_AREA_COBERTURA_TOTAL = CALC_AREA_COBERTURA_TOTAL + AREA_INCLINADA_1


If TIPO_TELHA = "Telha Barro Portuguesa" Then CALC_TELHAS_1 = CALC_TELHAS_1 + CALC_TELHAS
If TIPO_TELHA = "Telha Barro Americana" Then CALC_TELHAS_2 = CALC_TELHAS_2 + CALC_TELHAS
If TIPO_TELHA = "Telha Americana Concreto" Then CALC_TELHAS_3 = CALC_TELHAS_3 + CALC_TELHAS
If TIPO_TELHA = "Telha Plana Concreto" Then CALC_TELHAS_4 = CALC_TELHAS_4 + CALC_TELHAS
If TIPO_TELHA = "Telha Fibrocimento 6mm" Then CALC_TELHAS_5 = CALC_TELHAS_5 + CALC_TELHAS
If TIPO_TELHA = "Telha Fibrocimento 8mm" Then CALC_TELHAS_6 = CALC_TELHAS_6 + CALC_TELHAS
If TIPO_TELHA = "Telha Metálica Termoacústica" Then CALC_TELHAS_7 = CALC_TELHAS_7 + CALC_TELHAS
If TIPO_TELHA = "Telha Metálica Simples" Then CALC_TELHAS_8 = CALC_TELHAS_8 + CALC_TELHAS


If TIPO_TELHA = "Telha Barro Portuguesa" Then CALC_CUMEEIRA_1 = CALC_CUMEEIRA_1 + CALC_CUMEEIRA
If TIPO_TELHA = "Telha Barro Americana" Then CALC_CUMEEIRA_2 = CALC_CUMEEIRA_2 + CALC_CUMEEIRA
If TIPO_TELHA = "Telha Americana Concreto" Then CALC_CUMEEIRA_3 = CALC_CUMEEIRA_3 + CALC_CUMEEIRA
If TIPO_TELHA = "Telha Plana Concreto" Then CALC_CUMEEIRA_4 = CALC_CUMEEIRA_4 + CALC_CUMEEIRA
If TIPO_TELHA = "Telha Fibrocimento 6mm" Then CALC_CUMEEIRA_5 = CALC_CUMEEIRA_5 + CALC_CUMEEIRA
If TIPO_TELHA = "Telha Fibrocimento 8mm" Then CALC_CUMEEIRA_6 = CALC_CUMEEIRA_6 + CALC_CUMEEIRA
If TIPO_TELHA = "Telha Metálica Termoacústica" Then CALC_CUMEEIRA_7 = CALC_CUMEEIRA_7 + CALC_CUMEEIRA
If TIPO_TELHA = "Telha Metálica Simples" Then CALC_CUMEEIRA_8 = CALC_CUMEEIRA_8 + CALC_CUMEEIRA






Next N





Windows("NOVO MODELO ORÇAMENTO.xlsm").Activate

Sheets("RESUMO").Select


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'TELHAS 1
If CALC_TELHAS_1 <> 0 Or CALC_TELHAS_1 <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = TIPO_TELHA_1
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Telhas"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_TELHAS_1
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'CUMMEIRAS_1
If CALC_CUMEEIRA_1 <> 0 Or CALC_CUMEEIRA_1 <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = WorksheetFunction.Concat("Cumeeira ", TIPO_TELHA_1)
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Telhas"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_CUMEEIRA_1
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'TELHAS 2
If CALC_TELHAS_2 <> 0 Or CALC_TELHAS_2 <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = TIPO_TELHA_2
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Telhas"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_TELHAS_2
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'CUMMEIRAS_2
If CALC_CUMEEIRA_2 <> 0 Or CALC_CUMEEIRA_2 <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = WorksheetFunction.Concat("Cumeeira ", TIPO_TELHA_2)
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Telhas"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_CUMEEIRA_2
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'TELHAS 3
If CALC_TELHAS_3 <> 0 Or CALC_TELHAS_3 <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = TIPO_TELHA_3
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Telhas"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_TELHAS_3
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'CUMMEIRAS_3
If CALC_CUMEEIRA_3 <> 0 Or CALC_CUMEEIRA_3 <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = WorksheetFunction.Concat("Cumeeira ", TIPO_TELHA_3)
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Telhas"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_CUMEEIRA_3
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'TELHAS 4
If CALC_TELHAS_4 <> 0 Or CALC_TELHAS_4 <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = TIPO_TELHA_4
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Telhas"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_TELHAS_4
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'CUMMEIRAS_4
If CALC_CUMEEIRA_4 <> 0 Or CALC_CUMEEIRA_4 <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = WorksheetFunction.Concat("Cumeeira ", TIPO_TELHA_4)
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Telhas"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_CUMEEIRA_4
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'TELHAS 5
If CALC_TELHAS_5 <> 0 Or CALC_TELHAS_5 <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = TIPO_TELHA_5
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Telhas"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_TELHAS_5
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'CUMMEIRAS_5
If CALC_CUMEEIRA_5 <> 0 Or CALC_CUMEEIRA_5 <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = WorksheetFunction.Concat("Cumeeira ", TIPO_TELHA_5)
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Telhas"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_CUMEEIRA_5
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'TELHAS 6
If CALC_TELHAS_6 <> 0 Or CALC_TELHAS_6 <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = TIPO_TELHA_6
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Telhas"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_TELHAS_6
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'CUMMEIRAS_6
If CALC_CUMEEIRA_6 <> 0 Or CALC_CUMEEIRA_6 <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = WorksheetFunction.Concat("Cumeeira ", TIPO_TELHA_6)
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Telhas"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_CUMEEIRA_6
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'TELHAS 7
If CALC_TELHAS_7 <> 0 Or CALC_TELHAS_7 <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = TIPO_TELHA_7
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Telhas"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_TELHAS_7
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'CUMMEIRAS_7
If CALC_CUMEEIRA_7 <> 0 Or CALC_CUMEEIRA_7 <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = WorksheetFunction.Concat("Cumeeira ", TIPO_TELHA_7)
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Telhas"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_CUMEEIRA_7
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'TELHAS 8
If CALC_TELHAS_8 <> 0 Or CALC_TELHAS_8 <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = TIPO_TELHA_8
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Telhas"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_TELHAS_8
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'CUMMEIRAS_8
If CALC_CUMEEIRA_8 <> 0 Or CALC_CUMEEIRA_8 <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = WorksheetFunction.Concat("Cumeeira ", TIPO_TELHA_8)
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Telhas"
Range("F" & PLIN).Value = "Unidades"
Range("G" & PLIN).Value = CALC_CUMEEIRA_8
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'MANTA
If CALC_MANTA_TOTAL <> 0 Or CALC_MANTA_TOTAL <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = "Manta dupla face"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Telhas"
Range("F" & PLIN).Value = "m2"
Range("G" & PLIN).Value = CALC_MANTA_TOTAL
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'MADEIRAS VIGAS
If CALC_VIGAS_TOTAL <> 0 Or CALC_VIGAS_TOTAL <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = "Telhado - Estrutura - Eucalipto S/ Tratar - Vigas 5x15"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Madeiramento"
Range("F" & PLIN).Value = "Mts"
Range("G" & PLIN).Value = CALC_VIGAS_TOTAL
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'MADEIRAS CAIBROS
If CALC_CAIBROS_TOTAL <> 0 Or CALC_CAIBROS_TOTAL <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = "Telhado - Estrutura - Eucalipto S/ Tratar - Caibros 5x5"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Madeiramento"
Range("F" & PLIN).Value = "Mts"
Range("G" & PLIN).Value = CALC_CAIBROS_TOTAL
End If


PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'MADEIRAS RIPAS
If CALC_RIPAS_TOTAL <> 0 Or CALC_RIPAS_TOTAL <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = "Telhado - Estrutura - Eucalipto S/ Tratar - Ripas 2,5x5"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Madeiramento"
Range("F" & PLIN).Value = "Mts"
Range("G" & PLIN).Value = CALC_RIPAS_TOTAL
End If




PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'MADEIRAS BERÇOS
If CALC_BERCO_TOTAL <> 0 Or CALC_BERCO_TOTAL <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = "Telhado - Estrutura - Eucalipto S/ Tratar - Vigas 5x20"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Madeiramento"
Range("F" & PLIN).Value = "Mts"
Range("G" & PLIN).Value = CALC_BERCO_TOTAL
End If




PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'PREGO
If CALC_PREGO_1_TOTAL <> 0 Or CALC_PREGO_1_TOTAL <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = "Aço - Pregos 18x27"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Madeiramento"
Range("F" & PLIN).Value = "KG"
Range("G" & PLIN).Value = CALC_PREGO_1_TOTAL
End If



PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'PREGO
If CALC_PREGO_2_TOTAL <> 0 Or CALC_PREGO_2_TOTAL <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = "Aço - Pregos 20x42"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Madeiramento"
Range("F" & PLIN).Value = "KG"
Range("G" & PLIN).Value = CALC_PREGO_2_TOTAL
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'CALHA
If CALC_PERIMETRO_TOTAL_2 <> 0 Or CALC_PERIMETRO_TOTAL_2 <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = "Telhado - Calha"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Calha"
Range("F" & PLIN).Value = "Mts"
Range("G" & PLIN).Value = CALC_PERIMETRO_TOTAL_2
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'PINGADEIRA
If CALC_PERIMETRO_TOTAL_1 <> 0 Or CALC_PERIMETRO_TOTAL_1 <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = "Telhado - Pingadeira"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Calha"
Range("F" & PLIN).Value = "Mts"
Range("G" & PLIN).Value = CALC_PERIMETRO_TOTAL_1 - CALC_PERIMETRO_TOTAL_2
End If

PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row + 1

'RUFO
If CALC_PERIMETRO_TOTAL_1 <> 0 Or CALC_PERIMETRO_TOTAL_1 <> 0 Then
Range("a" & PLIN).Value = ORD_COBERTURA
Range("B" & PLIN).Value = "Telhado - Rufo"
Range("C" & PLIN).Value = "Bruto"
Range("D" & PLIN).Value = "Cobertura"
Range("E" & PLIN).Value = "Calha"
Range("F" & PLIN).Value = "Mts"
Range("G" & PLIN).Value = CALC_PERIMETRO_TOTAL_1
End If

End Sub
