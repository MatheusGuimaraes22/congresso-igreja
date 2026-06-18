# Google Apps Script para agenda, e-mail e WhatsApp

Use o arquivo `google-apps-script-calendar.gs` em um projeto do Google Apps Script vinculado ao e-mail/calendario da igreja.

Para que os e-mails e convites de agenda saiam pelo e-mail da igreja, crie e implante o Apps Script logado como `eventosiccruz@gmail.com`.

## O que ele faz

- Cria um evento na Google Agenda da igreja.
- Adiciona o inscrito como convidado do evento.
- Envia e-mail automatico para o inscrito.
- Envia e-mail automatico para a administracao, se `ADMIN_EMAIL` estiver configurado.
- Envia WhatsApp automatico pela API oficial da Meta, se as credenciais do WhatsApp estiverem configuradas.

## Implantacao

1. Acesse `https://script.google.com`.
2. Crie um novo projeto.
3. Cole o conteudo de `google-apps-script-calendar.gs`.
4. Clique em `Implantar` > `Nova implantacao`.
5. Tipo: `App da Web`.
6. Executar como: `Eu`.
7. Quem pode acessar: `Qualquer pessoa`.
8. Autorize o script.
9. Copie a URL do app da web.
10. No `index.html`, cole essa URL em `googleAppsScriptWebhookUrl`.

## Configurar e-mail da administracao

No Apps Script:

1. Abra `Configuracoes do projeto`.
2. Em `Propriedades do script`, adicione:

| Propriedade | Valor |
| --- | --- |
| `ADMIN_EMAIL` | `eventosiccruz@gmail.com` |

O e-mail para o inscrito usa o e-mail da conta que implantou o Apps Script.

## Configurar WhatsApp oficial

Voce precisa de uma conta no Meta for Developers com WhatsApp Business Platform/Cloud API habilitada.

No Apps Script, em `Propriedades do script`, adicione:

| Propriedade | Valor |
| --- | --- |
| `WHATSAPP_TOKEN` | token de acesso permanente ou temporario da Meta |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do numero de telefone da Cloud API |
| `WHATSAPP_TEMPLATE_NAME` | nome do modelo aprovado, sugestao: `confirmacao_inscricao` |
| `WHATSAPP_TEMPLATE_LANGUAGE` | idioma do modelo, sugestao: `pt_BR` |
| `WHATSAPP_GRAPH_VERSION` | versao da Graph API, exemplo: `v23.0` |

## Modelo de WhatsApp

Para envio automatico iniciado pela igreja, a Meta exige um modelo aprovado.

Crie um modelo na categoria `Utility` com o nome:

```text
confirmacao_inscricao
```

Texto sugerido do modelo:

```text
Ola, {{1}}. Sua inscricao em {{2}} foi recebida. Codigo: {{3}}. QR Code de confirmacao: {{4}}
```

O script preenche:

1. Nome do inscrito.
2. Nome do evento.
3. Codigo da inscricao.
4. Link de validacao/QR Code.

## Observacoes

- O token do WhatsApp fica somente no Apps Script, nunca no `index.html`.
- Se as credenciais do WhatsApp nao estiverem configuradas, o e-mail e a agenda continuam funcionando.
- Conta Gmail comum tem limite menor de envio de e-mails que Google Workspace.
- O WhatsApp automatico pode ter custo por mensagem, conforme a politica vigente da Meta.
