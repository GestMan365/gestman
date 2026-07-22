# Plano de Testes — PCM e Manutenção Preventiva

## Escopo e segurança

Cobertura E2E do módulo PCM em `VITE_AUTH_MODE=demo`, com dados determinísticos `QA-AUTO-PCM`, sessão isolada por empresa e nenhuma chamada ao Supabase. A limpeza remove somente códigos iniciados por `QA-AUTO-PCM`.

| ID | Grupo | Objetivo / pré-condição | Dados e passos resumidos | Resultado esperado | Prioridade | Tipo / risco | Automação |
|---|---|---|---|---|---|---|---|
| PCM-001 | Smoke | Abrir PCM autenticado | Login admin e menu PCM | Estrutura, resumo, filtros e planos visíveis | Crítica | E2E / indisponibilidade | Sim |
| PCM-002 | Segurança | Bloquear anônimo | Abrir `#/pcm` sem sessão | Redireciona ao login | Crítica | E2E / acesso indevido | Sim |
| PCM-003 | Leitura | Listar seed idempotente | Quatro planos QA | Sem duplicidade, NaN, null ou undefined | Alta | E2E / corrupção visual | Sim |
| PCM-004 | Busca | Buscar código e nome | Código bomba; termo compressor | Resultado correto | Média | E2E / localização | Sim |
| PCM-005 | Filtros | Filtrar status, gatilho e ativo | ATIVO, HORIMETRO, ativo bomba | Lista coerente | Alta | E2E / decisão errada | Sim |
| PCM-006 | Estado vazio | Busca inexistente | `PCM-INEXISTENTE` | Mensagem clara | Média | E2E / UX | Sim |
| PCM-007 | Criação | Criar rascunho válido | Código QA, ativo, periodicidade e procedimento | Plano em RASCUNHO | Crítica | E2E / cadastro | Sim |
| PCM-008 | Validação | Campos mínimos | Omitir ativo | Navegador bloqueia envio e preserva formulário | Crítica | E2E / plano inválido | Sim |
| PCM-009 | Segurança demo | Restringir prefixo | Código sem QA-AUTO-PCM | Serviço rejeita | Alta | E2E / limpeza indevida | Sim |
| PCM-010 | Duplicidade | Código único por empresa | Código existente | Rejeição explícita | Crítica | E2E / conflito | Sim |
| PCM-011 | Periodicidade | Frequência positiva | Frequência zero | Bloqueio | Crítica | E2E / geração infinita | Sim |
| PCM-012 | Histórico | Abrir detalhes | Plano mensal | Ativo, gatilho, procedimento, versão e eventos | Alta | E2E / rastreabilidade | Sim |
| PCM-013 | Edição | Alterar periodicidade | Frequência 1 → 2 | Versão incrementada e evento registrado | Crítica | E2E / auditoria | Sim |
| PCM-014 | Suspensão | Exigir motivo | Suspender sem texto | Bloqueio e plano permanece ativo | Crítica | E2E / parada silenciosa | Sim |
| PCM-015 | Estados | Suspender e reativar | Motivo operacional | SUSPENSO não gera; ATIVO volta com histórico | Crítica | E2E / máquina de estados | Sim |
| PCM-016 | Geração OS | Gerar preventiva | Plano ativo e ativo válido | O.S. PLANEJADA herda dados e ambos se vinculam | Crítica | E2E / execução | Sim |
| PCM-017 | Idempotência | Repetir competência | Mesmo plano e data | Uma única O.S. | Crítica | E2E / duplicidade | Sim |
| PCM-018 | Horímetro | Bloquear regressão | 2500 → 2400 | Leitura rejeitada | Crítica | E2E / medição inválida | Sim |
| PCM-019 | Horímetro | Registrar avanço | 2500 → 2600 | Leitura e histórico atualizados | Alta | E2E / condição | Sim |
| PCM-020 | Arquivo | Arquivar sem apagar | Plano ativo | ARQUIVADO, histórico preservado, sem ações | Alta | E2E / perda de histórico | Sim |
| PCM-021 | Calendário | Mostrar programação | Planos ativos | Próximas execuções visíveis | Alta | E2E / programação | Sim |
| PCM-022 | Backlog | Não inventar capacidade | Sem cadastro de capacidade | Exibe “Estrutura base” | Alta | E2E / indicador falso | Sim |
| PCM-023 | Permissão | Planejador | Sessão PLANEJADOR | Cria/edita; não arquiva ou gera | Crítica | E2E / privilégio | Sim |
| PCM-024 | Permissão | Técnico | Sessão TECNICO | Rota administrativa bloqueada | Crítica | E2E / privilégio | Sim |
| PCM-025 | Multiempresa | Isolamento | Registro contaminado de outra empresa | Registro invisível | Crítica | E2E / vazamento tenant | Sim |
| PCM-026 | Limpeza | Restringir QA | Plano QA e plano operacional | Somente QA removido | Crítica | E2E / perda de dados | Sim |
| PCM-027 | Robustez | Console e rede | Abrir módulo | Zero erro e zero falha crítica | Alta | E2E / estabilidade | Sim |
| PCM-028 | Acessibilidade | Navegação por teclado | Enter em Novo plano | Diálogo abre e foco vai ao código | Média | E2E / acessibilidade | Sim |
| PCM-029 | Responsividade | Desktop, tablet e celular | 1920×1080, 768×1024, 390×844 | Sem rolagem horizontal global | Alta | E2E / mobile | Sim |

## Cobertura futura documentada

- Gatilhos QUILOMETRAGEM, CICLOS, MEDICAO, CONDICAO e EVENTO: modelo preparado; faltam telas e fontes reais de leitura.
- Checklist executável na O.S.: snapshot de itens é gerado, mas respostas, evidências e bloqueio de conclusão dependem do fluxo de execução de checklist.
- Capacidade da equipe, conflitos e backlog em semanas: exigem jornada, disponibilidade e horas pendentes confiáveis.
- Aprovação formal pelo Supervisor e validade do plano: dependem de política e persistência Supabase/RLS.
- Geração automática: nesta fase é simulação/manual idempotente, sem scheduler remoto.
