# GestMan365 — Roadmap

## Prioridades

- **P0:** seguranca, isolamento multiempresa, integridade de dados e acesso ao sistema.
- **P1:** fluxos centrais de ativos, O.S., PCM, estoque e experiencia mobile.
- **P2:** indicadores avancados, integracoes e recursos de escala comercial.

## Fase 1 — Fundacao tecnica (P0)

Arquitetura React/TypeScript, configuracao por ambiente, padroes de codigo, build repetivel, testes E2E, documentacao e pipeline base.

**Criterio de aceite:** build e testes obrigatorios passam; nenhum segredo e versionado; ambientes sao configuraveis sem alterar codigo.

## Fase 2 — Autenticacao e permissoes (P0)

Supabase Auth, modo demo isolado, sessao, logout, perfis, empresas, protecao de rotas e politicas RLS.

**Criterio de aceite:** usuario acessa somente empresa, modulo e operacao autorizados; inativos sao bloqueados; recarga preserva sessao valida.

## Fase 3 — Ativos e O.S. (P1)

Cadastro e hierarquia de ativos, solicitacoes, ciclo completo da Ordem de Servico, executantes, tempos, materiais, anexos e historico.

**Criterio de aceite:** fluxo criar–atribuir–executar–concluir e auditavel e validado em desktop e mobile.

## Fase 4 — PCM e preventivas (P1)

Planos de manutencao, periodicidades, calendario, backlog, recursos e geracao controlada de O.S.

**Criterio de aceite:** planos geram atividades sem duplicacao e vencimentos/atrasos correspondem aos dados reais.

## Fase 5 — Estoque (P1)

Catalogo de pecas, almoxarifados, entradas, saidas, transferencias, requisicoes e estoque minimo.

**Criterio de aceite:** toda movimentacao e rastreavel, o saldo permanece consistente e alertas refletem o estoque real.

## Fase 6 — Indicadores (P1)

MTTR, MTBF, disponibilidade, backlog, cumprimento preventivo, paradas e consumo de materiais.

**Criterio de aceite:** cada indicador possui formula, periodo, filtros, fonte rastreavel e tratamento de ausencia de dados.

## Fase 7 — Mobile (P1)

Experiencia de tecnico otimizada para toque, baixa conectividade, checklist, apontamentos e evidencias.

**Criterio de aceite:** principais tarefas de campo funcionam em largura de celular, sem rolagem horizontal e com recuperacao segura de falha.

## Fase 8 — Integracoes (P2)

APIs, webhooks, notificacoes, ERP, sensores e importacao/exportacao controlada.

**Criterio de aceite:** integracoes sao autenticadas, idempotentes, observaveis e isoladas por empresa.

## Fase 9 — Comercializacao SaaS (P2)

Onboarding de empresas, planos e limites, operacao administrativa GestMan, suporte, auditoria e metricas de uso.

**Criterio de aceite:** uma empresa pode ser criada, configurada, ativada, suspensa e auditada sem acesso cruzado ou intervencao direta no banco.

## Regra de passagem entre fases

Uma fase so avanca quando os criterios de aceite estao automatizados nos fluxos criticos, a documentacao esta atualizada e `npm run qa` passa no ambiente de homologacao.
