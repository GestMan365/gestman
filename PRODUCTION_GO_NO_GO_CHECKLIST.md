# GestMan365 — checklist GO/NO-GO de produção

## Identificação

- Release candidata: `gestman365-rc-20260728-fdb8582`
- Data/janela: `________________`
- Início previsto: `________________`
- Término previsto: `________________`
- Release manager: `________________`
- DBA/Supabase: `________________`
- Frontend: `________________`
- Rollback: `________________`
- Aprovação técnica: `________________`
- Aprovação de negócio: `________________`
- Evidências: `________________`

Marcar GO somente quando todos os itens obrigatórios estiverem comprovados.

## Repositório e artefatos

- [ ] `origin/main` não possui commits ausentes na branch candidata.
- [ ] Commits da release foram revisados.
- [ ] Árvore Git limpa.
- [ ] Não há alteração não commitada.
- [ ] Hashes de baseline, cinco migrations, duas Edge Functions, `index.html`, `404.html` e lockfile coincidem com o manifesto.
- [ ] Auditoria de segredos não encontrou token, chave privada ou `service_role` literal.
- [ ] `index.html` e `404.html` serão publicados juntos.
- [ ] Aplicação React paralela está excluída da publicação.
- [ ] Servidor Vite não será exposto.

## Ambiente e backup

- [ ] Produção identificada sem ambiguidade.
- [ ] Project ref e URL foram comparados internamente sem serem registrados por inteiro.
- [ ] Backup de schema concluído.
- [ ] Backup de dados concluído.
- [ ] Backup/snapshot gerenciado verificado.
- [ ] Migration history capturado.
- [ ] Catálogo, funções, triggers, policies e grants capturados.
- [ ] Buckets, configuração de Storage e contagens capturados.
- [ ] Versões das Edge Functions atuais preservadas.
- [ ] Frontend público anterior arquivado.
- [ ] Procedimento de restauração validado.

## Compatibilidade e ordem

- [ ] Drift de schema foi analisado e explicado.
- [ ] Migrations não inventariadas foram investigadas.
- [ ] As dependências de todas as migrations existem.
- [ ] `gm_consume_public_rate_limit` existe com assinatura compatível.
- [ ] Bucket de anexos existe e é privado.
- [ ] Tabelas gerenciadas do Storage existem.
- [ ] Baseline foi explicitamente excluído da execução em produção.
- [ ] Migrations históricas foram explicitamente excluídas.
- [ ] Estratégia de aplicação individual e migration history foi aprovada.
- [ ] `bootstrap-company` estará publicada antes da migration 002.
- [ ] Cutover do frontend foi coordenado antes da revogação da RPC antiga.
- [ ] Plano de rollback foi revisado pelo responsável.

## Qualidade e segurança

- [ ] Staging permanece aprovado.
- [ ] 22/22 testes E2E oficiais continuam como última evidência válida.
- [ ] 10/10 testes de bootstrap aprovados.
- [ ] 56/56 testes integrados de RLS/RPC/Storage/onboarding aprovados.
- [ ] 91/91 validações de onboarding/JavaScript aprovadas.
- [ ] TypeScript aprovado.
- [ ] Build aprovado.
- [ ] Checks estáticos aprovados.
- [ ] Deno `check` e `lint` aprovados.
- [ ] Dados `QA-E2E-STAGING-` e `QA-SECURITY` residuais: zero.
- [ ] Nenhum teste crítico está falhando.
- [ ] `service_role` não aparece no frontend.

## Operação

- [ ] Janela de implantação definida.
- [ ] Comunicação de impacto aprovada.
- [ ] Release manager presente.
- [ ] Operador Supabase/DBA presente.
- [ ] Operador frontend presente.
- [ ] Responsável pelo rollback presente.
- [ ] Conta autorizada e prefixo para smoke test definidos.
- [ ] Plano de limpeza dos dados de teste definido.
- [ ] Painéis/logs de monitoramento disponíveis.
- [ ] Critério de interrupção e limite de tempo definidos.

## NO-GO automático

Marcar NO-GO se qualquer condição ocorrer:

- [ ] ambiente ou project ref ambíguo;
- [ ] produção com commits/artefatos diferentes dos revisados;
- [ ] branch baseada em `origin/main` desatualizada;
- [ ] schema drift desconhecido;
- [ ] migration history inconsistente ou com migrations não inventariadas;
- [ ] backup ausente, incompleto ou não verificável;
- [ ] dependência SQL ausente;
- [ ] Storage sem rollback ou bucket público;
- [ ] frontend e backend incompatíveis;
- [ ] hash divergente;
- [ ] alteração não commitada;
- [ ] teste crítico falhando;
- [ ] dado QA residual;
- [ ] secret no frontend ou artefato;
- [ ] responsável pelo rollback ausente.

## Riscos aceitos explicitamente

- [ ] Bundle estático grande; impacto de desempenho aceito para esta release.
- [ ] Vite/esbuild permanecem vulneráveis somente no ambiente de desenvolvimento; servidor não será exposto.
- [ ] React Router permanece pendente por breaking change; aplicação React paralela não será publicada.
- [ ] Formatação Deno preexistente permanece como dívida não bloqueante.
- [ ] Janela breve de corte do onboarding foi comunicada.

## Decisão

- Resultado: `GO / NO-GO`
- Motivo: `________________`
- Condições adicionais: `________________`
- Aprovador técnico: `________________`
- Aprovador de negócio: `________________`
- Horário da decisão: `________________`

## Pós-implantação

- [ ] Smoke tests completos.
- [ ] Dados temporários removidos.
- [ ] Sem erro 5xx inesperado.
- [ ] Sem violação de isolamento.
- [ ] Sem erro `orderDueState`.
- [ ] Monitoramento inicial ativo.
- [ ] Evidências anexadas.
- [ ] Encerramento aprovado.
