# GestMan365 — Plano de Reprodutibilidade Supabase

## Objetivo

Reconstruir o backend em um projeto de homologação vazio, sem dados de clientes, antes de criar qualquer migration aplicável à produção.

O conteúdo de `supabase/snapshot-current` é fotografia de referência. Não deve ser aplicado diretamente.

## Estratégia recomendada

1. Criar projeto Supabase exclusivo de homologação.
2. Gerar um dump oficial `schema-only` do remoto com ferramenta compatível com PostgreSQL 17.
3. Comparar o dump com este snapshot e remover objetos gerenciados pelo Supabase (`auth`, `storage`, `realtime`, `vault`).
4. Construir um baseline ordenado e revisado para `public`.
5. Separar legado CMMS, núcleo multiempresa, onboarding, permissões, Storage e funções administrativas.
6. Aplicar o baseline somente em homologação.
7. Executar testes negativos de RLS com duas empresas e múltiplos perfis.
8. Somente depois converter o baseline em migrations incrementais para um ambiente novo.

## Ordem técnica sugerida

1. Extensões: `pgcrypto`, `uuid-ossp`.
2. Tabelas centrais: empresas, perfis, membros e estado.
3. Tabelas de auditoria e preferências.
4. Tabelas da plataforma e onboarding.
5. Tabelas CMMS normalizadas.
6. Constraints e foreign keys, inclusive dependências de `auth.users`.
7. Sequences e índices.
8. Funções auxiliares invoker.
9. Funções `SECURITY DEFINER` com `search_path` fixo.
10. Triggers.
11. RLS e policies.
12. Grants mínimos.
13. Bucket e policies de Storage.
14. Edge Functions e secrets.

## Objetos que exigem baseline manual

- `gm_companies`, `gm_company_members`, `gm_profiles`.
- `gm_tenant_state`, `gm_user_preferences`, `gm_audit_log`.
- `gm_public_rate_limits`.
- `gm_bootstrap_company`, `gm_load_tenant_state`, `gm_save_tenant_state`.
- Funções de permissão: `gm_member_can`, `gm_member_module_level`, `gm_profile_default_level`, `gm_state_key_module`.
- Funções e políticas do Storage.
- `vw_ordens_servico_completa` e sequences remotas.

## Objetos que exigem revisão antes de migrar

- Políticas `prototipo_*` com condições globais verdadeiras.
- `gestman_empresas` e `gestman_usuarios`, principalmente a coluna `senha` e INSERT público.
- Sobreposição entre `ativos`/`equipamentos`, `locais`/`locais_instalacao` e `sub_tags`/`subtags`.
- Implementações repetidas/redefinidas de `gm_manage_company` e `gm_submit_company_request`.
- Grants PUBLIC em funções `SECURITY DEFINER`.
- Persistência de anexos base64 dentro de `gm_tenant_state`.

## Dependências

### Auth

- Foreign keys para `auth.users`.
- `auth.uid()` nas funções e políticas.
- Metadata do usuário criada pelas Edge Functions.
- Usuários de teste devem ser criados somente em homologação.

### Storage

- Bucket privado `gestman-attachments`.
- Caminho do objeto deve iniciar pela empresa e pelo módulo.
- Funções `gm_storage_company_id` e `gm_storage_module`.
- Políticas SELECT/INSERT/UPDATE/DELETE para `authenticated`.

### Edge Functions

- `convert-company-request`
- `manage-company-access`
- `manage-company-user`
- `submit-company-request`

### Variáveis e secrets necessários (somente nomes)

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GESTMAN_APP_ORIGIN`
- `GESTMAN_COMPANY_DELETE_PASSWORD`
- `GESTMAN_EMAIL_FROM`
- `GESTMAN_REQUEST_EMAIL_TO`
- `RESEND_API_KEY`

## Testes obrigatórios em homologação

1. Usuário sem empresa não lê estado.
2. Usuário da empresa A não lê/escreve a empresa B.
3. Usuário inativo perde acesso imediatamente.
4. Técnico não exclui registros nem altera permissões.
5. Administrador empresarial não administra outra empresa.
6. Administrador da plataforma acessa somente operações globais previstas.
7. Conflito de versão em `gm_save_tenant_state` é rejeitado.
8. Chave desconhecida do estado não recebe permissão ampla por padrão.
9. Upload, leitura, alteração e exclusão no Storage respeitam empresa/módulo.
10. Funções internas rejeitam chamada direta por `anon` e usuário comum.
11. Solicitação pública respeita rate limit e não cria acesso automaticamente.
12. Exclusão de empresa é atômica e auditada em ambiente descartável.

## Rollback de homologação

1. Nunca testar sobre o projeto de produção.
2. Registrar hash do baseline e das Edge Functions antes do teste.
3. Fazer backup schema-only do ambiente de homologação.
4. Em falha, descartar o projeto de homologação ou restaurar seu backup.
5. Não criar scripts de rollback destrutivo para produção antes de validar dependências e retenção.

## Critério de conclusão

- Banco vazio reconstruído sem intervenção manual oculta.
- Zero políticas globais não justificadas.
- Zero funções `SECURITY DEFINER` com `search_path` aberto.
- Testes multiempresa e de perfis aprovados.
- Edge Functions executadas com privilégios mínimos.
- Git contém todo o schema necessário, sem dados e sem secrets.

