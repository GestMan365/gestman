# Security checks

Este diretório contém validações locais e especificações de segurança do
Supabase do GestMan365.

## Verificação estática

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File ".\tests\security\security_static_checks.ps1"
```

Ela verifica policies permissivas, grants abertos, uso indevido de
`service_role` no frontend, segredos versionados, exposição da coluna legada
`senha`, contrato da Edge Function de bootstrap e uso do endpoint autenticado
em `index.html` e `404.html`.

## Bootstrap publicado no staging

O precheck real do bootstrap usa variáveis de ambiente fornecidas somente ao
processo:

```powershell
node .\scripts\validate-staging-bootstrap.mjs
```

## Suíte real de segurança no staging

```powershell
node .\scripts\validate-staging-security.mjs
```

As duas suítes exigem URL e chaves do projeto de staging por variáveis de
ambiente. Nunca grave esses valores no repositório, em relatórios ou na linha
de comando compartilhada.

A suíte completa cria apenas fixtures com prefixo `QA-SECURITY`, testa RLS,
RPCs, Storage, onboarding e Edge Functions, e remove exatamente essas fixtures
ao final.

## Especificações SQL

Os arquivos `*.spec.sql` documentam contratos pgTAP. Eles nunca devem ser
executados contra produção. Para testes locais, use banco Docker descartável;
para testes integrados, use somente o projeto GestMan365 Staging confirmado.
