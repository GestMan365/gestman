# Reconciliação local das migrations — Fase 04

Este manifesto registra decisões de reconciliação. Os arquivos em `deferred/` e
`superseded/` **não devem voltar silenciosamente** para `migrations/`.

## Arquivo canônico recuperado do histórico remoto

- `migrations/20260827232250_company_public_brand_lookup.sql`
- SHA-256: `7e9e58ce0e29d7fb162cc6ce577fd2de993fd68a768c9afdd5c28c3af6b31111`
- Finalidade: função pública mínima para marca da empresa antes da autenticação.

## Adiado

- `deferred/20260823135135_whatsapp_work_order_notifications.sql`
- SHA-256: `4fa79f1e07e8efd009f7cf4a86512f6f649f8587035dc4075a5a9172e707d35b`
- Motivo: WhatsApp não pertence ao candidato da Fase 04 e sua versão não pode
  ser marcada como aplicada sem implantação específica futura.

## Substituídos

- `superseded/202607190001_tenant_user_management.sql`
  - SHA-256: `f236c9b476ed4c829ca4ab8bd8758722baf18ae439acefaafd15c5d7139a1160`
  - Estruturas já existem, RPCs foram substituídas e o único backfill pendente
    passa a ser tratado por uma migration forward-only. Não reparar essa versão.
- `superseded/202608270001_company_public_brand_lookup.sql`
  - SHA-256: `7797bdc8fbfe54d57d55d49e52ffdb2a9759ac23f691e4785f581cdd268a0b26`
  - Substituída pela versão remota canônica `20260827232250`. Não reparar
    `202608270001`.

## Reconhecimento futuro proposto — não executado

Somente estas versões permanecem candidatas a reconhecimento futuro, após nova
autorização e novo preflight:

```text
supabase migration repair --status applied 202607160004 --linked
supabase migration repair --status applied 202607170001 --linked
supabase migration repair --status applied 202607170002 --linked
supabase migration repair --status applied 202607180001 --linked
supabase migration repair --status applied 202607180002 --linked
supabase migration repair --status applied 202607180003 --linked
```

Nenhum desses comandos foi executado. Não reconhecer `202607190001`,
`20260823135135`, `202608270001` ou `202608310001`.
