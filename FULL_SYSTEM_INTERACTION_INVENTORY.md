# Inventário de Interações do GestMan365

Data da validação: 08/08/2026
Ambiente: site oficial `https://gestman365.github.io/gestman/`
Empresa: Nadir
Escopo: navegador desktop, dados exclusivamente identificados pelo prefixo `NADIR-QA-`.

## Resumo

Foram exercitados os módulos visíveis no menu oficial, seus fluxos principais de navegação, criação, consulta, filtro, edição segura e persistência. Nenhum registro não identificado como QA foi alterado.

## Navegação global

| Interação | Resultado |
| --- | --- |
| Login por domínio, usuário e senha | Aprovado; autenticação concluída, com espera aproximada de 15 segundos em “Validando seu acesso” |
| Busca global | Aprovada; localizou ativos, O.S. e peças QA |
| Notificações | Aprovada; painel abriu e informou ausência de notificações |
| Ajuda | Aprovada; modal abriu, porém oferece apenas orientação mínima |
| Tema claro/escuro | Aprovado; alternado e restaurado ao tema escuro |
| Perfil | Aprovado; painel abriu sem alteração de dados |
| Menu lateral e grupos | Aprovado no desktop |
| Ações rápidas do Dashboard | Nova O.S., Executar Checklist, Registrar Parada, Solicitar Material, Consultar Ativos e Ver Relatórios responderam |

## Módulos de manutenção

| Módulo | Interações verificadas | Resultado |
| --- | --- | --- |
| Ordens de Serviço | criação em lote QA, listagem, filtros, abertura e consulta | Aprovado; 35 O.S. QA |
| O.S. em Execução | cards, estados e ordens em andamento | Aprovado; 7 em execução |
| Planos de Manutenção | criação e persistência | Aprovado; 10 planos QA |
| Checklists | criação, execução e conclusão | Aprovado; 8 checklists, uma execução concluída |
| Medições | pontos, leituras e persistência | Aprovado; 6 pontos e 7 leituras, com uma leitura duplicada durante retentativa |
| Ações Pendentes | criação e listagem | Aprovado; 8 ações QA |
| Paradas | criação, estado ativo e integração com indicadores | Aprovado; uma parada QA ativa |
| Diário de Manutenção | criação e consulta | Aprovado; 6 lançamentos QA |

## Ativos e instalações

| Módulo | Interações verificadas | Resultado |
| --- | --- | --- |
| Ativos e Equipamentos | criação, pesquisa, consulta e persistência | Aprovado; 20 ativos QA, além de um ativo demo existente |
| Identificadores de Ativos | criação, vínculo com ativo e persistência | Aprovado; `NADIR-QA-ID-001` |
| Áreas Operacionais | criação, status, pesquisa e persistência | Aprovado; 5 áreas QA |
| Regiões | abertura e leitura da região legada | Aprovado; região `TESTE CODEX - UNIDADE INDUSTRIAL NADIR` preservada |
| Setores e Locais | criação, área vinculada, status e persistência | Aprovado; 5 registros QA |
| Mapa Industrial | região, locais, máquinas e detalhe lateral | Parcial; mapa abre e localiza ativos, mas os textos das máquinas têm contraste baixo e o Painel de O.S. não abriu |
| Documentos | criação, detalhe e persistência | Parcial; funcional somente no navegador atual, sem armazenamento privado compartilhado |
| Estrutura de Instalação | presença no menu oficial | Não encontrada no menu da versão publicada |

## Materiais

| Módulo | Interações verificadas | Resultado |
| --- | --- | --- |
| Catálogo de Peças | fornecedores, peças, pesquisa e listagem | Aprovado; 3 fornecedores e 25 peças QA |
| Almoxarifado de Peças | abertura e consulta | Parcial; tela abre, mas não existe almoxarifado cadastrado e não foi encontrada ação visível para cadastrar um |
| Movimentações de Estoque | abertura, histórico e tentativa de nova movimentação | Bloqueado pela ausência de almoxarifado |
| Transferências de Estoque | abertura e consulta | Bloqueado pela ausência de almoxarifado |
| Solicitações de Materiais | criação, listagem e atalho do Dashboard | Aprovado; 6 solicitações QA |
| Fornecedores e Parceiros | criação e persistência | Aprovado; 3 fornecedores QA |
| Ferramentas | criação, retirada, devolução e histórico | Aprovado; 10 ferramentas QA e ciclo completo em `NADIR-QA-FERR-001` |

## Planejamento

| Módulo | Interações verificadas | Resultado |
| --- | --- | --- |
| Recursos e Equipes | criação de recursos, equipe, integrantes, pesquisa e persistência | Aprovado com ressalva; 3 recursos e 1 equipe, dois integrantes persistidos |
| Calendário Operacional | Dia, Semana, Mês e Lista | Aprovado |
| Calendários Produtivos | consulta e gerenciamento de usuários | Parcial; “Gerenciar usuários” abre Configurações na aba errada inicialmente |

## Gestão e administração

| Módulo | Interações verificadas | Resultado |
| --- | --- | --- |
| Indicadores | disponibilidade, backlog, paradas, estoque e detalhe MTTR | Aprovado; cálculos coerentes com os dados QA |
| Relatórios | Ativos, Paradas, Medições, Saúde dos Ativos e exportação CSV | Aprovado; CSV confirmou 21 registros exportados |
| IA GestMan365 | atualização e pergunta sobre O.S. em execução | Aprovado; retornou corretamente as 7 O.S. QA em execução |
| Usuários e Permissões | abertura, consulta e abas administrativas | Aprovado em leitura; nenhum usuário foi alterado |
| Configurações | empresa, usuários, manutenção, O.S., estoque, notificações, aparência, integrações e segurança | Aprovado em leitura |

## Interações não executadas por segurança

- Exclusão ou edição de registros não QA.
- Alteração de contas de Anderson ou Enzo.
- Movimentação física de equipamento no mapa, pois criaria histórico operacional real.
- Desativação de empresa, usuário ou membership.
- Publicação, push, deploy, migration ou alteração remota de Supabase.
- Testes mobile/tablet, adiados por decisão do usuário.
