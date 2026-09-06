# Cronograma de obra — como o modelo antigo faz e o que o mercado faz

Análise para implementação futura no VICKE. Fonte: aba `CRONOGRAMA ESTIMADO`
e macro `CRONOGRAMA()` (Módulo1) do `Base Orçamento Obra.xlsm`.

## 1. Como o modelo antigo calcula

**Prazo total pela área.** Uma tabela dá o prazo em meses por faixa de área
e tipologia: térrea 60 m² 6,6 · 100 m² 13,2 · 150 m² 14,3 · 200 m² 16,5 ·
250 m² 17,6 · 300 m² 18,7 · 350 m² 20,9 · 400 m² 22,0; sobrado = térrea +
1,5. A área da obra é arredondada para a faixa (`Metragem adj`), e o prazo
vira um **fator de escala** `= (prazo da tabela / 10) × 0,85` — ou seja, as
durações das etapas foram calibradas para uma obra "base" de 10 meses e
esticam ou encolhem com esse fator (150 m² sobrado → 15,8 meses → fator
1,343).

**55 etapas com predecessora.** Cada linha tem: etapa, predecessora (`Ninguem`
para as iniciais), duração estimada em meses na obra base (1 a 4; supra do
pav. 2 = 4; reboco e pintura = 3; ajustes por tipo de parede), duração
escalada (`estimado × fator`), duração arredondada para baixo (mínimo 1) e o
resto fracionário. Início = mês em que a predecessora **termina** (não o
seguinte — as etapas se sobrepõem no mês de transição); fim = início +
duração − 1. A rede é resolvida por `VLOOKUP` na própria tabela, então cada
etapa só pode ter **uma** predecessora. Há etapas paralelas de instalação
embutidas na estrutura (elétrica na fundação/laje 1/laje 2, hidráulica na
laje, esgoto na fundação), piscina como sub-rede própria, e "Limpeza final"
fechando após a pintura. Exemplo (sobrado 150 m²): fundação meses 2–3,
paredes pav. 1 meses 3–4, pav. 2 meses 4–8, reboco 8–11, pintura 11–14,
limpeza mês 15.

**Distribuição mensal.** A macro escreve, por etapa, `1/duração` em cada mês
do intervalo e o resto fracionário no mês seguinte (colunas m1…m28,
máximo 28 meses). A linha 69 marca os meses ativos da obra, e é **isso que
alimenta os custos que dependem de tempo** em outras abas: locação de
container e betoneira (× meses; betoneira dobra acima de 100 m²), caçambas
de entulho, escoras (meses da laje ÷ 2) e andaimes (meses de reboco).

**Tabela de incidência.** Abaixo, uma tabela "CAIXA" com o valor da obra
(R$ 420 mil, 12 meses) rateado por etapa com percentuais mínimo/máximo — as
faixas clássicas da Revista Construção (PINI): barracão/projetos 1,1–4,0%,
infraestrutura 3,1–7,4%, supraestrutura 12,2–17,7%, paredes 4,8–10,7%,
esquadrias 4,2–13,3%, cobertura 0–12,9%, revestimentos internos 6,8–9,3%,
pinturas 3,6–6,5%, pisos 8,4–11,5%, elétrica 3,8–4,9%, hidráulica 3,6–4,3%
etc., com uma coluna "ok" que confere se o rateio está dentro da faixa. Não
está ligada ao cronograma: é um sanity check do orçamento por etapa.

**O que ele faz bem:** rede de precedência com sobreposição, prazo
paramétrico pela área (calibrado com a experiência do escritório), e —
o mais valioso — o cronograma **realimenta o orçamento** nos itens que custam
por mês.

**Onde fica aquém:** duração não vem das quantidades nem da equipe (uma obra
de 150 m² com 3 pedreiros ou 8 leva o mesmo tempo); uma predecessora por
etapa e sem folgas/caminho crítico; só meses inteiros, sem data de calendário
nem dias úteis; fração linear (`1/duração`) em todo mês, sem curva de
desembolso; sem baseline × realizado; sem replanejamento; 28 meses fixos;
custo por etapa e cronograma não se encontram numa curva S; e a macro copia
fórmula célula a célula, 55 blocos de código iguais.

