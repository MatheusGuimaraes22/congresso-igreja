# Integração com n8n e PagSeguro/PagBank

## Arquitetura recomendada

Use os dois:

1. A página envia a inscrição para um webhook do n8n.
2. O n8n salva a inscrição em uma base central.
3. O n8n cria o checkout no PagSeguro/PagBank usando a referência da inscrição.
4. Para Pix, cartão de crédito ou cartão de débito, o n8n responde para a página com a URL de pagamento do provedor.
5. A página gera o QR Code usando essa URL.
6. O PagSeguro/PagBank envia webhook de pagamento para o n8n.
7. O n8n localiza a inscrição pela referência e marca como `Pago`.
8. O n8n envia e-mail de inscrição e e-mail de confirmação de pagamento.
9. Para dinheiro, o n8n apenas registra a inscrição como `Pendente`; a administração confirma no painel quando receber o valor.

## Webhooks no n8n

Crie dois workflows ou dois Webhook nodes:

### 1. Nova inscrição

Metodo: `POST`

URL de produção do n8n: cole no `CONFIG.n8nRegistrationWebhookUrl`.

Payload recebido da página:

```json
{
  "event": "registration.created",
  "registration": {
    "id": "CGI-...",
    "fullName": "Nome Completo",
    "email": "email@exemplo.com",
    "cpf": "000.000.000-00",
    "church": "Nome da igreja",
    "paymentReference": "CGI-...-0000",
    "paymentStatus": "Pendente"
  }
}
```

Resposta esperada pelo site:

```json
{
  "paymentUrl": "https://pagamento.pagseguro.uol.com.br/..."
}
```

O site também aceita os nomes `payment_url`, `checkoutUrl`, `checkout_url` ou `link`.

### 2. Comprovante enviado depois

Metodo: `POST`

URL de produção do n8n: cole no `CONFIG.n8nProofWebhookUrl`.

Payload recebido:

```json
{
  "event": "registration.proof_uploaded",
  "registrationId": "CGI-...",
  "cpf": "000.000.000-00",
  "email": "email@exemplo.com",
  "paymentReference": "CGI-...-0000",
  "paymentProof": {
    "name": "comprovante.pdf",
    "type": "application/pdf",
    "size": 123456,
    "data": "data:application/pdf;base64,..."
  }
}
```

## Fluxo no n8n para criar pagamento PagSeguro/PagBank

Workflow sugerido:

1. `Webhook` recebe `registration.created`.
2. `Set` normaliza os campos.
3. `Data Store`, `Google Sheets`, `Supabase` ou outro banco salva a inscrição como `Pendente`.
4. `HTTP Request` chama a API de Checkout/Order do PagSeguro/PagBank.
5. Inclua a referência da inscrição como `reference_id`/referência do pedido.
6. Inclua a URL de webhook do n8n em `notification_urls` quando usar Checkout PagBank.
7. `Respond to Webhook` retorna o link de pagamento para o site.

Exemplo de resposta final do n8n:

```json
{
  "paymentUrl": "{{ $json.pagseguroPaymentUrl }}"
}
```

## Fluxo no n8n para webhook do PagSeguro/PagBank

Workflow sugerido:

1. `Webhook` recebe notificação do PagSeguro/PagBank.
2. `IF` verifica se o status recebido é `PAID`.
3. `Set` extrai `reference_id`, `charges[0].reference_id` ou a referência equivalente enviada pelo PagSeguro/PagBank.
4. Atualize a inscrição no banco para `Pago`.
5. Envie e-mail de confirmação para o inscrito.
6. Envie e-mail/resumo para a administração.

## Pontos importantes

- Não coloque token secreto do PagSeguro/PagBank no HTML. Ele deve ficar apenas no n8n.
- Em produção, use a URL de produção do Webhook node, não a URL de teste.
- O site estático pode chamar o n8n, mas quem deve falar com PagSeguro/PagBank é o n8n.
- A confirmação verdadeira de pagamento deve vir do webhook do PagSeguro/PagBank, não do redirecionamento do usuário.
- Guarde `paymentReference` em todos os lugares: site, banco, PagSeguro/PagBank e e-mails.
