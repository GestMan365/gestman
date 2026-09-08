# Fase 04 — gate local da correção forward-only

Data: 03/09/2026. **INTERROMPIDO: teste obrigatório de replay falhou. Não há candidato aprovado nem commits novos.**

## Base e isolamento

- Repositório oficial: `C:\Users\andsa\Desktop\GestMan365-Claude`.
- Origin/main confirmado após fetch: `5048171e0013f27ee5931c403c989552f121f372`.
- Branch nova: `codex/phase04-username-forward-only`.
- Worktree: `C:\Users\andsa\Desktop\GestMan365-Claude\test-results\worktrees\phase04-username-forward-only`.
- HEAD continua na base. A branch `feature/modulo-estoque` e suas alterações anteriores foram preservadas.
- Nenhum conteúdo de `58f2e34` foi aplicado. A referência funcional `6af297f` foi somente inspecionada; não foi integrada após a falha do gate.

## 1. Alertas de segurança: 12 verificações aprovadas

O catálogo remoto foi consultado somente por SELECT em transação READ ONLY. Foi coletado um dump somente do schema public, sem linhas de negócio. A simulação local usou dois tenants e dois JWTs sintéticos distintos, sem login de usuário. Chaves, tokens e identificadores não são apresentados neste relatório.

### View `vw_ordens_servico_completa`

- Owner: `postgres`, com BYPASSRLS no catálogo remoto.
- `security_invoker` não está explícito; `reloptions` é NULL.
- `authenticated` e `anon` **não possuem SELECT** na view.
- As tabelas-base `ordens_servico`, `equipamentos`, `locais_instalacao` e `regioes` têm RLS habilitada, FORCE RLS desabilitada e não concedem SELECT a esses papéis clientes.
- Os dois JWTs foram aceitos no controle positivo: cada usuário viu somente a própria empresa sintética em `gm_companies` (uma linha própria e zero estrangeiras).
- Na view, ambos receberam HTTP **403 / SQLSTATE 42501** via PostgREST local.
- Como papel `authenticated` diretamente no PostgreSQL local, ambos receberam **42501**.

Conclusão limitada: **nenhum acesso entre tenants foi observado nos caminhos testados com os grants atuais**. A falta de SELECT é a barreira efetiva. Não se afirma que a view seria segura se SELECT fosse concedido futuramente. A adoção de security_invoker deve ser revisada em alteração forward-only própria antes de qualquer exposição da view.

### Privilégio TRUNCATE em `gm_companies`

- `authenticated` possui TRUNCATE efetivo no catálogo remoto. É privilégio excessivo e continua pendente de revogação forward-only; não foi considerado seguro.
- Tentativa direta local de `TRUNCATE gm_companies` foi negada com **0A000**, pelas referências de outras tabelas.
- Tentativa direta local com `CASCADE` foi negada com **42501**, pelos privilégios necessários nas dependências.
- Ambas ocorreram somente no container descartável, dentro de transações revertidas. A contagem de empresas sintéticas permaneceu inalterada.
- PostgREST local rejeitou o método HTTP TRUNCATE com **405**; não há método correspondente da Data API.
- Foram inspecionadas as 55 funções públicas do catálogo: nenhuma contém TRUNCATE. Não foi encontrado endpoint de SQL arbitrário nos fluxos RPC/Edge Functions da main examinados.
- A única função pública encontrada com SQL dinâmico é `rls_auto_enable`, SECURITY DEFINER de retorno `event_trigger`. Ela opera sobre metadados de comandos DDL, não recebe SQL do usuário. A chamada por RPC local foi rejeitada com **HTTP 400 / 0A000**: não é uma RPC genérica de SQL.

Conclusão limitada: **não foi demonstrada exploração direta do TRUNCATE pelos fluxos testados**. Isso depende das FKs e grants atuais, não substitui privilégio mínimo. Uma mudança futura de dependências/grants pode mudar o resultado. A proposta de correção separada continua sendo revogar TRUNCATE dos papéis clientes, em migration autorizada e testada, sem executar TRUNCATE para validar produção.

### Fidelidade da simulação

O primeiro preparo do ambiente detectou que os defaults do Supabase local deixavam grants adicionais depois da restauração. Isso foi identificado antes de qualquer teste de exploração. O schema public ainda sem fixtures foi recriado somente no container descartável, eliminando os defaults locais anteriores.

Depois da restauração correta, a comparação confirmou igualdade da definição da view, das seis relações envolvidas, das 25 policies, das 55 funções públicas e das FKs que referenciam empresas. Somente então as fixtures e os testes foram executados. Nenhum grant remoto foi alterado para fazer o teste passar.

O serviço de login não foi iniciado. O gateway local sem GoTrue não exigia API key; o PostgREST validou os JWTs distintos, comprovado pelo controle positivo de RLS. A ausência de login não significa que as consultas tenham sido executadas como service_role.

## 2. Backfill local: 17/18 testes aprovados

Arquivo criado **pela CLI Supabase 2.116.0**, sem timestamp inventado:

