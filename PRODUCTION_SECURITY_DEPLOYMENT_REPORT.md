# Relatório de implantação de segurança em produção

Data: 2026-07-29
Origem validada: GestMan365 Staging
Destino: GestMan365 CMMS
Frontend oficial: monólito `index.html` / `404.html`

## Escopo publicado

Foram transferidas para produção somente as alterações técnicas validadas no
Staging:

- bootstrap de empresa executado por Edge Function autenticada;
- envio público de solicitação por Edge Function com rate limit server-side;
- hardening de RLS e remoção das policies legadas permissivas;
- grants mínimos para RPCs internas;
- policies privadas e multiempresa do Storage;
- validação canônica dos caminhos do Storage;
- separação entre vínculo empresarial (membership) e perfil global;
- diferenciação entre remoção de acesso da empresa e desativação global;
- correção do erro `orderDueState is not defined`;
- tratamento da mensagem de rate limit no frontend.

Nenhum commit das fases de redesign foi incluído. O visual oficial anterior foi
preservado.

## Proteção e backup

Antes da primeira alteração remota foi criado backup lógico protegido, fora do
repositório, em:

`C:\tmp\gestman365-production-backup-20260729`

O conjunto contém esquema, roles, dados das tabelas públicas, metadados do
Storage, código anterior da Edge Function e cópia do frontend publicado.
Produção não possuía PITR nem backup físico gerenciado disponível para esta
operação.

## Alterações no Supabase CMMS

Edge Functions:

- `bootstrap-company`: ACTIVE, versão 1, JWT verificado;
- `submit-company-request`: ACTIVE, versão 3, JWT verificado.

Migrations aplicadas e registradas:

- `202607220001_security_legacy_hardening.sql`;
- `202607220002_security_bootstrap_and_rpc_grants.sql`;
- `202607220003_security_storage_policies.sql`;
- `202607280001_storage_path_canonicalization.sql`;
- `202607280002_membership_profile_separation.sql`;
- `202607290001_drop_remaining_legacy_order_policies.sql`.

A última migration foi criada porque a produção possuía três policies legadas
de Ordem de Serviço com nomes diferentes dos encontrados no Staging. Ela remove
somente essas policies, sem alterar registros.

As migrations históricas de 2026-07-16 a 2026-07-19 já estavam materializadas no
esquema de produção, mas não constavam na tabela remota de histórico. Elas não
foram reaplicadas para evitar duplicação ou alteração destrutiva. Cada migration
nova foi isolada, simulada com `--dry-run` e aplicada individualmente.

## Verificações pós-implantação

- policies legadas `prototipo_*`: 0;
- policies públicas legadas de empresa/usuário: 0;
- policies `gm_storage_*`: 4;
- bucket `gestman-attachments`: privado;
- helpers de caminho canônico: presentes;
- funções internas de membership/perfil: presentes;
- RPC de bootstrap server-side: acessível somente ao `service_role`;
- RPC público legado de bootstrap: bloqueado para o cliente;
- bootstrap com sessão anônima: rejeitado com HTTP 401;
- solicitação pública com payload inválido: rejeitada com HTTP 400;
- nenhum dado QA de produção foi criado;
- nenhuma cópia de dados, usuários, senhas ou arquivos do Staging foi feita.

O dump estrutural pós-migração confirmou as quatro policies canônicas de
Storage e ausência das policies protótipo. Permanecem três policies
`USING (true)` preexistentes, limitadas a leitura autenticada dos catálogos de
perfis e permissões. Elas não foram introduzidas nesta release.

## Frontend e GitHub Pages

- GitHub Pages concluiu com sucesso no commit de release;
- `index.html` publicado é idêntico ao arquivo versionado;
- `404.html` publicado é idêntico ao arquivo versionado;
- oito blocos funcionais críticos estão idênticos nos dois arquivos;
- ambos usam a Edge Function de bootstrap;
- nenhum deles chama diretamente o RPC legado de bootstrap;
- marcadores e commits do redesign rejeitado não estão na release;
- teste em 390 px: `innerWidth = 390`, `scrollWidth = 390`, sem overflow global.

## Testes

- TypeScript: aprovado;
- build Vite: aprovado, 3 módulos transformados;
- checks estáticos de segurança: aprovados;
- `git diff --check`: aprovado;
- Staging, antes da promoção: 56/56 testes de segurança aprovados;
- GitHub Pages: workflow concluído com sucesso;
- console da tela pública: sem erros ou warnings registrados.

O login de fumaça com a conta de teste informada foi rejeitado pela aplicação
como usuário ou senha incorretos. Por segurança, não foram tentadas variações de
senha e não foi criado usuário em produção. Assim, os fluxos autenticados de
produção não foram repetidos; eles permanecem cobertos pelos testes completos
executados no Staging.

## Riscos residuais

- produção não possui PITR/backup físico gerenciado;
- o histórico remoto de migrations anteriores a 2026-07-22 continua incompleto,
  embora o esquema correspondente exista;
- o bundle do monólito permanece grande;
- o `npm audit` mantém achados conhecidos em dependências de desenvolvimento,
  já avaliados separadamente;
- a credencial de teste fornecida precisa ser revisada para novos testes
  autenticados diretamente em produção.

## Resultado

- produção alterada: **Sim, somente no escopo autorizado**;
- Staging alterado: **Sim, apenas migration corretiva validada e limpeza QA**;
- dados reais copiados do Staging: **Não**;
- frontend redesenhado publicado: **Não**;
- banco de produção com dados empresariais alterados: **Não**;
- push para `main`: **Sim**;
- deploy público do backend: **Sim, somente as duas Edge Functions autorizadas**;
- deploy público do frontend: **Sim, preservando o visual oficial**.
