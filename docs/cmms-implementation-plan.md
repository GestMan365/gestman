# Plano de implementação CMMS do GestMan365

Este backlog deriva da auditoria registrada em `docs/cmms-audit.md`. A ordem considera impacto operacional, risco de dados e dependências entre módulos.

## P0 — bloqueadores de produção

### P0.3 — Camada única de indicadores (primeira entrega)

- **Impacto:** muito alto; elimina decisões divergentes entre Dashboard, Indicadores, Relatórios e IA.
- **Complexidade:** média.
- **Dependências:** `gm_tenant_state`, autenticação Supabase e Edge Functions.
- **Risco:** mudança de números percebidos; indicadores antes exibidos como zero ou 100% podem passar a “Sem dados”.
- **Critérios de aceite:**
  - um único módulo backend calcula MTTR, MTBF e disponibilidade;
  - frontend e IA consomem o mesmo contrato;
  - ausência de dados permanece `null`;
  - contrato informa valor, unidade, período, filtros, registros, fonte, fórmula, qualidade e atualização;
  - paradas sobrepostas não são contadas duas vezes;
  - disponibilidade sem calendário operacional válido é indisponível;
  - testes cobrem dados válidos, ausentes, inválidos e sobrepostos.

### P0.1 — Geração automática de O.S. preventivas

- **Impacto:** muito alto; fecha o elo plano → O.S.
- **Complexidade:** alta.
- **Dependências:** modelo de ocorrência preventiva, idempotência, scheduler, máquina de estados, calendário operacional e reconciliação de responsáveis.
- **Risco:** duplicar O.S. ou avançar plano sem persistir a ordem.
- **Critérios de aceite:** plano vencido gera exatamente uma O.S. tenant-scoped e auditável; falhas podem ser repetidas sem duplicação; planos pausados não geram; próxima execução avança apenas após transação consistente.

### P0.2 — Fonte de verdade de usuários e recursos

- **Impacto:** muito alto; estabiliza planejamento e execução.
- **Complexidade:** alta.
- **Dependências:** memberships, perfis, recursos e equipes.
- **Risco:** associação incorreta de pessoas existentes e perda de histórico nominal.
- **Critérios de aceite:** recurso pode vincular um usuário sem duplicidade; status operacional é único; executante habilitado aparece imediatamente em O.S. e calendário; snapshots antigos continuam legíveis.

### P0.4 — Máquina de estados de O.S.

- **Impacto:** muito alto; garante integridade do ciclo operacional.
- **Complexidade:** alta.
- **Dependências:** eventos imutáveis, prioridades/SLA, recursos e paradas.
- **Risco:** bloquear fluxos históricos com status fora do padrão.
- **Critérios de aceite:** transições validadas no backend; histórico imutável; prazos críticos; pausas e retomadas consistentes; encerramento corretivo estruturado; intervalos inválidos rejeitados.

### P0.5 — Sincronização ativo, parada e O.S.

- **Impacto:** muito alto; corrige disponibilidade e visão 360º do ativo.
- **Complexidade:** alta.
- **Dependências:** máquina de estados e taxonomia de parada.
- **Risco:** alterar estado do ativo indevidamente em paradas concorrentes.
- **Critérios de aceite:** uma única parada ativa compatível por ativo; abertura/encerramento atualiza estado de forma transacional; duração calculada no servidor; vínculo com O.S. e linha do tempo preservados.

### P0.6 — Rotas e deep links

- **Impacto:** alto; melhora navegação, suporte e links operacionais.
- **Complexidade:** média.
- **Dependências:** definição de rotas e configuração de fallback do hosting.
- **Risco:** quebrar URLs antigas, QR Codes e retorno do navegador.
- **Critérios de aceite:** rotas por módulo e entidade; refresh direto; voltar/avançar; filtros relevantes na query; permissão e tenant validados antes de abrir IDs.

### P0.7 — Hardening de segurança

- **Impacto:** crítico.
- **Complexidade:** alta e contínua.
- **Dependências:** Auth, RLS, Storage, Edge Functions e fluxo de release.
- **Risco:** regressão de acesso legítimo ou exposição cross-tenant.
- **Critérios de aceite:** convite sem senha administrativa; troca inicial; expiração; “continuar conectado” desmarcado; rate limits; upload privado; auditoria; testes automatizados com dois tenants; recuperação e backup exercitados.

## P1 — maturidade operacional

### Automação por exceção

