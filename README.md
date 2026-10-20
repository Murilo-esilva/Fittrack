# FitTrack — armazenamento em nuvem

Aplicação web estática (GitHub Pages) para registrar treinos A–E, cargas, pedaladas e recuperação. Os **dados de treino** são armazenados no **Supabase/PostgreSQL**, associados ao usuário autenticado. O navegador usa `sessionStorage` apenas para a sessão de login; não grava novos treinos em `localStorage`.

## Configurar a integração

1. **Banco de dados:** a migração versionada [supabase/migrations/20261020184000_fittrack_cloud.sql](supabase/migrations/20261020184000_fittrack_cloud.sql) está pronta para o Supabase GitHub Integration. Em **Project Settings → Integrations → GitHub Integration**, confirme que o repositório é `Murilo-esilva/Fittrack`, o **Working directory** é `.` e **Deploy to production** está habilitado. Com essa opção, a migração será aplicada automaticamente ao publicar/mesclar na branch de produção. **A ligação do GitHub, sozinha, não comprova que ela já rodou.** Alternativamente, abra **SQL Editor** e execute [supabase/schema.sql](supabase/schema.sql) manualmente (o SQL é idempotente).
2. **Configuração pública do Supabase preenchida:** [config.js](config.js) já contém a Project URL e a chave **publishable** do projeto. Não é necessário configurar essas duas informações novamente.

   **Nunca use uma chave `service_role`, `secret` ou senha do banco no GitHub Pages.** A chave publishable/anon pode aparecer no código público, desde que o RLS esteja habilitado.
3. No Supabase, abra **Authentication → Providers** e confira que **Email** está habilitado. Se a confirmação de e-mail estiver ativa, o usuário precisará confirmar seu cadastro.
4. Em **Authentication → URL Configuration**, configure a URL do GitHub Pages como **Site URL** e adicione-a em **Redirect URLs**. Exemplo, se a aplicação for publicada no repositório deste projeto: `https://murilo-esilva.github.io/Fittrack/`. Use a URL real do seu site.
5. Faça o deploy no GitHub Pages depois de executar o SQL e configurar autenticação/redirects, e teste criar uma conta e registrar um treino. O SDK JavaScript do Supabase é carregado via CDN e requer internet.

**Atenção:** conectar o projeto Supabase ao repositório GitHub **não aplica automaticamente** o SQL nem disponibiliza as configurações de conexão no navegador.

## FitTrack V4 — séries completas e fichas personalizadas

### Registro por série
- Cada exercício agora registra **carga (kg)**, **repetições ou segundos** e se a série foi concluída.
- Séries podem ter cargas e repetições diferentes. A carga pode ficar em branco (exercícios sem carga externa).
- A ficha mostra conclusão por série e progresso total. Treinos parciais continuam válidos.
- As cargas e repetições anteriores aparecem como sugestão para as próximas sessões.
- As alterações em andamento usam o mecanismo existente de salvamento na nuvem; para salvar um treino concluído, use **Concluir treino**.
- **Histórico → Ver exercícios e séries** apresenta a execução registrada.

### Editor de fichas A–E
- Em **Treinos → Editar ficha**, altere nome e foco, adicione ou remova exercícios, mova-os pelas setas e defina quantas séries e quais repetições/tempo deseja acompanhar.
- As fichas são individuais e salvas no mesmo documento de usuário do Supabase em `data.plans`. Não é necessário criar tabelas novas.
- Os exercícios possuem identificadores estáveis: mudar a ordem **não mistura os gráficos** dos exercícios.
- Treinos antigos não são modificados quando uma ficha é editada. O gráfico de evolução também pode exibir exercícios removidos do plano.
- Se uma edição excluir séries já marcadas num treino em andamento, o aplicativo solicita confirmação.

### Compatibilidade com as versões anteriores
- Registros da V3 são preservados com quantidade de séries e carga por exercício; **repetições antigas desconhecidas não são inventadas**.
- Rascunhos da V3 com séries já marcadas continuam visíveis, mas exigem completar as repetições/segundos para concluir o treino na V4.
- `data.records` agora aceita registros de treino com `schemaVersion: 4`, `exerciseId` e `sets: [{weight,reps,done}]`. Cada exercício também mantém o campo agregado `done`, para manter compatibilidade com o resumo e os gráficos.
- `data.plans` é opcional: perfis e backups antigos recebem os planos padrão ao serem carregados. A importação/exportação JSON mantém o mesmo formato de backup V2.
- Não há mudança nas políticas RLS nem no banco; o documento continua protegido pelo usuário autenticado.

### Testes automatizados
O repositório inclui `tests/v4.test.cjs` e o workflow `.github/workflows/validate-v4.yml`, que validam o JavaScript, a conversão de rascunhos V3, o registro individual de séries, o editor de fichas e a continuidade dos gráficos.

## Painel de evolução (V3)

A aba **Evolução** reúne gráficos SVG responsivos e acessíveis, sem dependências adicionais:
- Treinos concluídos por semana (8 semanas).
- Carga registrada por exercício dos treinos A–E (até 20 registros com séries concluídas).
- Distância pedalada por semana (8 semanas).
- Histórico de sono (20 check-ins).
- Histórico do **peso corporal** com seleção de 30 dias, 90 dias, 12 meses ou todo o histórico.

### Diário de peso corporal

Na aba **Evolução → Peso corporal**, informe data, peso em quilogramas e observação opcional. O registro é **voluntário e descritivo**, sem metas automáticas, classificações ou julgamento de variações corporais. É possível editar ou excluir registros e visualizar as últimas medições. Se você preencher uma data já registrada, o registro daquele dia é atualizado para evitar duplicatas.

**Armazenamento:** os registros de peso usam `type: 'weight'` no mesmo array `data.records` do estado já salvo no Supabase. Nenhuma nova tabela, permissão ou migração é necessária. Os backups JSON existentes continuam compatíveis (versão 2 da estrutura de dados). O front-end precisa estar online para salvar as alterações.

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

- `index.html`: interface, incluindo a aba Evolução e eventos do FitTrack.
- `evolution.js`: gráficos SVG, indicadores, registros de peso corporal e compatibilidade V4.
- `v4.js`: lógica do registro de séries, editor de fichas e histórico detalhado.
- `v4.css`: estilo responsivo do editor e das séries.
- `cloud.js`: autenticação SDK, leitura e RPC de persistência.
- `config.js`: URL e chave pública já configuradas do Supabase.
- `supabase/schema.sql`: estrutura do banco, RLS e gravação controlada.