## 2. Como o mercado faz hoje

A prática consolidada (Sienge, Prevision, OrçaFascio, MS Project, TCPO/SINAPI)
tem cinco camadas:

1. **EAP (WBS)** — etapas → serviços, os mesmos do orçamento, para que cada
   serviço tenha custo e duração no mesmo lugar.
2. **Duração por produtividade** — `duração = quantidade × HH por unidade ÷
   (equipe × horas/dia × dias úteis)`. As composições SINAPI/TCPO trazem as
   horas de pedreiro/servente/eletricista por m², m³, ponto; o orçamento já
   tem as quantidades. É o que diferencia o cronograma de uma obra grande e
   de uma pequena com a mesma equipe. O prazo paramétrico por m² (como o do
   modelo antigo) segue útil como estimativa inicial e como checagem.
3. **Rede de precedência com CPM** — várias predecessoras por atividade,
   tipos FS/SS/FF e defasagens (lag/lead: "reboco começa 2 semanas depois do
   início da alvenaria"), cálculo de início cedo/tarde, **folga** e **caminho
   crítico**. Calendário real (dias úteis, chuvas, feriados) em vez de meses.
4. **Cronograma físico-financeiro e curva S** — o custo de cada serviço
   distribuído ao longo da sua duração gera o desembolso mensal; o acumulado
   é a curva S prevista. Depois, o realizado (medições e compras) é lançado
   contra ela: avanço físico × financeiro, desvio de prazo e de custo (o
   "valor agregado" em versão simples). Baseline congelada e replanejamento
   com datas reais.
5. **Uso operacional** — Gantt, lista de compras por mês (o que comprar em
   cada mês para não parar a obra), programação de equipes; em obras
   repetitivas, linha de balanço; em canteiro, Last Planner (planejamento
   semanal com % de tarefas concluídas).

## 3. Proposta para o VICKE (implementada em set/2026 — ver docs/SPEC-CRONOGRAMA.md)

Reaproveitar o que já existe: as etapas do orçamento (ORD 0–24, incluindo as
de instalações) viram a EAP; os prestadores do orçamento dão a equipe.

- **Rede de etapas** editável pelo escritório (Insumos → Composições ganha
  uma aba "Cronograma"): predecessoras (várias), tipo de vínculo, defasagem,
  e duração de duas formas — paramétrica (tabela por m²/tipologia, herdada do
  modelo antigo, calibrável) e por produtividade (HH por unidade das
  composições × quantidades do orçamento ÷ equipe). Motor CPM puro em JS,
  testável, com folga e caminho crítico.
- **Calendário**: data de início da obra, dias úteis, fator de chuva por
  mês (regional), férias coletivas.
- **Físico-financeiro**: custo por etapa (já calculado) distribuído na
  duração → desembolso mensal, curva S prevista, e a mesma linha do tempo
  alimenta locações, gestão de obra por mês e caçambas — como o modelo antigo
  fazia. Lista de compras por mês derivada dos itens de cada etapa.
- **Acompanhamento**: P&L da obra já tem o realizado por competência; cruzar
  com a curva prevista dá avanço financeiro; um campo "% executado" por etapa
  (ou datas reais de início/fim) dá o avanço físico e o replanejamento.
- **Tela**: Gantt por semana/mês com arraste de datas, etapas críticas em
  destaque, curva S prevista × realizada, e o snapshot (baseline) da versão
  aprovada.

Ordem sugerida: motor CPM + rede padrão herdada do modelo antigo (1 semana de
trabalho), físico-financeiro e locações por mês, depois produtividade por
composição e acompanhamento.

## 4. Dados a extrair do modelo antigo para a semente

Tabela de prazo por área/tipologia (§1), as 55 etapas com predecessora e
duração base, e as regras de tempo → custo (container, betoneira, caçambas,
escoras, andaimes). Já estão documentados neste arquivo e no dump da aba
(`CRONOGRAMA ESTIMADO`, colunas A–H).