`supabase/migrations/20260903232800_backfill_missing_access_usernames.sql`

É um rascunho não aprovado. A implementação local:

- Alcança somente vínculos com username NULL ou vazio, identificados por empresa + usuário.
- Preserva a precedência da expressão histórica e valida pelo formato das RPCs endurecidas de 202607280002; não cria sufixos nem usa metadata para conceder privilégios.
- Rejeita fonte/usuário/vínculo ausente, formato inválido e colisões case-insensitive por empresa.
- Usa transação, lock curto com NOWAIT para writers concorrentes e bloqueio das fontes Auth enquanto valida e atualiza.
- Mantém o índice único existente e os triggers. O trigger preexistente de updated_at pode atualizar esse timestamp técnico; os demais campos são comparados antes/depois e uma alteração indireta provoca rollback.
- Não modifica auth.users, e-mail, papéis, perfis, permissões, status ou executor.
- Emite mensagens constantes sem valores pessoais.

### Testes executados

```powershell
$env:GESTMAN_SQL_CONTAINER='supabase_db_gm-phase04-security'
node --test tests/sql/backfill-missing-access-usernames.test.mjs
```

O runner exige um container do projeto descartável identificado pelos labels; não aceita URL de banco remoto. Foram usados somente dados sintéticos.

| Caso | Resultado |
|---|---|
| NULL corrigido com preservação de tenant/papel/permissões | PASSOU |
| Vazio corrigido | PASSOU |
| Preenchido preservado mesmo com fonte inválida | PASSOU |
| Prefixo histórico do e-mail sem candidato de metadata | PASSOU |
| Usuário associado inexistente | PASSOU: rejeição atômica |
| Fonte ausente | PASSOU: rejeição |
| Formato inválido sem fallback inventado | PASSOU: rejeição |
| Colisão com preenchido, sem distinguir maiúsculas/minúsculas | PASSOU: rejeição |
| Colisão entre candidatos | PASSOU: rejeição |
| Mesmo username em dois tenants distintos | PASSOU |
| Empresa inexistente | PASSOU: rejeição |
| Vínculo sem usuário | PASSOU: rejeição |
| Vínculo sem empresa | PASSOU: rejeição |
| Trigger altera campo protegido | PASSOU: rollback |
| Falha tardia e mensagens sem PII | PASSOU: rollback |
| Replay / segunda execução faz zero updates | **FALHOU: SQLSTATE 42P07** |
| Writer concorrente no vínculo | PASSOU: rejeição atômica |
| Fonte Auth bloqueada concorrentemente | PASSOU: rejeição sem escrita |

### Causa do teste que falhou

O runner remove o BEGIN/COMMIT externos da migration para executar a maioria dos cenários dentro de uma transação de teste revertida. O teste de replay reutilizou esse corpo duas vezes **na mesma transação**. A primeira execução cria `gm_missing_username_candidates` com `ON COMMIT DROP`; como não houve COMMIT entre as duas chamadas do corpo, a tabela temporária ainda existe na segunda chamada. O PostgreSQL retorna `42P07` (relação já existente).

Isso não é prova de falha em duas execuções reais da migration, cada uma com seu COMMIT, mas **também não valida a idempotência exigida**. A regra do pedido manda parar quando um teste falha; por isso o runner e a migration foram preservados como rascunhos, sem corrigir o teste e seguir silenciosamente.

Próximo passo técnico proposto, dependente de retomada autorizada: ajustar o cenário de replay para duas execuções completas em transações separadas, medir zero updates na segunda e confirmar que uma falha reverte integralmente. Depois repetir os 18 testes antes de integrar a Fase 04. Se for necessário suportar reentrada no mesmo contexto transacional, isso precisa ser tratado explicitamente na implementação, sem mascarar uma tabela temporária inesperada.

## 3. Fase 04 e reconciliação: não avançadas

A CLI também gerou `20260903232804_asset_work_order_lifecycle.sql` depois do username. O arquivo permaneceu vazio, sem conteúdo de 6af297f. Após a falha do gate, esse arquivo vazio criado nesta tarefa foi removido para não deixar uma migration vazia no diretório ativo. Não há segunda migration pronta no candidato.

- Não foi adicionada a versão antiga `202608310001`.
- Nenhuma migration histórica foi editada ou movida.
- WhatsApp não foi movido nem marcado como aplicado.
- `202607190001` e `202608270001` não foram movidas nem reparadas.
- O arquivo remoto `20260827232250_company_public_brand_lookup.sql` foi recuperado **somente no diretório temporário**. SHA-256 confirmado: `7e9e58ce0e29d7fb162cc6ce577fd2de993fd68a768c9afdd5c28c3af6b31111`. Ele não foi adicionado ao candidato nem seu registro remoto revertido.
- Não foi preparado um manifesto de candidato ou os três commits solicitados, pois isso exige todos os gates aprovados.

