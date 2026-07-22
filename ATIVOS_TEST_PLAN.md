# GestMan365 — Plano de Testes do Módulo Ativos

## Escopo e estratégia

O módulo Ativos é validado no projeto React oficial, em modo demo, sem chamadas ao Supabase remoto. Os dados determinísticos usam o prefixo `QA-AUTO-ATIVO`, são isolados pela empresa ativa e persistem somente durante a sessão do navegador. A limpeza remove exclusivamente registros com esse prefixo.

No modo Supabase, a implementação local falha de forma explícita e segura até que o esquema, RLS e contratos remotos sejam aprovados. Nenhuma tabela, migração ou consulta remota foi presumida.

## Smoke e leitura

| ID | Objetivo | Pré-condição | Dados | Passos | Resultado esperado | Prioridade | Tipo | Risco | Automação |
|---|---|---|---|---|---|---|---|---|---|
| AT-001 | Acessar Ativos autenticado | Administrador válido | Sessão demo | Login; abrir Ativos | Página e lista visíveis | P0 | Smoke/E2E | Módulo indisponível | Sim |
| AT-002 | Proteger rota | Sem sessão | Nenhum | Abrir `/ativos` | Redirecionar ao login | P0 | Segurança/E2E | Exposição indevida | Sim |
| AT-003 | Validar estrutura | Autenticado | Seeds QA | Inspecionar título, filtros e lista | Regiões acessíveis e nomeadas | P0 | UI/E2E | Estrutura quebrada | Sim |
| AT-004 | Listar seeds determinísticos | Autenticado | MOT-001, BOM-001, CMP-001 | Abrir lista | Três ativos, sem duplicidade | P0 | Leitura/E2E | Massa instável | Sim |
| AT-005 | Ver detalhes | Autenticado | BOM-001 | Abrir detalhes | TAG, local, série e atributos corretos | P1 | Leitura/E2E | Informação incompleta | Sim |
| AT-006 | Não renderizar valores inválidos | Autenticado | Seeds QA | Inspecionar página | Sem `undefined`, `null`, `NaN`, `Infinity` | P0 | Integridade/E2E | Falha de serialização | Sim |

## Criação, edição e validação

| ID | Objetivo | Pré-condição | Dados | Passos | Resultado esperado | Prioridade | Tipo | Risco | Automação |
|---|---|---|---|---|---|---|---|---|---|
| AT-007 | Criar ativo válido | Administrador | ENV-002 | Preencher obrigatórios; salvar | Registro criado e feedback exibido | P0 | Criação/E2E | Cadastro indisponível | Sim |
| AT-008 | Exigir TAG | Formulário aberto | TAG vazia | Salvar | Navegador bloqueia e mantém formulário | P0 | Validação/E2E | Ativo sem identificação | Sim |
| AT-009 | Exigir nome | Formulário aberto | Nome vazio | Salvar | Navegador bloqueia e mantém formulário | P0 | Validação/E2E | Cadastro ilegível | Sim |
| AT-010 | Rejeitar TAG duplicada | MOT-001 existente | Mesmo TAG em caixa diferente | Salvar novo | Mensagem junto ao formulário; dados preservados | P0 | Regra/E2E | Ambiguidade patrimonial | Sim |
| AT-011 | Normalizar TAG | Administrador | TAG minúscula com espaços | Salvar | TAG armazenada em maiúsculas e sem bordas | P1 | Regra/Unitário futuro | Duplicidade lógica | Parcial |
| AT-012 | Limitar textos | Formulário aberto | Valores além dos limites | Digitar | Limites HTML impedem excesso | P1 | Validação/E2E | Dados descontrolados | Parcial |
| AT-013 | Editar nome | Permissão `ativos:edit` | MOT-001 | Abrir; editar; salvar | Nome atualizado | P0 | Edição/E2E | Dados obsoletos | Sim |
| AT-014 | Editar criticidade | Permissão `ativos:edit` | MOT-001 | Alterar para Crítica | Criticidade persistida | P0 | Edição/E2E | Priorização incorreta | Sim |
| AT-015 | Editar status | Permissão `ativos:edit` | MOT-001 | Alterar para manutenção | Status persistido | P0 | Edição/E2E | Estado operacional errado | Sim |
| AT-016 | Persistir edição no reload | Ativo editado | MOT-001 | Recarregar página | Alterações permanecem na sessão demo | P0 | Regressão/E2E | Perda de alterações | Sim |
| AT-017 | Inativar sem apagar | Administrador/Supervisor | CMP-001 | Inativar | Registro permanece com status Inativo | P0 | Regra/E2E | Perda de histórico futuro | Sim |
| AT-018 | Impedir exclusão física | Autenticado | Seed QA | Abrir detalhes | Não existe ação de exclusão física | P0 | Segurança/E2E | Exclusão acidental | Sim |

## Busca, filtros e estado vazio

