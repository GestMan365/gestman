# Bootstrap seguro de empresa

## Fluxo observado

O frontend cria/autentica um usuário no Supabase Auth e chama diretamente `gm_bootstrap_company`. O banco remoto, porém, concede a função somente a `service_role`; concedê-la a `authenticated` ampliaria a superfície de abuso.

## Solução implementada

Combinação de **Edge Function autenticada** e **RPC interna service-role-only**:

1. a Edge valida origem, método, JWT e campos;
2. a identidade é obtida por `auth.getUser(token)`, nunca do corpo;
3. rate limit é consumido no servidor;
4. a Edge chama uma RPC server-side com o usuário validado;
5. a RPC verifica usuário Auth existente, ausência de vínculo anterior, slug e campos;
6. cria empresa, perfil, vínculo administrador, estado vazio, preferências e auditoria em uma transação;
7. retorna somente nome, slug e indicador de criação, sem identificadores
   internos ou credenciais.

`service_role` deve permanecer apenas no ambiente da Edge Function. O endpoint não deve criar
usuário Auth nem receber senha.

## Controles

- validação de tamanho e formato;
- origem CORS restrita;
- JWT obrigatório;
- rate limit por usuário autenticado;
- chave de idempotência e unicidade de slug/vínculo como proteção contra repetição;
- `SECURITY DEFINER` com `search_path` explícito e objetos qualificados;
- EXECUTE interno somente para `service_role`;
- auditoria `company.bootstrap`;
- resposta sem e-mail, senha, token ou metadados Auth.

Estado real: a Edge Function `bootstrap-company` valida o JWT com Supabase
Auth, aceita somente nome, slug e nome de exibição, exige chave de
idempotência, limita o payload, aplica rate limit e chama
`gm_bootstrap_company_server` com `service_role`. A RPC server-side usa lock
transacional por usuário, valida a identidade em `auth.users`, cria empresa,
perfil, vínculo, estado, preferências e auditoria atomicamente e retorna somente
nome, slug e indicador de criação. O frontend deixou de chamar
`gm_bootstrap_company` diretamente e preserva o mesmo formulário.

A migration `202607220002` revoga a execução do bootstrap legado para
`PUBLIC`, `anon` e `authenticated` e mantém as duas RPCs de bootstrap acessíveis
somente por `service_role`.
