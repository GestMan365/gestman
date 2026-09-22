# Cronograma anual preventivo

- Somente leitura, dentro de Planos de Manutenção, em painel expansível.
- Máquinas nas linhas; todas as semanas que intersectam o ano nas colunas.
- Semanas ISO começam na segunda-feira. Cabeçalhos mostram intervalo e ano
  ISO quando diferente; janeiro/dezembro não são descartados.
- Seleção de ano (atual ±10), busca de máquina, primeira coluna fixa,
  rolagem interna e indicação da semana atual.
- Vermelho: data anterior a hoje sem O.S. concluída.
- Verde: O.S. concluída/finalizada/encerrada, nunca cancelada.
- Azul: data de hoje ou futura sem conclusão.
- Uma célula pode exibir mais de uma cor, com contagem e detalhes de leitura.
- O.S. são relacionadas pelo plano E máquina, respeitando tenant explícito.
- Data da ocorrência usa preventivePlanExecutionDate, scheduledAt ou dueAt.
  Conclusão tardia fica na semana originalmente prevista.
- A próxima execução é projetada usando a mesma periodicidade do gerador atual.
  Planos pausados/inativos não têm novas projeções, mas mantêm O.S. históricas.
- Não retroprojeta a periodicidade atual para criar histórico não registrado.
  Espaço vazio significa ausência de ocorrência conhecida, não conclusão.
- Planos/O.S. sem data válida são contabilizados na nota de cobertura.
- Não gera O.S., não grava preferências nem altera planos, Auth ou banco.
- Sem garantia de histórico anterior à disponibilidade das O.S.; o campo
  lastExecution não é prova de conclusão, pois é atualizado na geração.
