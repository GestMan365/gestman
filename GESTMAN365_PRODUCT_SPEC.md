# GestMan365 — Especificacao do Produto

## Visao do produto

GestMan365 e uma plataforma CMMS/EAM multiempresa para organizar ativos, manutencao, planejamento, execucao de servicos e indicadores industriais. O produto deve reduzir paradas, tornar o historico rastreavel e oferecer uma experiencia consistente em escritorio e campo.

## Perfis de usuario

- **Administrador:** configura empresa, usuarios, perfis, unidades e acesso aos modulos.
- **Supervisor:** acompanha equipe, aprova e prioriza atividades e consulta indicadores.
- **Planejador:** planeja ordens, recursos, materiais, cronogramas e preventivas.
- **Tecnico:** consulta atividades atribuidas, executa checklists, registra tempos, materiais, evidencias e conclusao.
- **Solicitante:** abre e acompanha solicitacoes autorizadas, sem acesso administrativo.

Permissoes devem ser aplicadas por modulo e operacao. Ocultar um botao nao substitui validacao no backend/RLS.

## Modulos

- Dashboard e indicadores operacionais;
- Ativos e equipamentos;
- Solicitacoes de manutencao;
- Ordens de Servico;
- PCM, planos e manutencao preventiva;
- Materiais, estoque e movimentacoes;
- Relatorios e analises;
- Administracao de usuarios, perfis, empresas e configuracoes.

## Regras de negocio essenciais

- Dados de empresas diferentes nunca podem se misturar.
- Usuario inativo nao autentica nem aparece para nova atribuicao.
- Ativos e Ordens de Servico devem manter historico rastreavel.
- Uma O.S. deve respeitar equipamento, executante, prioridade, status e permissoes do perfil.
- Alteracoes criticas devem registrar autor, data e resultado.
- Estoque nao pode produzir saldo inconsistente.
- Indicadores devem usar dados reais do periodo e da empresa selecionada.
- Dados demo so existem em ambiente explicitamente configurado para demonstracao.

## Fluxos criticos

### Autenticacao

O usuario informa credenciais, o sistema valida o ambiente e a identidade, carrega perfil/empresa e abre o dashboard. Credenciais invalidas mantem o formulario aberto com mensagem clara. Logout encerra a sessao e rotas privadas redirecionam ao login.

### Ativo

Cadastro, pesquisa, edicao autorizada, visualizacao de criticidade e consulta do historico de manutencao.

### Ordem de Servico

Criacao, atribuicao de tecnico, planejamento, inicio, apontamentos, materiais, observacoes, mudanca de status, conclusao e historico.

### Preventiva

Definicao do plano, periodicidade e recursos; geracao/associacao de O.S.; acompanhamento de vencimentos e atrasos.

### Administracao

Criacao de usuarios, definicao de perfil, ativacao/inativacao e garantia de isolamento por empresa.

## Experiencia por dispositivo

### Desktop

Visao completa, navegacao lateral, tabelas, filtros e paineis de planejamento. Deve funcionar em 1366x768 ou superior sem perder a acao principal.

### Tablet

Layout adaptativo, navegacao compacta, tabelas com colunas prioritarias e areas clicaveis adequadas ao toque.

### Celular

Fluxos de campo simplificados: atividades atribuidas, detalhes da O.S., checklist, apontamento, fotos/evidencias e conclusao. Acoes principais devem permanecer acessiveis sem rolagem horizontal da pagina.

## Indicadores

- MTTR;
- MTBF;
- disponibilidade;
- backlog;
- O.S. abertas, em execucao, atrasadas e concluidas;
- cumprimento do plano preventivo;
- paradas e tempo indisponivel;
- consumo e criticidade de materiais.

Todos os indicadores devem declarar periodo, escopo e ausencia de dados. Nao devem usar valores fixos em producao.

## Requisitos nao funcionais

- seguranca por autenticacao, autorizacao e RLS;
- disponibilidade e recuperacao previsivel de falhas;
- desempenho adequado em redes moveis;
- acessibilidade por rotulos, foco, contraste e navegacao por teclado;
- responsividade em desktop, tablet e celular;
- observabilidade sem dados sensiveis;
- testes automatizados dos fluxos de maior risco;
- compatibilidade com navegadores modernos;
- evolucao de banco por migrations e implantacao repetivel.
