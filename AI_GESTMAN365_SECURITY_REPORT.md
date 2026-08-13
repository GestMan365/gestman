# IA GestMan365 — arquitetura segura do MVP

## Resultado

O módulo existente foi preparado para usar a OpenAI somente pelo servidor e somente com dados internos autorizados da empresa autenticada. A implementação não disponibiliza pesquisa web, arquivos externos, MCP, navegador ou ferramentas de escrita.

Enquanto a Edge Function ou a chave não estiverem ativadas, o módulo mantém o mecanismo local anterior como fallback seguro.

## Fluxo implementado

1. O navegador envia somente a pergunta e o JWT atual para `ai-gestman`.
2. A Edge Function valida o JWT no Supabase Auth.
3. `gm_current_context()` determina empresa, situação do acesso e permissões.
4. `gm_load_tenant_state()` carrega os dados com o JWT do próprio usuário e as regras RLS existentes.
5. O servidor reduz e normaliza apenas os campos operacionais necessários.
6. A OpenAI Responses API recebe a pergunta e o contexto mínimo, com `store: false` e sem ferramentas externas.
7. A auditoria registra hash da pergunta, modelo, contagens e identificador da resposta; não registra o texto integral da pergunta nem a resposta.

## Controles aplicados

- chave OpenAI apenas em `OPENAI_API_KEY`, segredo da Edge Function;
- modelo configurável por `OPENAI_MODEL`, com padrão `gpt-5-mini`;
- autorização por módulo `assistant`;
- isolamento multiempresa derivado do contexto autenticado;
- rate limit de 30 perguntas por usuário/empresa por hora;
- pergunta limitada a 800 caracteres;
- no máximo 40 registros relevantes por coleção, enviando apenas os domínios relacionados à pergunta;
- timeout de 30 segundos;
- nenhuma ferramenta de internet ou escrita;
- instrução de recusa quando não houver evidência interna;
- identificadores internos solicitados nas respostas factuais;
- falha segura quando contexto, rate limit ou OpenAI estiverem indisponíveis.

## Ativação no ambiente oficial

Nenhuma chave deve ser adicionada ao HTML, Git ou arquivo público. A Edge Function `ai-gestman` foi publicada no projeto oficial e recebeu somente as configurações não sensíveis de modelo e origem permitida.

A chave `OPENAI_API_KEY` permanece pendente porque a conta OpenAI exige autenticação interativa do proprietário. Até sua configuração, a resposta da função aciona o fallback local seguro já existente. A chave deverá ser criada exclusivamente no painel oficial da OpenAI e gravada diretamente como segredo do Supabase, sem passar pelo HTML, GitHub ou relatórios.

## Limite de privacidade

Os dados mínimos selecionados são processados pela API da OpenAI. `store: false` foi configurado, mas Zero Data Retention depende da elegibilidade e configuração da organização OpenAI. Se a exigência for que nenhum dado saia da infraestrutura do GestMan365, deve-se usar um modelo privado/local em outra arquitetura.

## Estado remoto na validação técnica

- Banco, migrations, RLS e dados de produção alterados: Não.
- Edge Function `ai-gestman` publicada no Supabase oficial: Sim.
- Configurações não sensíveis `OPENAI_MODEL` e `GESTMAN_APP_ORIGIN`: configuradas.
- Segredo `OPENAI_API_KEY`: pendente de autenticação do proprietário da conta OpenAI.
- Frontend: mantém fallback local seguro até a ativação do segredo.
- O resultado do push do frontend é registrado no relatório final da publicação.
