# Plano de Testes — Solicitações de Manutenção

## 1. Objetivo e escopo

Este plano cobre o módulo `Solicitações` do GestMan365 em modo demonstrativo controlado. O objetivo é validar o registro simples de uma necessidade de manutenção, sua triagem, a máquina de estados, a segregação por perfil e a preparação segura para uma futura integração com Ordens de Serviço.

O escopo não altera o Supabase remoto, não executa migrações e não cria O.S. artificial. Os dados E2E existem somente em `sessionStorage`, por empresa, e usam o prefixo `QA-AUTO-SOL`.

## 2. Arquitetura auditada

| Camada | Responsabilidade |
|---|---|
| `src/types/requests.ts` | Contratos, estados, prioridades, tipos e rótulos |
| `src/services/requestService.ts` | Regras de domínio, validação, transições, numeração e dados demo |
| `src/pages/RequestsPage.tsx` | Orquestração, filtros, permissões e feedback |
| `src/components/requests/RequestFormDialog.tsx` | Abertura e edição simplificada |
| `src/components/requests/RequestDetailsDialog.tsx` | Consulta, triagem e ações de estado |
| `tests/requests/requests.spec.ts` | Cobertura E2E no Chromium |

## 3. Modelo de domínio

Uma solicitação contém, no mínimo:

- identificador interno e número único;
- empresa e planta;
- título e descrição;
- solicitante;
- tipo e prioridade;
- ativo opcional;
- setor obrigatório quando o ativo não é conhecido;
- localização opcional;
- estado atual e datas de auditoria operacional;
- motivo obrigatório para rejeição;
- referência de O.S. somente quando a integração real criar a ordem.

Regras principais:

1. O título deve possuir ao menos 5 caracteres.
2. A descrição deve possuir ao menos 10 caracteres.
3. Sem ativo, o setor é obrigatório.
4. O ativo informado deve pertencer à empresa ativa.
5. O número é sequencial e não pode ser reutilizado na sessão.
6. Somente solicitações abertas podem ter seus dados principais editados.
7. Cancelamento é lógico; o registro não é apagado.
8. Rejeição exige motivo.
9. Preparar conversão não cria uma O.S. nem muda o estado para convertida.
10. A conversão real exige um identificador de O.S. fornecido pelo módulo responsável.

## 4. Máquina de estados

Estados:

- `ABERTA`
- `EM_ANALISE`
- `APROVADA`
- `REJEITADA`
- `CONVERTIDA_EM_OS`
- `CANCELADA`

Transições permitidas:

| Origem | Destino | Condição |
|---|---|---|
| ABERTA | EM_ANALISE | usuário com permissão de aprovação |
| ABERTA | CANCELADA | usuário com permissão de exclusão lógica |
| EM_ANALISE | APROVADA | usuário com permissão de aprovação |
| EM_ANALISE | REJEITADA | permissão de aprovação e motivo informado |
| APROVADA | CONVERTIDA_EM_OS | O.S. real criada e identificador informado |

Estados `REJEITADA`, `CONVERTIDA_EM_OS` e `CANCELADA` são terminais. Toda transição não listada é inválida e deve ser rejeitada pela camada de domínio.

## 5. Dados determinísticos

O seed demo é idempotente por sessão e empresa:

| Número | Estado | Prioridade | Vínculo |
|---|---|---|---|
| QA-AUTO-SOL-001 | Aberta | Alta | Motor elétrico QA |
| QA-AUTO-SOL-002 | Em análise | Média | Bomba centrífuga QA |
| QA-AUTO-SOL-003 | Aprovada | Crítica | Compressor QA |
| QA-AUTO-SOL-004 | Aberta | Baixa | Setor, sem ativo identificado |

A limpeza remove exclusivamente números iniciados por `QA-AUTO-SOL`. Registros sem esse prefixo são preservados.

## 6. Matriz de permissões vigente

O módulo preserva a matriz já existente no projeto:

| Perfil | Consultar | Criar | Editar aberta | Analisar/aprovar | Cancelar | Limpar QA |
|---|---:|---:|---:|---:|---:|---:|
| Administrador | Sim | Sim | Sim | Sim | Sim | Sim |
| Supervisor | Sim | Sim | Sim | Sim | Não | Não |
| Planejador | Sim | Não | Não | Não | Não | Não |
| Técnico | Sim | Sim | Não | Não | Não | Não |
| Solicitante | Somente próprias | Sim | Não | Não | Não | Não |

Observação: permitir edição ou cancelamento pelo próprio solicitante, atribuição para equipe/técnico e regras por setor exigem uma decisão futura de negócio. Elas não foram inventadas nesta entrega.

## 7. Cenários E2E automatizados

| Grupo | Cenários |
|---|---|
| Segurança | proteção de rota sem autenticação |
| Estrutura | listagem determinística, estados válidos e ausência de tokens inválidos |
| Consulta | busca por número e título, estado vazio e filtros por status, prioridade e solicitante |
| Criação | com ativo, sem ativo com setor, número sequencial e persistência na sessão |
| Validação | título, descrição e setor obrigatórios; preservação dos valores preenchidos |
| Detalhes | solicitante, ativo, setor, prioridade, estado e descrição |
| Edição | apenas em estado aberto, mantendo número e persistência |
| Fluxo | aberta → em análise → aprovada |
| Rejeição | motivo obrigatório e estado terminal |
| Cancelamento | cancelamento lógico sem exclusão física |
| Conversão | preparação única, manutenção do estado aprovada e ausência de O.S. artificial |
| Perfis | Solicitante, Técnico, Supervisor e Planejador conforme matriz vigente |
| Limpeza | remoção exclusiva de registros QA e preservação de registro não QA |
| Robustez | ausência de erro de console e falha crítica de rede |
| Acessibilidade | abertura por teclado e foco inicial no título |
| Responsividade | desktop 1920×1080, tablet 768×1024 e celular 390×844 |

Total desta suíte: 27 testes E2E.

## 8. Itens auditados ainda não implementados

Os itens abaixo não existiam no módulo anterior e dependem de backend ou decisão de produto. Eles permanecem registrados como lacunas, sem simulação enganosa:

- persistência Supabase e RLS específica para solicitações;
- comentários e histórico imutável de eventos;
- anexos e armazenamento privado;
- atribuição a equipe ou técnico;
- notificações;
- SLA e escalonamento;
- conversão transacional para O.S.;
- isolamento multiempresa validado contra banco remoto;
- permissões condicionadas a planta, setor ou vínculo operacional.

## 9. Critérios de aceite

- build TypeScript/Vite aprovada;
- 27/27 testes de Solicitações aprovados no Chromium;
- testes preexistentes preservados;
- suíte completa e comando `npm run qa` aprovados;
- nenhuma chamada ao Supabase no modo demo;
- nenhuma credencial ou segredo nos artefatos versionados;
- árvore Git limpa após o commit;
- ZIP seguro sem `.env`, dependências ou artefatos temporários.
