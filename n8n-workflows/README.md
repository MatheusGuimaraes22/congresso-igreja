# Workflows n8n do congresso

Importe estes arquivos no n8n:

- `congresso-nova-inscricao.json`
- `congresso-comprovante.json`

Depois de importar, abra cada workflow e copie a **Production URL** do node Webhook.

Cole as URLs no `CONFIG` do `index.html`:

```js
n8nRegistrationWebhookUrl: "https://SEU-N8N/webhook/congresso-nova-inscricao",
n8nProofWebhookUrl: "https://SEU-N8N/webhook/congresso-comprovante",
```

No node Webhook, deixe **Allowed Origins (CORS)** como:

```text
https://congresso-igreja.vercel.app
```

Os workflows deste pacote apenas recebem, normalizam e respondem ao site. Depois disso, adicione nodes de Google Sheets, Supabase, Airtable, e-mail ou pagamento entre o node `Normalizar...` e o node `Responder ao site`.

Para cobrança online, o workflow de nova inscrição deve criar a cobrança no provedor e preencher `paymentUrl` na resposta. O site usa esse link para gerar o QR Code individual.
