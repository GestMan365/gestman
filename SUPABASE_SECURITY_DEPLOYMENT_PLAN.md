# Plano de implantação local - remediação Supabase

Estas migrations **não foram aplicadas**. Nunca executar primeiro em produção.

## Pré-requisitos

1. Confirmar que o trabalho está restrito ao diretório local do repositório.
2. Não alterar o Supabase remoto.
3. Não executar migrations remotas.
4. Não usar `service_role` no navegador.
5. Não consultar linhas de clientes.
6. Não expor `.env`, chaves ou tokens.

## Ordem de preparação e homologação

1. Obter dump oficial `--schema-only` e criar homologação isolada sem dados reais.
2. Implementar e testar a Edge Function de bootstrap antes de restringir a RPC atual.
3. Trocar a chamada direta do bootstrap no frontend somente em uma entrega futura homologada.
4. Aplicar `202607220001_security_legacy_hardening.sql`.
5. Aplicar `202607220002_security_bootstrap_and_rpc_grants.sql` somente depois dos itens 2 e 3.
6. Aplicar `202607220003_security_storage_policies.sql`.
7. Executar specs de RLS, RPC e Storage com dois tenants fictícios.
8. Validar ausência de grants abertos, segredos e novas referências inseguras.
9. Ensaiar rollback seguro sem restaurar políticas permissivas.

Não existe migration `202607220004` nesta entrega. As três migrations estão preparadas
localmente, não executadas e pendentes de homologação.

## Critérios de promoção

- nenhum teste permissivo remanescente foi introduzido;
- os objetos críticos ficaram restritos ao fluxo server-side;
- não foram criadas políticas genéricas com `USING true` ou `WITH CHECK true`;
- a estratégia da coluna de senha permaneceu em contenção;
- o frontend permaneceu fora do escopo de alteração.
- o fluxo server-side de bootstrap substituiu a chamada direta antes da restrição de grants.
