# Página de inscrição do congresso

Arquivos principais:

- `index.html`: página pública de inscrição e área de administração.
- `vercel.json`: configuração de hospedagem na Vercel.
- `n8n-pagseguro.md`: guia de integração com n8n e PagSeguro/PagBank.

## Publicação no GitHub e Vercel

Esta pasta foi separada para publicação. Suba somente o conteúdo de `congresso-igreja-deploy`, não a pasta raiz do workspace.

### GitHub

```powershell
cd "C:\Users\mathe\Documents\New project\congresso-igreja-deploy"
git init
git add .
git commit -m "Publica página de inscrição do congresso"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

### Vercel

1. Acesse https://vercel.com/new.
2. Importe o repositório do GitHub.
3. Framework Preset: `Other`.
4. Root Directory: deixe vazio se o repositório for somente esta pasta.
5. Build Command: deixe vazio.
6. Output Directory: deixe vazio.
7. Deploy.

## O que já funciona

- Cadastro com nome completo, e-mail, CPF, igreja/unidade e endereço.
- Máscara e validação de CPF.
- Busca de endereço pelo CEP usando ViaCEP.
- Link para abrir o endereço no Google Maps.
- Perguntas sobre carona, carro disponível e quantidade de vagas.
- Escolha da forma de pagamento: Pix, cartão de crédito, cartão de débito ou dinheiro.
- Pagamento sempre nasce como `Pendente`; o inscrito não escolhe se pagou.
- Referência única de pagamento no formato `CGI-...-0000`, gerada a partir do código da inscrição e final do CPF.
- Link individual de pagamento para cada inscrito, com `inscricao` e `referencia` nos parâmetros.
- QR Code individual gerado a partir desse link, permitindo identificar automaticamente quem pagou.
- Comprovante opcional com OCR para tentar localizar inscrição/referência, valor pago e ID/autenticação da transação.
- Área administrativa com usuário e senha, totais, lista de inscritos, correção manual de status, importação de pagamentos e exportação CSV.
- Links `mailto:` para preparar e-mail de inscrição, pagamento e aviso para administração.

## Configuração

Para testar no computador, prefira abrir `abrir-servidor-local.bat` em vez de abrir o HTML direto. Abrir por `file:///` pode bloquear `localStorage` em alguns navegadores, e nesse caso os dados ficam apenas em memória até recarregar a página.

No final do arquivo `index.html`, edite o bloco:

```js
const CONFIG = {
  churchName: "Congresso da Igreja",
  churchPaymentUrl: "https://link-da-igreja.com/pagamento-congresso",
  n8nRegistrationWebhookUrl: "",
  n8nProofWebhookUrl: "",
  adminEmail: "administracao@igreja.com",
  adminUser: "admin",
  adminPassword: "troque-esta-senha",
  storageKey: "congressoIgrejaInscricoes"
};
```

Troque `churchPaymentUrl` pelo link real de pagamento/confirmação da igreja e `adminEmail` pelo e-mail da secretaria/administração.

Troque também `adminUser` e `adminPassword`. Esta proteção é suficiente apenas para protótipo/local, porque usuário e senha ficam no HTML. Em produção, a área administrativa deve usar login no backend, Supabase Auth, Firebase Auth, n8n com autenticação, Cloudflare Access ou outro controle no servidor.

Para conectar com n8n, preencha:

- `n8nRegistrationWebhookUrl`: webhook que recebe novas inscrições.
- `n8nProofWebhookUrl`: webhook que recebe comprovantes enviados depois.

Se o webhook de inscrição retornar JSON com `paymentUrl`, `payment_url`, `checkoutUrl`, `checkout_url` ou `link`, a página usa esse link individual no QR Code.

## Confirmação automática de pagamento

A página está preparada para identificar pagamentos por conferência administrativa ou por automação externa:

1. **Importação de extrato/relatório**: na área `Administração`, clique em `Importar pagamentos` e envie um `.csv` ou `.txt` exportado do banco/provedor. Se o arquivo contiver o código da inscrição, a referência de pagamento, CPF ou e-mail, a inscrição será marcada como `Pago` automaticamente.
2. **Webhook no n8n/backend**: o provedor confirma o pagamento no servidor, o n8n procura a inscrição pela referência individual e atualiza a base central como `Pago`.

Pix, cartão de crédito e cartão de débito podem ser confirmados automaticamente quando forem feitos por um provedor com webhook, como PagBank/PagSeguro, Mercado Pago ou Asaas. Pagamento em dinheiro não tem confirmação automática externa: precisa ser registrado pela tesouraria/administração no painel quando o valor for recebido.

Não use link público com `status=pago` para confirmar pagamento. Qualquer regra de confirmação precisa ficar fora do HTML, no n8n, backend ou painel administrativo protegido. A página estática não consegue receber webhooks sozinha.

## Comprovante opcional

O fluxo principal não depende de comprovante. Cada inscrito recebe um link/QR Code individual com `inscricao` e `referencia`, e o pagamento deve ser identificado pelo retorno do provedor ou pelo webhook do n8n.

O envio de comprovante foi mantido como apoio de conferência:

```text
index.html?acao=comprovante&inscricao=CGI-CODIGO
```

Quando o inscrito abre esse link, a aba `Comprovante opcional` é aberta automaticamente e o código já fica preenchido. Ele informa o CPF, valor pago, ID/autenticação da transação e anexa o arquivo.

O comprovante não marca pagamento como `Pago` automaticamente. Para imagens, o site tenta ler o arquivo por OCR. Se encontrar inscrição/referência, valor e ID/autenticação, o status vira `Comprovante compatível`; caso contrário, vira `Em análise`. Em ambos os casos a administração deve comparar valor, referência, ID da transação e extrato antes de confirmar.

Em produção, esse link deve apontar para a URL pública do site, não para `file:///...`, e os dados precisam ser salvos em banco central. Em página estática local, o comprovante só atualiza a inscrição se ela existir no mesmo navegador/localStorage.

## Para produção

Esta versão é estática e salva os dados no navegador da pessoa que acessa a área administrativa. Para receber inscrições de todos os usuários em um painel central e enviar e-mails automaticamente, conecte a página a um backend ou automação, por exemplo:

- Banco: Supabase, Firebase, Airtable ou Google Sheets.
- E-mail: Resend, SendGrid, Amazon SES, Gmail API, Make ou n8n.
- Pagamento: Mercado Pago, Asaas, PagSeguro, Stripe ou outro provedor com webhook.

O webhook de pagamento deve atualizar o status da inscrição para `Pago` e disparar o e-mail de confirmação.

Veja também: `n8n-pagseguro.md`.