- **Impacto:** alto.
- **Complexidade:** média.
- **Dependências:** P0.1 e P0.4.
- **Risco:** excesso de O.S. automáticas.
- **Aceite:** checklist não conforme e medição crítica geram ação/O.S. idempotente conforme regra configurada.

### Taxonomia de falhas e encerramento

- **Impacto:** alto.
- **Complexidade:** média.
- **Dependências:** P0.4.
- **Risco:** incompatibilidade com descrições históricas.
- **Aceite:** falha, causa, dano, componente e ação possuem códigos; registros históricos preservam texto original.

### Planejamento semanal por capacidade

- **Impacto:** alto.
- **Complexidade:** alta.
- **Dependências:** P0.2, calendários produtivos e durações planejadas.
- **Risco:** capacidade incorreta por ausência de turno/ausência.
- **Aceite:** conflitos de equipe/recurso identificados; carga por especialidade e turno; backlog em semanas e aderência calculados.

### Custos de manutenção

- **Impacto:** alto.
- **Complexidade:** alta.
- **Dependências:** O.S., recursos, peças e fornecedores consistentes.
- **Risco:** dupla contabilização de custos.
- **Aceite:** mão de obra, peças e terceiros consolidados por O.S., ativo e período com rastreabilidade.

### Maturidade de estoque

- **Impacto:** alto.
- **Complexidade:** média/alta.
- **Dependências:** cadastro de peças e movimentações.
- **Risco:** regras de reposição inadequadas.
- **Aceite:** mínimo, máximo, ponto de reposição, lead time, custo médio, reserva por O.S., inventário rotativo e ABC.

### Biblioteca de checklists por classe

- **Impacto:** médio/alto.
- **Complexidade:** média.
- **Dependências:** taxonomia de ativos e checklists.
- **Risco:** modelos duplicados.
- **Aceite:** modelos versionados e aplicáveis por classe sem alterar execuções históricas.

### Acessibilidade e UX operacional

- **Impacto:** médio/alto; reduz erro de operação e amplia o uso por teclado e tecnologias assistivas.
- **Complexidade:** média.
- **Dependências:** matriz de componentes, navegação profunda e cobertura Playwright.
- **Risco:** alterar seletores usados por automações ou foco de modais existentes.
- **Aceite:** elementos decorativos ficam fora da árvore acessível; todos os controles possuem nome contextual; foco é contido e restaurado nos modais; paginação, loading, vazio, erro e confirmação destrutiva são consistentes; contraste e teclado são validados em ambos os temas.

## P2 — evolução e integrações

### PWA e modo offline

- **Impacto:** alto para campo.
- **Complexidade:** alta.
- **Dependências:** conflitos, fila transacional e segurança de dispositivo.
- **Risco:** dados divergentes em sincronização.
- **Aceite:** fila offline auditável, resolução de conflito, QR Code e revogação de sessão.

### Integrações industriais

- **Impacto:** variável/alto.
- **Complexidade:** alta.
- **Dependências:** modelo relacional consolidado e API versionada.
- **Risco:** dados de sensores não confiáveis e alta volumetria.
- **Aceite:** contratos versionados para ERP, IoT/SCADA, e-mail e mensageria; observabilidade e retentativas.

### Analytics avançado

- **Impacto:** médio/alto.
- **Complexidade:** alta.
- **Dependências:** P0.3 e dados de qualidade.
- **Risco:** inferências indevidas com histórico insuficiente.
- **Aceite:** modelos somente com base demonstrável, qualidade explícita e possibilidade de auditoria.

### Decomposição progressiva do monólito

- **Impacto:** estrutural.
- **Complexidade:** alta.
- **Dependências:** contratos de domínio e cobertura E2E.
- **Risco:** regressão ampla por alteração simultânea.
- **Aceite:** extração incremental por módulo, sem reescrita total, mantendo IDs/contratos e paridade comprovada.

## Sequência recomendada

1. concluir P0.3 e observar os dados que passam a ser classificados como insuficientes;
2. modelar P0.2 e P0.4 em migrations aditivas;
3. implementar P0.5 sobre a máquina de estados;
4. implementar P0.1 com idempotência e scheduler;
5. concluir rotas P0.6 e hardening contínuo P0.7;
6. iniciar P1 apenas após métricas e ciclo operacional confiáveis.

## Decisões de produto pendentes

- calendário operacional canônico por planta, área, local ou ativo;
- política para planos vencidos acumulados;
- SLA padrão por prioridade e possibilidade de justificativa;
- obrigatoriedade configurável de causa/modo de falha;
- política de associação automática entre usuário e recurso existente;
- retenção e imutabilidade dos eventos operacionais.
