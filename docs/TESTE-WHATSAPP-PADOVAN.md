# Teste grátis do WhatsApp — Padovan Arquitetos

Liga o VICKE à **WhatsApp Cloud API** usando o **número de teste** que a Meta
dá de graça. Sem número real, sem verificação de empresa, sem custo. O número
de teste só conversa com até 5 telefones cadastrados no painel.

## O que foi construído

| Onde | O quê |
|---|---|
| `vicke-backend/whatsapp-teste.js` | tabelas `whatsapp_teste` e `cotacao_vinculo_teste` (criadas no boot, `CREATE TABLE IF NOT EXISTS`), webhook e rotas |
| `vicke-backend/server.js` | 10 linhas: require, pular o `express.json` no webhook, criar as tabelas no `initDB`, registrar as rotas depois do middleware de `/api` |
| `orbi/src/modules/whatsapp-piloto.jsx` | tela **WhatsApp (teste)** — obras à esquerda, conversa à direita, status da configuração |
| `orbi/src/modules/app.jsx` + `combine.js` | item de menu (aparece só para a empresa piloto) e aba |

Rotas:

- `GET/POST /webhook/whatsapp-teste` — **público** (a Meta não manda JWT). Fica
  fora de `/api` de propósito. Com `WHATSAPP_APP_SECRET` definido, confere a
  assinatura `X-Hub-Signature-256`.
- `GET /api/whatsapp-teste/status`, `GET /api/whatsapp-teste/mensagens?obra_id=`,
  `POST /api/whatsapp-teste/enviar`, `POST /api/whatsapp-teste/simular` — com o
  JWT do VICKE e só para a empresa piloto (as outras recebem 403).

Isolamento: nada toca em `cotacoes`, `materiais` ou `obras` (só lê o nome da
obra). Toda mensagem é gravada com o `empresa_id` da Padovan. Áudio, foto e
documento guardam só o `media_id` — o download é a próxima etapa. Ao receber
áudio, o VICKE responde "Recebido, baixando...".

## Variáveis na Railway (serviço `sparkling-patience`)

| Variável | Obrigatória | Valor |
|---|---|---|
| `WHATSAPP_TEST_TOKEN` | sim | "Temporary access token" do painel (dura 24h) |
| `WHATSAPP_TEST_PHONE_ID` | sim | "Phone number ID" do número de teste |
| `WHATSAPP_VERIFY_TOKEN` | não | padrão `vicke_teste_padovan` |
| `WHATSAPP_APP_SECRET` | não | App settings → Basic → App secret. Liga a checagem de assinatura — recomendado |
| `WHATSAPP_TEST_EMPRESA_ID` | não | id da empresa piloto. Sem ela, usa a primeira empresa com "padovan" no nome |
| `WHATSAPP_GRAPH_VERSION` | não | padrão `v22.0` |

Os valores vão direto na Railway — não colar no chat.

## Passo a passo na Meta (uns 10 minutos)

1. **Publicar** o backend e o frontend (comandos no fim) e esperar a Railway subir.
2. Entrar em **developers.facebook.com** → *My Apps* → **Create App**. Escolher
   o caso de uso de WhatsApp (ou o tipo **Business**) e criar. Se pedir um
   portfólio empresarial (Business Manager), pode criar um novo — não precisa verificar.
3. No app, abrir **WhatsApp → API Setup**. Lá aparecem:
   - **From**: o número de teste, com o **Phone number ID** logo abaixo;
   - **Temporary access token** (botão para gerar).
4. Na **Railway**, colar o token em `WHATSAPP_TEST_TOKEN` e o Phone number ID em
   `WHATSAPP_TEST_PHONE_ID`. A Railway redeploya sozinha.
5. Ainda em API Setup, campo **To → Manage phone number list**: adicionar o seu
   celular (e o do pedreiro de confiança). A Meta manda um código por WhatsApp
   para confirmar cada número.
6. Abrir **WhatsApp → Configuration** → *Webhook* → **Edit**:
   - Callback URL: `https://orbi-production-5f5c.up.railway.app/webhook/whatsapp-teste`
   - Verify token: `vicke_teste_padovan`
   - **Verify and save**. (A tela do VICKE mostra essa URL com botão de copiar.)
7. Na mesma tela, em **Webhook fields → Manage**, **assinar o campo `messages`**.
   Sem isso a verificação passa mas nenhuma mensagem chega — é o passo que mais se esquece.
8. Do seu celular, mandar um **"oi"** para o número de teste. Isso abre a janela
   de 24h em que o VICKE pode responder com texto livre.
9. No VICKE (login da Padovan), abrir **WhatsApp (teste)** no menu. O "oi" aparece
   em "Todas as mensagens". O campo **Para** já vem com o seu número — escrever e **Enviar**.
   A resposta chega no seu WhatsApp e o status vira ✓ enviado → ✓✓ entregue → ✓✓ lido.
10. Teste de áudio: mandar um áudio para o número de teste. Aparece como
    `[audio · mídia guardada]` e você recebe "Recebido, baixando...".

O botão **Simular mensagem de pedreiro** grava uma mensagem falsa ("preciso 10
sacos de cimento para amanhã na obra …") sem passar pela Meta — serve para ver
a tela funcionando antes de configurar o painel.

## Problemas comuns

| Sintoma | Causa e saída |
|---|---|
| "Verify and save" falha | backend ainda não publicou, ou verify token diferente de `WHATSAPP_VERIFY_TOKEN` |
| Verificou, mas mensagem não aparece | campo `messages` não assinado (passo 7); ou `WHATSAPP_APP_SECRET` errado (o log da Railway mostra "assinatura inválida") |
| "token expirou" ao enviar | o temporário dura 24h — gerar outro em API Setup e trocar na Railway |
| "não está na lista de destinatários" | cadastrar o número em *Manage phone number list*. Celular brasileiro: o WhatsApp às vezes registra sem o 9; o VICKE tenta a outra forma sozinho, e o campo Para já usa o número exatamente como a Meta entregou |
| "fora da janela de 24h" | a pessoa precisa mandar uma mensagem antes; fora da janela só template |

Logs na Railway: tudo sai com o prefixo `[whatsapp-teste]`.

## Fora deste teste

Download e transcrição de áudio, vínculo da resposta com a cotação (a tabela
`cotacao_vinculo_teste` já existe, vazia), número real, Embedded Signup para
outros escritórios, token permanente (System User).
