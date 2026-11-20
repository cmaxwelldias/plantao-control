# Plantão Control — versão gratuita

## O que está incluído
- Cadastro inicial: HSL (R$ 31,00/h) e D'or (R$ 26,66/h).
- Cadastro de hospitais e regras noturnas por instituição.
- Faixa noturna configurável (padrão 22:00–05:00).
- Registro de plantões que atravessam a meia-noite.
- Intervalo remunerado (não descontado).
- Painel de horas, valores previstos e recebidos.
- Backup JSON para transferir dados.
- PWA instalável e cache offline.
- Importação de eventos do Google Agenda por OAuth, em modo somente leitura.

## Limitações importantes
1. Os dados do aplicativo ficam no armazenamento local de cada navegador/dispositivo. Não existe sincronização automática dos registros do app entre computador e celular nesta versão. Use Exportar/Importar backup para transferir os dados.
2. A importação do Google Agenda importa eventos com horário definido cujo título contenha o nome cadastrado do hospital. Eventos de dia inteiro e eventos sem correspondência são ignorados. A importação não altera nem apaga eventos no Google. A busca percorre páginas da API (até 100 páginas por operação) e evita reimportar eventos pelo ID do Google.
3. A conexão Google requer um OAuth Client ID criado pelo proprietário da conta Google e a URL HTTPS de publicação. O ID é público; não coloque senhas ou client secrets no HTML.
4. O cálculo usa horas reais e não aplica automaticamente hora noturna reduzida, regras trabalhistas, convenções coletivas, adicionais de horas extras ou arredondamentos. Configure os valores conforme contrato/folha de cada instituição.
5. Para segurança, o token Google é mantido apenas na memória da sessão e deve ser autorizado novamente quando a página for reaberta. O botão Desconectar tenta revogar o token no Google; se não for possível, remova o acesso nas permissões da sua Conta Google.

## Publicação gratuita sugerida: GitHub Pages
1. Crie uma conta gratuita em https://github.com/.
2. Crie um repositório público chamado `plantao-control`.
3. Envie todos os arquivos desta pasta para a raiz do repositório.
4. Em Settings > Pages, escolha Deploy from a branch, branch `main`, pasta `/ (root)`, e salve.
5. Aguarde o endereço HTTPS `https://SEU-USUARIO.github.io/plantao-control/`.

GitHub Pages oferece hospedagem estática em repositórios públicos no plano Free. Não publique dados pessoais de pacientes; o aplicativo não foi projetado para armazenar dados clínicos.

## Configurar Google Agenda (OAuth)
1. Abra https://console.cloud.google.com/ e crie um projeto.
2. Ative a Google Calendar API.
3. Configure Google Auth Platform / tela de consentimento OAuth com seu e-mail como usuário de teste, se o app estiver em modo de teste.
4. Crie uma credencial OAuth do tipo Web application.
5. Em Authorized JavaScript origins, adicione exatamente a origem HTTPS do GitHub Pages, por exemplo `https://SEU-USUARIO.github.io` (sem o caminho `/plantao-control/`).
6. Copie o OAuth Client ID (termina em `.apps.googleusercontent.com`) e cole no campo do aplicativo.
7. Clique em Conectar Google Agenda, autorize somente leitura e importe o período desejado.

A API Google Calendar informa que o uso padrão não tem custo adicional, sujeito às cotas e às regras de faturamento anunciadas pelo Google. Verifique as condições atuais antes de ampliar o uso: https://developers.google.com/workspace/calendar/api/guides/quota?hl=pt-BR

## Instalar no celular
- Android: abra o endereço publicado no Chrome, menu ⋮ > Instalar app / Adicionar à tela inicial.
- iPhone: abra no Safari, Compartilhar > Adicionar à Tela de Início.
- Computador: use o ícone Instalar na barra de endereço do navegador compatível.

## Privacidade e backup
Os dados ficam no navegador. Exporte backup regularmente e mantenha uma cópia segura. Não use computador compartilhado sem proteger o perfil do navegador.
