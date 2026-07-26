# Coluna de senha legada - estratégia de correção

## Classificação

`public.gestman_usuarios.senha` é uma coluna `text`. Sem ler valores, a análise encontrou:

- o frontend legado chama `gestman_login(p_login, p_email, p_senha)`;
- a definição completa de `gestman_login` não está versionada;
- o frontend moderno autentica por Supabase Auth;
- as Edge Functions criam e redefinem credenciais somente pela API administrativa do Supabase Auth;
- as migrations novas devem impedir novas gravações na tabela legada.

Classificação: **legado ainda utilizado**. Não é seguro remover a coluna nesta tarefa, mas também
não é aceitável continuar expondo escrita/leitura direta.

Estado: preparado localmente e validável estaticamente. A coluna não foi removida, seus valores
não foram consultados e o risco continua presente em produção até implantação homologada.

## Fase A - contenção preparada

1. Remover a política pública de INSERT.
2. Revogar acesso direto de `anon` e `authenticated` a `gestman_usuarios` e `gestman_empresas`.
3. Bloquear INSERT com `senha` preenchida e UPDATE que altere `senha`, sem impedir
   atualizações de outros campos realizadas por fluxos server-side autorizados.
4. Manter criação e redefinição de senha exclusivamente no Supabase Auth por Edge Function server-side.
5. Não criar view genérica com `SELECT *`.

O EXECUTE de `gestman_login(text,text,text)` é revogado para `public`, `anon` e
`authenticated`, impedindo o retorno pelo RPC legado conhecido. Como a definição completa do
banco ainda não está versionada, não é possível provar localmente que nenhuma outra RPC
desconhecida retorna a coluna. Essa verificação permanece bloqueada até o dump oficial.

## Fase B - remoção futura

1. Obter dump oficial e definição de `gestman_login`.
2. Confirmar telemetria sem chamadas ao RPC legado durante a janela definida.
3. Remover referências no monólito sem alterar o fluxo de Supabase Auth.
4. Invalidar ou limpar valores antigos por procedimento administrativo separado, com backup e aprovação.
5. Remover `gestman_login` e só então remover a coluna `senha` em migration própria.

## Critérios obrigatórios antes da remoção

- login, criação, reset e desativação testados em homologação;
- nenhum SELECT/INSERT/UPDATE referencia `senha` ou `gestman_login`;
- Edge Functions não registram credenciais;
- rollback de autenticação testado sem restaurar senha em texto;
- aprovação formal do responsável de segurança.
