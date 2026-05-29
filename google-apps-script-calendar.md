# Google Apps Script para convite de agenda

Use o arquivo `google-apps-script-calendar.gs` em um projeto do Google Apps Script vinculado ao e-mail/calendário da igreja.

## Passos

1. Acesse `https://script.google.com`.
2. Crie um novo projeto.
3. Cole o conteúdo de `google-apps-script-calendar.gs`.
4. Clique em `Implantar` > `Nova implantação`.
5. Tipo: `App da Web`.
6. Executar como: `Eu`.
7. Quem pode acessar: `Qualquer pessoa`.
8. Autorize o script.
9. Copie a URL do app da web.
10. No `index.html`, cole essa URL em `googleAppsScriptWebhookUrl`.

Quando alguém finalizar a inscrição, o site enviará os dados para o Apps Script. O Apps Script cria o evento no calendário da igreja e adiciona o e-mail do inscrito como convidado, fazendo o Google enviar o convite.

## Observações

- O convite sai pelo calendário autorizado no Apps Script.
- Se o evento estiver sem data, o script usa a data atual como fallback. O ideal é preencher a data real no cadastro do evento.
- O Google pode limitar envios em massa conforme as cotas da conta.
