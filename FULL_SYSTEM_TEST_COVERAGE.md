# Cobertura de Testes Funcionais — GestMan365

Data: 08/08/2026
Ambiente: produção pública da aplicação, empresa Nadir
Modalidade: teste manual assistido por navegador, exclusivamente em desktop.

## Estratégia

1. Autenticar na empresa Nadir com credencial de teste fornecida pelo proprietário.
2. Criar registros claramente identificados por `NADIR-QA-`.
3. Exercitar fluxos principais, filtros, consultas e persistência.
4. Recarregar a aplicação no mesmo perfil e confirmar registros.
5. Preservar todos os dados QA para conferência manual.
6. Coletar erros e warnings do console ao final.

## Cobertura funcional

| Área | Cobertura | Situação |
| --- | ---: | --- |
| Autenticação e sessão | login, sessão preservada após recarregar | Aprovada |
| Dashboard | indicadores, cards e 6 ações rápidas | Aprovada |
| Manutenção | O.S., execução, planos, checklists, medições, pendências, paradas e diário | Aprovada |
| Ativos | ativos, identificadores, áreas, regiões, setores/locais e mapa | Aprovada com ressalvas no mapa |
| Materiais | catálogo, fornecedores, solicitações e ferramentas | Aprovada |
| Estoque físico | almoxarifados, movimentações e transferências | Bloqueada por ausência de cadastro de almoxarifado |
| Planejamento | recursos/equipes e calendários | Aprovada com duas ressalvas de UX/persistência de integrante |
| Gestão | indicadores, relatórios, CSV e IA | Aprovada |
| Administração | usuários e nove abas de configuração | Aprovada em leitura |
| Persistência | recarga completa no mesmo perfil | Aprovada para registros principais |
| Console | erros e warnings ao final | Zero registros retornados |
| Mobile/tablet | não executado | Fora do escopo por decisão do usuário |

## Volumes verificados

- 5 áreas operacionais.
- 5 setores/locais.
- 20 ativos QA.
- 35 O.S.
- 10 planos preventivos.
- 8 checklists.
- 6 pontos de medição e 7 leituras.
- 8 ações pendentes.
- 1 parada ativa.
- 6 lançamentos no diário.
- 3 fornecedores.
- 25 peças.
- 6 solicitações de materiais.
- 10 ferramentas.
- 3 recursos e 1 equipe.
- 1 identificador.
- 1 documento.

## Persistência comprovada após recarga

| Registro | Resultado |
| --- | --- |
| `NADIR-QA-ATV-001` | encontrado pela busca global |
| `NADIR-QA-OS-001` | encontrado pela busca global |
| `NADIR-QA-PEC-001` | encontrado pela busca global |
| `NADIR-QA-REC-001` a `003` | presentes em Recursos |
| `NADIR-QA-EQP-001` | presente em Equipes |
| `NADIR-QA-FERR-001` e `010` | presentes em Ferramentas |
| `NADIR-QA-ID-001` | presente em Identificadores |
| `NADIR-QA-DOC-001` | presente em Documentos |

## Lacunas de cobertura

- Sem teste mobile/tablet.
- Sem teste de carga, concorrência ou múltiplas sessões simultâneas.
- Sem inspeção direta do banco, RLS, RPCs ou Storage nesta execução.
- Sem alteração destrutiva de usuários, empresa ou registros não QA.
- Sem movimentação de máquina no mapa.
- Sem fluxo completo de estoque por inexistência de almoxarifado.
- Sem teste automatizado de rede; a conclusão de console limpo refere-se à coleta de erros e warnings do navegador.

## Resultado geral

O núcleo de CMMS está operacional para cadastros e acompanhamento de manutenção. Os maiores bloqueios funcionais estão no estoque físico, na ausência do módulo publicado de Estrutura de Instalação, no armazenamento apenas local de Documentos e em inconsistências de localização entre Mapa e Identificadores.
