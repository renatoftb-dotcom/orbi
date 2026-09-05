Attribute VB_Name = "A_GERAR_ORCAMENTO"
Sub GERAR_ORCAMENTO()


    Dim ws As Worksheet
    Dim rng As Range
    
    Windows("NOVO MODELO ORÇAMENTO.xlsm").Activate

    Sheets("RESUMO").Select
    
    PLIN = Sheets("RESUMO").Range("A1048576").End(xlUp).Row
    
   
    Set ws = ThisWorkbook.Sheets("RESUMO")
    
    Set rng = ws.Range("A2:l" & PLIN)
    
    rng.ClearContents
    
    Range("a1") = "EXECUÇÃO"
    Range("B1") = "ITEM"
    Range("C1") = "TIPO"
    Range("D1") = "ETAPA"
    Range("E1") = "SUB ETAPA"
    Range("F1") = "UNIDADE"
    Range("G1") = "QTD"
    Range("H1") = "PREÇO"
    Range("I1") = "TOTAL"
    Range("J1") = "COMPRADO"
    Range("K1") = "A COMPRAR"
    
    
    
    Call ATUALIZAR_CAMPOS
    Call DECLARAR_VARIAVEIS
    'Call INPUT_DADOS_ARQ
    'Call INPUT_DADOS_ENGENHARIA
    Call INICIAR
   
    
    
    
  
    Call INSTALACOES_OBRA_PROJETOS
    Call FUNDACAO
    'Call ESGOTO_PLUVIAL_TERREO
    Call CONTRAPISO_INTERNO_TERREO
    Call PAREDES_TERREO
    Call VIGA_RESPALDO_LAJE_TERREO
    If Sheets("GERAL").Range("c6") = "Sobrado" Then Call PAREDES_PAV_1
    If Sheets("GERAL").Range("c6") = "Sobrado" Then Call VIGA_RESPALDO_LAJE_PAV_1
    Call SUPRA_COBERTURA
    Call COBERTURA
    Call CHAPISCO_REBOCO
    Call PINTURA
    Call CONTRAPISOS_EXTERNOS
    Call MURO_DIVISA
    Call MURO_DE_CONTENCAO
    Call PISCINA
    Call RUN_PRESTADORES
    
    
    
End Sub



