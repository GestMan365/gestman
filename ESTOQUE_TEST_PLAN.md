# Plano de Testes — Estoque, Materiais e Ferramentas

## Objetivo

Validar o ciclo operacional de materiais e ferramentas do GestMan365 em ambiente demo, com rastreabilidade, isolamento por empresa e integração bidirecional com Ordens de Serviço e PCM. Esta entrega não executa migrações, não acessa o Supabase remoto e não publica a aplicação.

## Escopo funcional

- cadastro, edição e inativação de itens;
- saldos total, reservado, bloqueado e disponível;
- entradas, saídas, reservas, cancelamentos, consumo, devolução, ajustes, transferência, inventário e baixas;
- validação contra saldo negativo e quantidades inválidas;
- custo médio e custo realizado somente quando há dado conhecido;
- materiais previstos pelo PCM sem baixa automática;
- histórico de materiais na O.S.;
- cadastro, empréstimo, devolução e atraso de ferramentas;
- permissões por perfil e isolamento multiempresa;
- responsividade em desktop, tablet e celular.

## Dados controlados

- itens: prefixo `QA-AUTO-EST`;
- ferramentas: prefixo `QA-AUTO-FERR`;
- dados persistidos somente em `sessionStorage` durante o modo demo;
- limpeza limitada aos prefixos QA da empresa ativa;
- nenhuma massa é criada em produção.

## Regras críticas verificadas

1. Quantidade deve ser positiva.
2. Saldo total, reservado e disponível nunca pode ficar negativo.
3. Reserva não pode ultrapassar o saldo disponível.
4. Cancelamento não pode ultrapassar a reserva da O.S.
5. Devolução não pode ultrapassar o consumo líquido da O.S.
6. Ajustes e inventário exigem justificativa.
7. Operações de O.S. exigem vínculo explícito.
8. O.S. encerrada ou cancelada não recebe nova reserva, consumo ou empréstimo.
9. Planejamento preventivo apenas prevê materiais; não baixa estoque.
10. Movimentos têm chave de idempotência e histórico não editável pela interface.
11. Custos ausentes permanecem ausentes.
12. Registros de outra empresa não aparecem.

## Matriz de perfis

| Perfil | Consulta | Reserva | Consumo/devolução | Ajustes | Cadastro/edição |
| --- | --- | --- | --- | --- | --- |
| Administrador | Sim | Sim | Sim | Sim | Sim |
| Supervisor | Sim | Sim | Sim | Sim | Não |
| Planejador | Sim | Sim | Não | Não | Não |
| Técnico | Sim | Não | Sim | Não | Não |
| Solicitante | Não | Não | Não | Não | Não |

## Suíte E2E

Arquivo: `tests/inventory/inventory.spec.ts`.

A suíte contém 56 cenários numerados, executados no Chromium e com um worker. Ela cobre autenticação, navegação, indicadores, filtros, formulários, validações, todos os ciclos essenciais, integração PCM/O.S., ferramentas, perfis, isolamento, recuperação de armazenamento corrompido, console e responsividade.

## Comandos

```powershell
npm run build
npx playwright test tests/inventory/inventory.spec.ts --project=chromium --list
npx playwright test tests/inventory/inventory.spec.ts --project=chromium
npx playwright test --project=chromium
npm run qa
```

## Critério de aceite

- build concluída sem erro;
- 56/56 cenários de estoque aprovados;
- regressão integral aprovada;
- nenhum erro crítico de console ou rede;
- nenhum dado remoto modificado;
- ZIP sem `.env`, dependências, build, relatórios temporários ou mídia de falha.
