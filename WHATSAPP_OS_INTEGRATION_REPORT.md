# Integração WhatsApp para Ordens de Serviço

Data da validação local: 23/08/2026

## Resultado

O MVP seguro da integração com a API oficial do WhatsApp Business foi implementado localmente. A aplicação ainda não foi publicada nem ativada no Supabase de produção porque depende das credenciais oficiais da Meta, de um número habilitado e de um template aprovado.

## Funcionalidades implementadas

- configuração disponível somente para administradores da empresa;
- até cinco destinatários autorizados por empresa;
- avisos de nova O.S., mudança de status, atribuição de responsável e mudança de prioridade;
- teste manual do canal usando uma O.S. real da empresa;
- exclusão automática das O.S. de demonstração dos disparos;
- envio assíncrono: uma falha no WhatsApp não impede o salvamento da O.S.;
- idempotência para evitar duplicação causada por clique duplo ou repetição da mesma requisição;
- recuperação de tentativas que ficarem pendentes por interrupção do servidor;
- auditoria técnica de tentativas aceitas ou rejeitadas, sem armazenar o telefone em texto aberto no log.

## Segurança aplicada

- token da Meta e identificador do número existem somente como segredos da Edge Function;
- destinatários são cifrados com AES-256-GCM antes de serem armazenados;
- a configuração não faz parte de `gm_tenant_state` e não é carregada por usuários comuns;
- a tabela de configuração não concede acesso a `anon` nem `authenticated`;
- leitura e gravação da configuração ocorrem exclusivamente pela Edge Function com autenticação JWT;
- a empresa ativa é obtida no servidor por `gm_current_context`;
- somente administrador configura ou consulta destinatários;
- disparos exigem permissão `orders` nos níveis `operate` ou `manage`;
- o log grava somente SHA-256 do destinatário e os quatro últimos dígitos;
- origens HTTP são limitadas ao domínio oficial, GitHub Pages e ambiente local;
- nenhum token, chave ou JWT foi encontrado nos arquivos alterados.

## Template necessário na Meta

Nome sugerido: `gestman_os_alerta`

Categoria: `UTILITY`

Idioma: `pt_BR`

Corpo com oito parâmetros, nesta ordem:

```text
*{{1}}*
{{2}}: O.S. {{3}}
Equipamento: {{4}}
Status: {{5}}
Prioridade: {{6}}
Responsável: {{7}}
Prazo: {{8}}
Consulte os detalhes no GestMan365.
```

Os parâmetros são empresa, tipo do evento, número da O.S., equipamento, status, prioridade, responsável e prazo.

## Segredos exigidos no Supabase

Configurar diretamente em Edge Functions / Secrets, nunca no HTML ou no Git:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_GRAPH_API_VERSION`
- `WHATSAPP_TEMPLATE_WORK_ORDER`
- `WHATSAPP_TEMPLATE_LANGUAGE`
- `WHATSAPP_SETTINGS_ENCRYPTION_KEY`

A chave de cifragem deve conter 32 bytes aleatórios em Base64 ou 64 caracteres hexadecimais. Ela deve ser guardada em cofre seguro e não pode ser alterada depois que existirem destinatários cadastrados sem antes recifrá-los.

## Ordem segura de ativação

1. Criar ou validar o número no WhatsApp Business Platform.
2. Criar e aguardar aprovação do template.
3. Aplicar a migration `20260823135135_whatsapp_work_order_notifications.sql`.
4. Cadastrar os seis segredos na Edge Function.
5. Publicar `whatsapp-work-order-alerts` mantendo verificação JWT.
6. Entrar como administrador em Perfil e empresa → WhatsApp.
7. Verificar a integração, cadastrar destinatários com consentimento e salvar.
8. Enviar um teste e confirmar a entrega antes de ativar os eventos automáticos.

## Validações executadas

- `deno fmt --check`: aprovado;
- `deno lint`: aprovado;
- `deno check`: aprovado;
- TypeScript: aprovado;
- build Vite: aprovado, 33 módulos transformados;
- validação estrutural da integração: aprovada;
- validação da IA existente: aprovada;
- validação de imagens de perfil: 7 verificações aprovadas;
- `index.html` e `404.html`: hash binário idêntico;
- IDs HTML duplicados: zero;
- `git diff --check`: sem erro de whitespace;
- auditoria de segredos: aprovada.

Os avisos do Vite sobre scripts clássicos sem `type="module"` já pertencem à arquitetura atual e não bloquearam o build. O Docker local estava indisponível, portanto a migration recebeu validação estática e de dependências, mas ainda deve ser exercitada no Supabase antes da ativação final.

## Arquivos da integração

- `index.html`
- `404.html`
- `supabase/functions/whatsapp-work-order-alerts/index.ts`
- `supabase/migrations/20260823135135_whatsapp_work_order_notifications.sql`
- `scripts/validate-whatsapp-integration.mjs`
- `WHATSAPP_OS_INTEGRATION_REPORT.md`

## Estado externo

- Supabase de produção alterado: não.
- Mensagem real enviada: não.
- GitHub publicado: não.
- Site oficial alterado: não.

## Referências oficiais

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Edge Function Secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase Auth em Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Meta WhatsApp Business Platform — mensagens por template](https://www.postman.com/meta/whatsapp-business-platform/request/o65u5m5/send-message-template-text)