| ID | Objetivo | Pré-condição | Dados | Passos | Resultado esperado | Prioridade | Tipo | Risco | Automação |
|---|---|---|---|---|---|---|---|---|---|
| AT-019 | Buscar por TAG | Lista carregada | `BOM-001` | Pesquisar | Somente a bomba correspondente | P0 | Busca/E2E | Ativo não localizado | Sim |
| AT-020 | Buscar por nome | Lista carregada | `Compressor de Ar` | Pesquisar | Somente compressor correspondente | P0 | Busca/E2E | Busca insuficiente | Sim |
| AT-021 | Buscar por categoria/local | Lista carregada | Categoria/local seed | Pesquisar | Registros coerentes | P1 | Busca/E2E | Resultado incompleto | Parcial |
| AT-022 | Filtrar status | Lista carregada | Em manutenção | Selecionar filtro | Somente BOM-001 | P0 | Filtro/E2E | Estado operacional oculto | Sim |
| AT-023 | Filtrar criticidade | Lista carregada | Alta | Selecionar filtro | Somente MOT-001 | P0 | Filtro/E2E | Priorização incorreta | Sim |
| AT-024 | Filtrar setor | Lista carregada | Utilidades | Selecionar filtro | Somente CMP-001 | P0 | Filtro/E2E | Localização difícil | Sim |
| AT-025 | Limpar filtros | Filtros ativos | Seeds QA | Clicar limpar | Todos os seeds retornam | P1 | Filtro/E2E | Usuário preso em filtro | Sim |
| AT-026 | Estado vazio | Lista carregada | Busca inexistente | Pesquisar | Mensagem vazia clara e contagem zero | P0 | Estado vazio/E2E | Tela aparentemente quebrada | Sim |

## Permissões, segurança e isolamento

| ID | Objetivo | Pré-condição | Dados | Passos | Resultado esperado | Prioridade | Tipo | Risco | Automação |
|---|---|---|---|---|---|---|---|---|---|
| AT-027 | Administrador gerencia | Perfil Administrador | Seeds QA | Abrir módulo | Criar, editar, inativar e limpar QA | P0 | Permissão | Administração bloqueada | Sim |
| AT-028 | Supervisor cria/edita | Perfil Supervisor | Seeds QA | Abrir módulo/detalhes | Criar e editar; sem limpeza QA | P0 | Permissão/E2E | Permissão excessiva | Sim |
| AT-029 | Planejador consulta | Perfil Planejador | Seeds QA | Abrir módulo | Consulta sem criar/editar | P0 | Permissão | Alteração indevida | Manual/futuro |
| AT-030 | Técnico consulta | Perfil Técnico | Seeds QA | Abrir módulo/detalhes | Consulta sem criar, editar, inativar ou limpar | P0 | Permissão/E2E | Escalada de privilégio | Sim |
| AT-031 | Solicitante consulta | Perfil Solicitante | Seeds QA | Abrir módulo | Consulta sem mutações | P0 | Permissão | Escalada de privilégio | Manual/futuro |
| AT-032 | Isolar por empresa | Duas empresas | Seeds separados | Alternar empresa | Nenhum ativo cruza tenant | P0 | Segurança/Integração | Vazamento multiempresa | Futuro com contrato tenant |
| AT-033 | Limpar somente QA | Administrador | Seeds + `REAL-DEMO-001` | Confirmar limpeza | QA removidos; ativo sem prefixo preservado | P0 | Segurança/E2E | Exclusão de dado legítimo | Sim |
| AT-034 | Não chamar Supabase em demo | Modo demo | Fluxo principal | Monitorar rede | Nenhuma chamada remota | P0 | Segurança/E2E | Escrita em produção | Sim |
| AT-035 | Falha segura em Supabase não configurado | Modo Supabase local | Sem contrato de ativos | Abrir módulo | Erro claro; nenhuma mutação | P0 | Erro/Integração | Operação silenciosa | Futuro em ambiente isolado |

## Responsividade, acessibilidade e resiliência

| ID | Objetivo | Pré-condição | Dados | Passos | Resultado esperado | Prioridade | Tipo | Risco | Automação |
|---|---|---|---|---|---|---|---|---|---|
| AT-036 | Desktop | 1920x1080 | Seeds QA | Abrir lista/formulário | Conteúdo legível e operável | P1 | Responsivo/E2E | Layout quebrado | Sim |
| AT-037 | Tablet | 768x1024 | Seeds QA | Abrir lista/formulário | Cards de linhas e modal utilizáveis | P1 | Responsivo/E2E | Ação inacessível | Sim |
| AT-038 | Celular | 390x844 | Seeds QA | Abrir lista/formulário | Sem dependência de tabela horizontal | P0 | Responsivo/E2E | Técnico bloqueado em campo | Sim |
| AT-039 | Navegação por teclado | Autenticado | Botão Novo ativo | Focar; Enter | Formulário abre e foco vai à TAG | P1 | Acessibilidade/E2E | Dependência de mouse | Sim |
| AT-040 | Sem erros técnicos | Modo demo | Fluxo principal | Monitorar console/rede | Zero exceções e falhas críticas | P0 | Regressão/E2E | Regressão silenciosa | Sim |
| AT-041 | Loading | Empresa ativa | Carregamento inicial | Abrir módulo | Loading termina e lista aparece | P1 | Estado/E2E | Travamento | Sim |
| AT-042 | Recuperar armazenamento demo inválido | Sessão corrompida | JSON inválido | Abrir módulo | Seeds restaurados sem tela branca | P1 | Resiliência | Falha de inicialização | Futuro |

## Modelo de domínio recomendado

O tipo local inclui `id`, `empresaId`, referências opcionais de planta/setor/local, TAG, nome, descrição, categoria, fabricante, modelo, número de série, ano de fabricação, instalação, status, criticidade, responsável, ativo pai, centro de custo, observações, auditoria temporal e indicador ativo/inativo.

Antes de uma implementação Supabase, ainda precisam ser definidos e aprovados: esquema real, chaves estrangeiras, índice único de TAG por empresa, política de inativação, auditoria, anexos, fotos, documentos, QR Code, hierarquia, responsáveis e políticas RLS.
