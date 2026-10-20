# FitTrack — armazenamento em nuvem

Aplicação web estática (GitHub Pages) para registrar treinos A–E, cargas, pedaladas e recuperação. Os **dados de treino** são armazenados no **Supabase/PostgreSQL**, associados ao usuário autenticado. O navegador usa `sessionStorage` apenas para a sessão de login; não grava novos treinos em `localStorage`.

## Configurar a integração

1. No projeto Supabase, abra **SQL Editor** e execute o arquivo [supabase/schema.sql](supabase/schema.sql). A tabela `public.fittrack_state`, as políticas de RLS e a função de gravação são criadas por esse script.
2. Em **Project Settings → API / API Keys**, copie o **Project URL** e a chave **publishable** (ou **anon**). Edite [config.js](config.js):

   ```js
   window.FITTRACK_CONFIG = {
     url: "https://SEU-PROJETO.supabase.co",
     publishableKey: "SUA_CHAVE_PUBLICAVEL"
   };
   ```

   **Nunca use uma chave `service_role`, `secret` ou senha do banco no GitHub Pages.** A chave publishable/anon pode aparecer no código público, desde que o RLS esteja habilitado.
3. No Supabase, abra **Authentication → Providers** e confira que **Email** está habilitado. Se a confirmação de e-mail estiver ativa, o usuário precisará confirmar seu cadastro.
4. Em **Authentication → URL Configuration**, configure a URL do GitHub Pages como **Site URL** e adicione-a em **Redirect URLs**. Exemplo, se a aplicação for publicada no repositório deste projeto: `https://murilo-esilva.github.io/Fittrack/`. Use a URL real do seu site.
5. Faça o deploy no GitHub Pages depois de configurar os itens acima e teste criar uma conta e registrar um treino. O SDK JavaScript do Supabase é carregado via CDN e requer internet.

**Atenção:** conectar o projeto Supabase ao repositório GitHub **não aplica automaticamente** o SQL nem disponibiliza as configurações de conexão no navegador.

## Como funciona

- Login/cadastro com e-mail e senha, incluindo recuperação de senha por e-mail.
- Após autenticação, o FitTrack busca o documento `fittrack_state` do usuário.
- Cada alteração é enviada ao Supabase, de forma sequencial, com número de revisão. Se outra sessão tiver alterado o mesmo conjunto de dados, a gravação é recusada para evitar sobrescritas silenciosas.
- Caso ocorra erro de sincronização, o app avisa e permite exportar backup. Não feche a página com alterações pendentes sem salvar o backup.
- Treinos, bike, recuperação, histórico, exportação e importação continuam disponíveis.
- Em **Histórico → Migrar dados deste navegador**, é possível importar o `localStorage` antigo (V1/V2), de maneira explícita, preservando os registros anteriores.
- A migração não apaga os dados antigos do navegador; isso facilita conferir e recuperar informações. Após conferir seus registros na nuvem, você pode removê-los do armazenamento local do navegador se quiser.

## Segurança e limitações

A tabela tem RLS habilitado. O usuário autenticado só pode **ler seus próprios dados**, e a função `save_fittrack_state` grava no usuário retornado por `auth.uid()`. Não há acesso direto de escrita à tabela pelos usuários do site.

O arquivo `config.js` é público; somente chaves públicas devem constar nele. Anotações de recuperação podem conter informações pessoais: a privacidade depende de manter o RLS e a configuração do projeto corretos.

A versão inicial mantém **um documento JSON por usuário**, com limite de **2 MB**. Essa estratégia é simples para a V3, mas não oferece mesclagem automática de mudanças simultâneas; conflitos exigem revisão do backup. O app depende de conexão para salvar e não oferece modo de edição offline persistente.

## Arquivos

- `index.html`: interface e eventos do FitTrack.
- `cloud.js`: autenticação SDK, leitura e RPC de persistência.
- `config.js`: URL e chave pública do Supabase (ainda precisa ser preenchido).
- `supabase/schema.sql`: estrutura do banco, RLS e gravação controlada.
