# GestMan365 — runbook de rollback de produção

## Controle

- Release candidata: `gestman365-rc-20260728-fdb8582`
- Incidente: `________________`
- Início: `________________`
- Término: `________________`
- Responsável: `________________`
- Aprovador: `________________`
- Backup utilizado: `________________`
- Evidências: `________________`

Rollback não é automaticamente seguro. Mudanças de segurança não devem ser desfeitas reabrindo grants ou policies permissivas. Quando a reversão direta não for segura, preferir feature disable, republicação compatível ou migration corretiva revisada.

## Critérios de acionamento

Acionar rollback ou correção emergencial quando ocorrer:

- login indisponível ou sessão inválida em massa;
- bootstrap/onboarding interrompido sem mitigação;
- isolamento multiempresa violado;
- acesso legítimo bloqueado amplamente por RLS/Storage;
- upload ou leitura de anexos indisponível;
- aumento persistente de 5xx;
- corrupção, perda ou alteração inesperada de dados;
- frontend incompatível com grants/RPCs;
- hashes publicados divergentes;
- erro crítico de JavaScript.

## Matriz de resposta

| Componente | Resposta imediata | Correção avançada/restauração |
|---|---|---|
| `index.html` e `404.html` | Republicar juntos os dois arquivos da versão anterior arquivada | Corrigir em branch separada, validar e publicar novo par |
| `orderDueState` | Republicar o frontend anterior se houver falha crítica comprovada | Corrigir somente a função e seus testes; não editar módulos não relacionados |
| Mensagem de rate limit | Republicar frontend anterior se apenas a UI regrediu | Corrigir tratamento 429 e revalidar a Edge Function |
| `package-lock.json` | Não há rollback em runtime estático | Restaurar lockfile anterior na fonte e reconstruir artefato em pipeline limpa |
| `bootstrap-company` | Republicar a versão anterior arquivada ou desabilitar temporariamente o cadastro inicial | Corrigir Edge/RPC mantendo autenticação server-side; nunca levar `service_role` ao frontend |
| `submit-company-request` | Republicar versão anterior apenas se compatível com grants vigentes; caso contrário, suspender temporariamente o formulário | Corrigir Edge/rate limit e revalidar idempotência |
| Migration `202607220001` | Não restaurar policies/grants legados; suspender fluxo afetado | Migration corretiva ou restauração de backup em ambiente controlado |
| Migration `202607220002` | Republicar frontend compatível; não reabrir RPCs internas para `anon` | Restaurar ACLs do snapshot apenas após revisão; preferir correção forward |
| Migration `202607220003` | Manter default deny se Storage falhar | Restaurar as policies capturadas ou avançar para as policies canônicas validadas |
| Migration `202607280001` | Suspender upload e manter leitura restrita se necessário | Restaurar funções/policies anteriores por migration corretiva; objetos do bucket não são apagados |
| Migration `202607280002` | Suspender mudanças de usuário, preservando leitura | Restaurar definições anteriores das três RPCs por migration corretiva |

## Procedimento geral

1. Declarar incidente e congelar novas alterações.
2. Identificar o último checkpoint aprovado.
3. Preservar logs técnicos sem dados pessoais ou segredos.
4. Confirmar se há risco de isolamento multiempresa. Se houver, interromper imediatamente os fluxos afetados.
5. Selecionar uma estratégia:
   - republicação da versão anterior;
   - feature disable;
   - migration corretiva;
   - restauração de backup;
   - correção avançada com janela ampliada.
6. Executar somente a estratégia aprovada pelo responsável de rollback.
7. Validar login, contexto empresarial, RLS, Storage e frontend.
8. Registrar a migration corretiva no histórico; não apagar ou falsificar versões aplicadas.
9. Remover dados temporários do diagnóstico.
10. Encerrar somente após estabilidade e aprovação.

## Rollback detalhado

### Frontend, `orderDueState` e rate limit

1. Recuperar os dois arquivos estáticos da versão pública anterior.
2. Verificar hashes do arquivo arquivado.
3. Publicar `index.html` e `404.html` na mesma operação.
4. Invalidar cache apenas pelo mecanismo do hosting; não alterar a aplicação para “resolver cache”.
5. Confirmar login, onboarding, calendário e console.

O lockfile não é servido em produção. Sua reversão ocorre somente na fonte, seguida de `npm ci`, TypeScript, build e testes.

### Bootstrap server-side

- Se a Edge Function falhar antes da migration 002, restaurar a Edge anterior ou suspender apenas o cadastro inicial.
- Depois da migration 002, não voltar o frontend à RPC direta e não devolver `EXECUTE` a `authenticated`.
- Se a RPC interna falhar, aplicar migration corretiva revisada ou restaurar o banco a partir do backup.
- Confirmar que `service_role` permanece exclusivamente server-side.

### `submit-company-request` e rate limit

- Se a regressão estiver apenas na Edge, republicar a versão anterior somente quando ela continuar compatível com os grants atuais.
- Se a versão anterior depender de RPC pública revogada, não reabrir o grant; suspender o formulário e corrigir a Edge.
- Manter registros já aceitos; não repetir inserts automaticamente.
- Limpar somente hashes/fixtures de teste, nunca solicitações reais.

### Policies de Storage e canonicalização

1. Preservar o bucket privado.
2. Se necessário, remover temporariamente a permissão de escrita, mantendo default deny.
3. Restaurar helpers e policies a partir do catálogo capturado.
4. Nunca tornar o bucket público.
5. Não remover objetos do Storage durante rollback de policy.
6. Validar leitura/escrita do próprio tenant e bloqueios cross-tenant/traversal.

### Separação membership/perfil

- Suspender ações administrativas de ativação/desativação se o comportamento divergir.
- Restaurar as definições anteriores das RPCs por migration corretiva.
- Não atualizar em massa `gm_profiles.active`.
- Não remover memberships de outras empresas.
- Comparar auditoria e estado antes/depois para cada usuário afetado.

### PostgreSQL

As cinco migrations alteram principalmente funções, grants, triggers e policies e não possuem down migration automática. O rollback recomendado é forward-only com SQL revisado. Restaurar backup completo apenas quando:

- houver perda/corrupção de dados;
- a migration falhar fora da transação;
- o catálogo não puder ser reparado com segurança;
- o tempo de correção exceder o limite definido para a janela.

Uma restauração completa também afeta Auth, Storage e alterações legítimas posteriores ao backup. Exige aprovação de incidente e comunicação de perda potencial de dados.

## Verificação pós-rollback

- [ ] Login, sessão e logout aprovados.
- [ ] Empresa/contexto carregados.
- [ ] Dois tenants isolados.
- [ ] Usuário inativo bloqueado.
- [ ] RPCs internas não expostas a `anon`/`authenticated`.
- [ ] Bucket privado.
- [ ] Upload/leitura/exclusão do próprio tenant aprovados.
- [ ] Traversal e cross-tenant bloqueados.
- [ ] Onboarding e rate limit em estado conhecido.
- [ ] Sem 5xx inesperados.
- [ ] Frontend anterior com hashes confirmados.
- [ ] Migration history consistente.
- [ ] Dados QA removidos.

Resultado: `________________`
