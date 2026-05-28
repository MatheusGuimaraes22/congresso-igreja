# Pagina de inscricao do congresso

Arquivos principais:

- `index.html`: pagina publica de inscricao e area de administracao.
- `vercel.json`: configuracao de hospedagem na Vercel.
- `n8n-pagseguro.md`: guia de integracao com n8n e PagSeguro/PagBank.

## Publicacao no GitHub e Vercel

Esta pasta foi separada para publicacao. Suba somente o conteudo de `congresso-igreja-deploy`, nao a pasta raiz do workspace.

### GitHub

```powershell
cd "C:\Users\mathe\Documents\New project\congresso-igreja-deploy"
git init
git add .
git commit -m "Publica pagina de inscricao do congresso"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

### Vercel

1. Acesse https://vercel.com/new.
2. Importe o repositorio do GitHub.
3. Framework Preset: `Other`.
4. Root Directory: deixe vazio se o repositorio for somente esta pasta.
5. Build Command: deixe vazio.
6. Output Directory: deixe vazio.
7. Deploy.

## O que ja funciona

- Cadastro com nome completo, e-mail, CPF, igreja/unidade e endereco.
- Mascara e validacao de CPF.
- Busca de endereco pelo CEP usando ViaCEP.
- Link para abrir o endereco no Google Maps.
- Perguntas sobre carona, carro disponivel e quantidade de vagas.
- Pagamento sempre nasce como `Pendente`; o inscrito nao escolhe se pagou.
- Referencia unica de pagamento no formato `CGI-...-0000`, gerada a partir do codigo da inscricao e final do CPF.
- Link individual de pagamento para cada inscrito, com `inscricao` e `referencia` nos parametros.
- QR Code individual gerado a partir desse link, permitindo identificar automaticamente quem pagou.
- Comprovante opcional apenas como apoio manual, nao como fluxo principal.
- Area administrativa com usuario e senha, totais, lista de inscritos, correcao manual de status, importacao de pagamentos e exportacao CSV.
- Links `mailto:` para preparar e-mail de inscricao, pagamento e aviso para administracao.

## Configuracao

Para testar no computador, prefira abrir `abrir-servidor-local.bat` em vez de abrir o HTML direto. Abrir por `file:///` pode bloquear `localStorage` em alguns navegadores, e nesse caso os dados ficam apenas em memoria ate recarregar a pagina.

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
  paymentReturnSecret: "troque-este-token",
  storageKey: "congressoIgrejaInscricoes"
};
```

Troque `churchPaymentUrl` pelo link real de pagamento/confirmacao da igreja, `adminEmail` pelo e-mail da secretaria/administracao e `paymentReturnSecret` por um token proprio.

Troque tambem `adminUser` e `adminPassword`. Esta protecao e suficiente apenas para prototipo/local, porque usuario e senha ficam no HTML. Em producao, a area administrativa deve usar login no backend, Supabase Auth, Firebase Auth, n8n com autenticacao, Cloudflare Access ou outro controle no servidor.

Para conectar com n8n, preencha:

- `n8nRegistrationWebhookUrl`: webhook que recebe novas inscricoes.
- `n8nProofWebhookUrl`: webhook que recebe comprovantes enviados depois.

Se o webhook de inscricao retornar JSON com `paymentUrl`, `payment_url`, `checkoutUrl`, `checkout_url` ou `link`, a pagina usa esse link individual no QR Code.

## Confirmacao automatica de pagamento

A pagina ja esta preparada para duas formas de identificacao:

1. **Importacao de extrato/relatorio**: na area `Administracao`, clique em `Importar pagamentos` e envie um `.csv` ou `.txt` exportado do banco/provedor. Se o arquivo contiver o codigo da inscricao, a referencia de pagamento, CPF ou e-mail, a inscricao sera marcada como `Pago` automaticamente.
2. **Retorno de pagamento por link**: um provedor de pagamento pode chamar/abrir a pagina com parametros:

```text
index.html?inscricao=CGI-CODIGO&status=pago&token=troque-este-token
```

Quando o token for igual ao `paymentReturnSecret`, a inscricao correspondente sera marcada como `Pago`.

Para producao real, o melhor desenho e usar webhook no servidor: o provedor confirma o pagamento, o backend procura a inscricao pela referencia e atualiza o banco. A pagina estatica nao consegue receber webhooks sozinha.

## Comprovante opcional

O fluxo principal nao depende de comprovante. Cada inscrito recebe um link/QR Code individual com `inscricao` e `referencia`, e o pagamento deve ser identificado pelo retorno do provedor ou pelo webhook do n8n.

O envio de comprovante foi mantido apenas como apoio manual:

```text
index.html?acao=comprovante&inscricao=CGI-CODIGO
```

Quando o inscrito abre esse link, a aba `Comprovante opcional` e aberta automaticamente e o codigo ja fica preenchido. Ele informa o CPF e anexa o arquivo.

Em producao, esse link deve apontar para a URL publica do site, nao para `file:///...`, e os dados precisam ser salvos em banco central. Em pagina estatica local, o comprovante so atualiza a inscricao se ela existir no mesmo navegador/localStorage.

## Para producao

Esta versao e estatica e salva os dados no navegador da pessoa que acessa a area administrativa. Para receber inscricoes de todos os usuarios em um painel central e enviar e-mails automaticamente, conecte a pagina a um backend ou automacao, por exemplo:

- Banco: Supabase, Firebase, Airtable ou Google Sheets.
- E-mail: Resend, SendGrid, Amazon SES, Gmail API, Make ou n8n.
- Pagamento: Mercado Pago, Asaas, PagSeguro, Stripe ou outro provedor com webhook.

O webhook de pagamento deve atualizar o status da inscricao para `Pago` e disparar o e-mail de confirmacao.

Veja tambem: `n8n-pagseguro.md`.
