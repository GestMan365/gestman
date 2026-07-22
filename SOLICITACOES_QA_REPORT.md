# Relatório de QA — Solicitações de Manutenção

**Projeto oficial:** `C:\Users\andsa\Desktop\GestMan365-Claude`  
**Data:** 21/07/2026  
**Commit de origem auditado:** `4f8bcc9db0c2c67162adefa8c387ba16b754392c`  
**Ambiente:** modo demo explícito, Chromium, 1 worker  

## 1. Resultado executivo

O módulo de Solicitações, anteriormente uma tela estrutural sem fluxo operacional, recebeu uma implementação local controlada com domínio tipado, máquina de estados, filtros, formulário simples, consulta detalhada, ações governadas por permissão e cobertura E2E profissional.

Nenhum dado remoto foi lido, criado, alterado ou removido nesta entrega. Não houve migração, deploy, publicação ou `git push`.

| Validação | Resultado |
|---|---:|
| Build TypeScript + Vite | Aprovada |
| Descoberta Playwright | 66 testes em 4 arquivos |
| Suíte de Solicitações | 27/27 aprovados |
| Regressão completa | 66/66 aprovados |
| `npm run qa` | Aprovado — build + 66/66 |
| Testes anteriormente existentes | 39/39 preservados |
| Erros de console no fluxo principal | 0 |
| Falhas críticas de rede no fluxo principal | 0 |

## 2. Implementação entregue

- modelo tipado de solicitação, prioridade, tipo e estado;
- serviço de domínio separado da interface;
- seed determinístico e idempotente com 4 registros `QA-AUTO-SOL`;
- armazenamento somente em sessão e segregado por empresa no modo demo;
- numeração sequencial;
- validação de ativo contra a empresa ativa;
- criação com ou sem ativo, exigindo setor quando necessário;
- busca e filtros;
- edição restrita ao estado aberto;
- máquina de estados validada também no serviço;
- rejeição com motivo obrigatório;
- cancelamento lógico;
- preparação de conversão sem criar O.S. artificial;
- interface compacta, responsiva e operável por teclado;
- autorização baseada exclusivamente na matriz já existente.

## 3. Máquina de estados validada

| Transição | Resultado |
|---|---:|
| Aberta → Em análise | Aprovada |
| Aberta → Cancelada | Aprovada |
| Em análise → Aprovada | Aprovada |
| Em análise → Rejeitada com motivo | Aprovada |
| Rejeição sem motivo | Bloqueada corretamente |
| Edição fora de Aberta | Não oferecida pela interface e bloqueada no domínio |
| Preparação fora de Aprovada | Bloqueada no domínio |
| Preparação duplicada | Bloqueada |
| Conversão sem O.S. real | Bloqueada |

Estados rejeitado, cancelado e convertido são terminais.

## 4. Permissões verificadas

| Perfil | Comportamento E2E confirmado |
|---|---|
| Administrador | cria, consulta, edita aberta, analisa, aprova, rejeita, cancela e limpa QA |
| Supervisor | cria, consulta, edita aberta e analisa; não cancela nem limpa QA |
| Planejador | somente leitura, conforme matriz atual |
| Técnico | consulta e cria; não edita, analisa, cancela ou limpa QA |
| Solicitante | consulta apenas registros próprios e cria; não executa triagem |

Não foram acrescentadas permissões irreversíveis nem regras por suposição.

## 5. Cobertura E2E

Foram implementados 27 cenários em `tests/requests/requests.spec.ts`:

- proteção de rota;
- seed e estrutura da listagem;
- estado vazio;
- busca por número e título;
- filtros de status, prioridade e solicitante;
- criação com ativo;
- criação sem ativo e com setor;
- validações de título, descrição e setor;
- preservação de dados diante de validação;
- numeração única e sequencial;
- persistência durante a sessão;
- detalhes e vínculo com ativo;
- edição somente em estado aberto;
- análise e aprovação;
- rejeição com justificativa;
- cancelamento lógico;
- preparação única da conversão;
- ausência de O.S. artificial;
- quatro cenários de perfis;
- limpeza segura do prefixo QA;
- console e rede;
- teclado e foco;
- desktop, tablet e celular sem rolagem horizontal da página.

## 6. Incidentes encontrados e corrigidos

1. Dois seletores da primeira execução da nova suíte estavam imprecisos: seleção por rótulo usando expressão regular e número presente simultaneamente na lista e no diálogo. Os seletores foram tornados determinísticos.
2. Um teste antigo do Dashboard esperava o título `Solicitacoes` sem acento. A navegação foi mantida e a asserção passou a aceitar o título correto `Solicitações`, sem fragilizar os demais módulos.
3. O módulo original não possuía regras de domínio nem ações operacionais. A tela placeholder foi substituída pela implementação descrita neste relatório.

Todas as correções foram revalidadas na suíte completa.

## 7. Segurança e proteção de dados

- o modo demo não chama Supabase para Solicitações;
- os dados existem somente em `sessionStorage`;
- a chave inclui o identificador da empresa;
- a limpeza aceita somente o prefixo `QA-AUTO-SOL`;
- um teste prova que um registro sem prefixo é preservado;
- não foi usado `service_role` no frontend;
- não foram adicionadas chaves, tokens ou credenciais reais;
- `.env`, relatórios temporários, traces, vídeos e screenshots não integram o ZIP.

## 8. Riscos e pendências explícitas

O módulo ainda não está pronto para produção com persistência remota. Antes disso, são necessários:

1. tabela e políticas RLS específicas no Supabase;
2. histórico imutável de transições;
3. comentários, anexos e storage privado;
4. regra de atribuição a equipe/técnico;
5. integração transacional com O.S.;
6. notificações e SLA;
7. testes multiempresa e de concorrência contra ambiente isolado;
8. decisão de produto sobre edição/cancelamento pelo solicitante e aprovação pelo Planejador.

Essas lacunas não foram mascaradas por mocks que aparentassem persistência real.

## 9. Comandos executados

```powershell
npm run build
npx playwright test tests/requests/requests.spec.ts --list --project=chromium
npx playwright test tests/requests/requests.spec.ts --project=chromium
npx playwright test --list --project=chromium
npx playwright test --project=chromium
npm run qa
```

## 10. Conclusão

A entrega está aprovada para demonstração local e continuidade do desenvolvimento. A suíte total passou com 66 de 66 testes, preservando integralmente os 39 cenários anteriores. A próxima etapa recomendada é desenhar a persistência Supabase e RLS em ambiente isolado antes de habilitar dados reais.
