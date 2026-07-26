# Bootstrap seguro de empresa

## Fluxo observado

O frontend cria/autentica um usuário no Supabase Auth e chama diretamente `gm_bootstrap_company`. O banco remoto, porém, concede a função somente a `service_role`; concedê-la a `authenticated` ampliaria a superfície de abuso.

## Solução recomendada e ainda não implementada

Combinação de **Edge Function autenticada** e **RPC interna service-role-only**:

1. a Edge valida origem, método, JWT e campos;
2. a identidade é obtida por `auth.getUser(token)`, nunca do corpo;
3. rate limit é consumido no servidor;
4. a Edge chama uma RPC server-side com o usuário validado;
5. a RPC verifica usuário Auth existente, ausência de vínculo anterior, slug e campos;
6. cria empresa, perfil, vínculo administrador, estado vazio, preferências e auditoria em uma transação;
7. retorna somente identificadores e papel, sem credenciais.

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

Estado real: a Edge Function de bootstrap não existe nesta entrega e não foi criada por falta
de contrato confirmado. O frontend ainda chama `gm_bootstrap_company` diretamente. A migration
`202607220002` prepara a restrição para `service_role`, mas sua promoção está bloqueada até a
Edge possuir validação, rate limit, idempotência, logs, tratamento de falha e resposta mínima,
e até o frontend ser trocado e homologado. Esta tarefa não altera a interface nem o frontend.
