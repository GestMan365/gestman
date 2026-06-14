# Escopo inicial - GestMan365

## Objetivo

Criar um sistema web para gestao de manutencao, ativos e chamados operacionais, inspirado em plataformas de manutencao/CMMS.

## Modulos principais

1. Painel geral
   - Indicadores de ordens abertas, atrasadas, concluidas e custo estimado.
   - Alertas de manutencoes vencidas ou proximas.
   - Lista das ordens mais urgentes.

2. Ativos e equipamentos
   - Cadastro de maquinas, veiculos, ferramentas, setores e localizacao.
   - Codigo patrimonial, numero de serie, criticidade, status e responsavel.
   - Historico de manutencoes por ativo.

3. Ordens de servico
   - Abertura, atribuicao e acompanhamento de OS.
   - Prioridade, prazo, tecnico, tipo de servico e status.
   - Registro de materiais, tempo gasto, observacoes e anexos.

4. Manutencao preventiva
   - Planos recorrentes por ativo.
   - Periodicidade por dias, horas de uso ou quilometragem.
   - Geracao automatica de ordens quando chegar o vencimento.

5. Chamados
   - Solicitacao por operadores ou usuarios internos.
   - Triagem para transformar chamado em ordem de servico.
   - Acompanhamento por status e prioridade.

6. Estoque
   - Cadastro de pecas, materiais e ferramentas.
   - Saldo minimo, consumo por OS e alertas de reposicao.

7. Relatorios
   - Disponibilidade dos ativos.
   - Tempo medio de atendimento.
   - Custos por setor, ativo e periodo.
   - Preventivas realizadas versus vencidas.

8. Usuarios e permissoes
   - Administrador, gestor, tecnico, solicitante e almoxarifado.
   - Controle de acesso por modulo.

## MVP recomendado

Para a primeira versao funcional:

1. Login simples.
2. Painel geral.
3. Cadastro de ativos.
4. Cadastro e acompanhamento de ordens de servico.
5. Planos de preventiva.
6. Chamados internos.
7. Relatorio basico em tela.

## Proxima decisao importante

Escolher a base tecnica:

- Opcao rapida: app web com React, banco local/PostgreSQL e API simples.
- Opcao empresarial: backend separado, controle de permissoes completo, auditoria e relatorios exportaveis.
- Opcao piloto: prototipo estatico validado com usuarios antes de construir o sistema definitivo.