As únicas versões ainda elegíveis a uma **futura proposta textual** de reconhecimento de histórico permanecem: `202607160004`, `202607170001`, `202607170002`, `202607180001`, `202607180002`, `202607180003`. Nenhum comando de repair foi executado ou preparado para execução. `202607190001`, `202608270001`, WhatsApp e a antiga Fase 04 não entram nessa lista.

## 4. Validações posteriores não executadas

Por interrupção obrigatória no backfill: não foram executados a simulação final de histórico/dry-run de duas migrations, os 20 testes SQL da nova Fase 04, advisors finais, suíte completa ou build de um candidato integrado. Não há resultado aprovado a declarar para essas etapas.

`git diff --check` passou. `index.html`, `404.html`, migrations históricas e baseline permaneceram iguais à base, sem alteração de estoque. Nenhum commit novo foi criado.

Arquivos locais novos retidos desta etapa:

- `supabase/migrations/20260903232800_backfill_missing_access_usernames.sql` — rascunho não aprovado.
- `tests/sql/backfill-missing-access-usernames.test.mjs` — 17/18, replay ainda pendente.
- `docs/audits/phase04-forward-only-gate.md` — este relatório.
- `docs/audits/phase04-security-results.json` — somente resultados dos 12 testes, sem dados individuais.

**Nenhuma escrita remota, login, migration remota, repair, db push real, merge, push ou deploy. Não há candidato de publicação.**

Encerramento: o projeto Docker descartável `gm-phase04-security` foi parado com `--no-backup`; a ausência de seus containers, volumes e rede foi verificada. O diretório temporário específico foi validado antes da remoção e seus dumps, catálogos, chaves locais e fixtures não foram retidos. Não são recuperáveis por esse ambiente. Os quatro arquivos locais acima permanecem, sem commit; as alterações preexistentes do repositório principal foram preservadas.

## 5. Reabertura controlada do replay — 08/09/2026

O teste anterior permanece registrado acima: ele executava duas cópias do corpo da
migration dentro da mesma transação e, portanto, era um cenário artificial
inválido para replay de arquivo de migration. Não houve alteração na migration;
seu SHA-256 permanece
`ebde124f2b3a2553c68623c5c659d50ecb3a53958bbbff8129cf9a766788d394`.

O runner passou a executar o arquivo completo, incluindo `BEGIN` e `COMMIT`, por
duas conexões `psql` independentes, no mesmo banco e sem reseed entre as
execuções. Após a primeira execução, um único vínculo elegível foi corrigido,
enquanto o vínculo preenchido, `auth.users`, tenant, papel, perfil, permissões,
status e campos protegidos permaneceram iguais. A tabela temporária não existia
após o COMMIT. O snapshot inclui os campos técnicos e `xmin` somente das fixtures
sintéticas. Após a segunda execução, conteúdo, `updated_at`, `xmin` e hash ficaram
idênticos, comprovando zero updates; não houve `42P07` nem mensagem com PII.

Resultado do backfill: **18/18 testes aprovados**.

## 6. Candidato local — estado dos gates

- Nova migration da Fase 04 criada pela CLI: `20260908213849_asset_work_order_lifecycle.sql`.
- SHA-256 do SQL funcional: `60c1a868ef076e723ae3fa1e2addd9829a496aa53bd70916a2d0b3546bd75a0d`, igual ao SQL seguro de referência.
- Arquivo remoto canônico de branding adicionado com o hash já auditado.
- WhatsApp foi apenas movido, byte a byte, para `supabase/deferred/`; seu conteúdo funcional não mudou.
- As versões locais substituídas foram movidas, byte a byte, para `supabase/superseded/` e documentadas no manifesto.
- Dry-run local: listou exclusivamente `20260903232800` e `20260908213849`, nessa ordem.
- Testes SQL da Fase 04: **20/20**.
- Testes direcionados/segurança estática da Fase 04: **21/21**.
- Segurança com dois tenants/JWTs sintéticos, RLS e grants: **12/12**.
- Suíte completa da aplicação: **111/111**.
- Todos os validadores estáticos: aprovados.
- Advisor local: nenhum erro; um aviso preexistente de variável sombreada/não usada em `gm_is_valid_cnpj`.
- `git diff --check`: aprovado.
- `index.html` e `404.html`: conteúdo idêntico.
- Nenhum arquivo de estoque, `debug.log`, `dist`, `test-results` ou `.codex` está no diff do candidato.

### Gate final fechado

Após autorização explícita, o build foi repetido com acesso ampliado restrito ao
worktree isolado. TypeScript e Vite concluíram com sucesso. Os avisos sobre dois
scripts clássicos sem `type="module"` são preexistentes e não impediram o bundle.
O build criou somente `dist/`, já ignorado pelo Git; os hashes de `package.json`,
`package-lock.json`, `vite.config.ts`, `tsconfig.json`, `index.html` e `404.html`
permaneceram idênticos aos valores anteriores ao build. O candidato ficou apto a
ser organizado nos três commits locais autorizados.

Nenhum repair, push, merge, deploy, login, migration remota ou escrita em banco
remoto foi executado nesta reabertura.
