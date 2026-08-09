# Relatório de Bugs e Melhorias — GestMan365

Data: 08/08/2026
Ambiente analisado: site oficial
Observação: esta auditoria não publicou correções. As correções locais já existentes na branch permaneceram sem push.

## Bugs funcionais confirmados

### 1. Estoque sem caminho de criação de almoxarifado

- Evidência: Almoxarifado de Peças abre com zero registros e nenhuma ação visível de cadastro.
- Impacto: Movimentações e Transferências ficam inutilizáveis, apesar de existirem 25 peças.
- Prioridade: Crítica para operação de estoque.
- Correção recomendada: implementar cadastro de almoxarifado com permissões, localizações, vínculo de peças e validação antes de movimentar.

### 2. Painel de O.S. do Mapa Industrial não abre

- Evidência: “Abrir Painel de O.S.” foi acionado; nenhuma nova aba, navegação ou confirmação apareceu.
- Impacto: gestor não consegue projetar o painel operacional separado.
- Prioridade: Alta.
- Correção recomendada: revisar URL/target, bloqueio de popup, rota pública controlada e feedback quando a abertura falhar.

### 3. Localização inconsistente entre Mapa e Identificadores

- Evidência: Mapa mostra os ativos dentro dos locais legados; Identificadores apresenta “Local não informado” para os mesmos ativos.
- Impacto: divergência de cadastro físico e risco em auditoria patrimonial.
- Prioridade: Alta.
- Correção recomendada: definir fonte canônica de `locationId`, normalizar leitura e criar verificação de integridade sem apagar campos legados.

### 4. Integrante de equipe não persistiu

- Evidência: a tentativa de adicionar o mecânico à equipe QA não permaneceu; o detalhe continuou “Sem equipe”.
- Impacto: escala e composição da equipe podem ficar incompletas.
- Prioridade: Alta.
- Correção recomendada: validar evento de seleção, atualização atômica dos vínculos e mensagem de sucesso baseada na leitura persistida.

### 5. Menus de ações cortados no último registro

- Evidência: menu de ações da última linha em Paradas e Recursos é recortado pelo contêiner da tabela no desktop.
- Impacto: ações essenciais ficam inacessíveis.
- Prioridade: Alta.
- Correção recomendada: portal para overlay ou ajuste de `overflow`, posicionamento e detecção de borda inferior.

## Problemas de UX confirmados

### 6. Contraste baixo dos equipamentos no Mapa Industrial

- Texto escuro sobre cartões escuros dificulta leitura de TAG e nome.
- Prioridade: Alta por legibilidade operacional.

### 7. “Gerenciar usuários” abre a aba errada

- Em Calendários Produtivos, o botão abre Configurações em “Empresa e perfil” em vez de “Usuários e acessos”.
- Prioridade: Média.

### 8. Documentos armazenados somente no navegador

- A própria tela informa que não há nuvem privada configurada.
- Impacto: documento não é compartilhado com outros usuários/dispositivos e pode ser perdido com limpeza local.
- Prioridade: Crítica para uso empresarial.

### 9. Ajuda insuficiente

- O modal apenas orienta a usar o menu lateral.
- Prioridade: Média.

### 10. Demo loader ausente do Dashboard atual

- Não foi encontrado “Ambiente de demonstração” ou “Carregar dados de demonstração” na versão oficial.
- Prioridade: Média; afeta QA e onboarding, não a operação diária.

### 11. Identidade de versão e alertas laterais antigos

- O site oficial ainda mostra o painel “Alertas Críticos” e versão antiga no rodapé.
- A branch local possui mudança não publicada para remover o painel e mostrar `V.1.00`.
- Prioridade: Média.

### 12. Latência perceptível

- Login permanece cerca de 15 segundos em validação.
- Fornecedores e peças levaram aproximadamente 3–6 segundos para salvar/renderizar.
- Não houve erro de console correspondente.
- Prioridade: Média; requer telemetria de rede antes de alterar código.

### 13. Estrutura de Instalação não está no menu oficial

- O inventário do menu não contém o módulo esperado entre Setor/Local e Ativo.
- Prioridade: Alta para completar a hierarquia física do CMMS.

## Correções locais preexistentes, ainda não publicadas

Arquivos locais modificados antes da consolidação deste relatório:

- `index.html`
- `404.html`
- `assets/ui/gestman-3d.css`

Escopo observado:

- remoção visual do painel lateral Alertas Críticos;
- atualização do rodapé para `V.1.00`;
- correção responsiva do cabeçalho e rodapé lateral no desktop.

Essas alterações não foram enviadas ao GitHub nem publicadas durante esta auditoria.

## Console

A coleta final de erros e warnings retornou lista vazia. Isso não elimina os bugs funcionais acima, que foram comprovados por comportamento e inspeção visual.
