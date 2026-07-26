# Implantação da correção de segurança

Estas migrations **não foram aplicadas**. Nunca executar primeiro em produção.

## Pré-requisitos

1. Criar projeto Supabase de homologação isolado, sem dados reais.
2. Obter dump `--schema-only` oficial e comparar com `supabase/snapshot-current`.
3. Restaurar somente estrutura e fixtures `QA-SEC-*` fictícias.
4. Configurar secrets da Edge Function apenas no ambiente isolado.
5. Confirmar que a URL de teste não contém o project ref de produção.

## Ordem

1. aplicar o baseline confirmado em banco vazio;
2. implementar e publicar `bootstrap-company` somente em homologação;
3. trocar a chamada de bootstrap em uma versão de frontend exclusiva de homologação;
4. aplicar `202607220001`, `202607220002` e `202607220003`, nessa ordem;
5. executar os checks estáticos e as specs SQL com pgTAP no ambiente isolado;
6. validar login Auth, contexto, estado, usuários, onboarding, Storage e plataforma;
7. revisar query plan e logs sem conteúdo sensível;
8. ensaiar rollback sem reabrir políticas permissivas;
9. registrar aprovação ou bloqueio de cada etapa.

Não existem migrations `202607220004` a `202607220006` nesta entrega. A quarta migration
permanece bloqueada por ausência de objeto adicional confirmado e dump oficial completo.

## Critérios de promoção

- nenhum teste negativo falha;
- todos os testes de dois tenants passam;
- nenhuma chamada a `gestman_login` é observada;
- frontend não acessa diretamente tabelas legadas;
- dump confirma colunas, constraints, owners e grants esperados;
- rollback ensaiado em uma segunda homologação.

## Rollback

Não existe script SQL de rollback nesta entrega. O procedimento está documentado em
`SUPABASE_SECURITY_ROLLBACK.md` e permanece bloqueado até ser ensaiado contra o dump oficial
em homologação. Nenhum rollback pode restaurar políticas permissivas, a coluna de senha ou
valores de senha.
