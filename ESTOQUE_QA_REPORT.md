# Relatório QA — Estoque, Materiais e Ferramentas

## Identificação

- Data: 26/07/2026
- Ambiente: demo local
- Navegador: Chromium / Playwright 1.61.1
- Empresa de teste: GestMan365 Demo
- Prefixos: `QA-AUTO-EST` e `QA-AUTO-FERR`
- Branch validada: `feature/modulo-estoque`
- Commit de implementação: `e4d04d3`

## Resultado executivo

O módulo foi implementado com domínio próprio, interface responsiva, permissões, histórico e integração com O.S./PCM. A primeira execução identificou quatro falhas no preparo de sessões de perfis de teste; a causa foi a proteção intencional do modo demo, que aceita apenas a identidade demo conhecida. O preparo foi corrigido preservando a identidade e variando apenas o perfil.

A validação final foi concluída sem erros funcionais: a verificação TypeScript, o build Vite, os 56 testes exclusivos do Estoque e os 182 testes da regressão completa foram aprovados.

| Verificação | Resultado |
| --- | --- |
| TypeScript | Aprovado — 0 erros |
| Build Vite | Aprovado — 127 módulos transformados |
| Suíte exclusiva de Estoque | 56 aprovados, 0 reprovados, 0 ignorados |
| Regressão completa | 182 aprovados, 0 reprovados, 0 ignorados |
| Erros funcionais remanescentes | Nenhum |
| Persistência Supabase | Ainda não implementada |
| Supabase remoto | Não acessado |
| Migrações | Não executadas |
| Deploy | Não realizado |

## Correções aplicadas durante QA

- sessão dos perfis de teste alinhada à regra de autenticação demo;
- consumo passou a respeitar o saldo disponível somado apenas à reserva da mesma O.S.;
- custo acumulado da O.S. recalculado após consumo ou devolução;
- ferramenta vinculada à O.S. passou a registrar empréstimo e devolução no histórico da ordem;
- atraso de devolução passou a ter alerta textual, sem depender apenas de cor;
- tokens de superfície, borda e texto foram definidos para os componentes legados e novos.

## Riscos e próximos passos

- a persistência desta entrega é deliberadamente demo e baseada em sessão; a persistência Supabase ainda não foi implementada;
- a implementação Supabase exigirá schema, RLS, transações e funções idempotentes revisadas em etapa própria;
- recomenda-se paginação e leitura incremental quando o histórico real tiver grande volume;
- recomenda-se indexar empresa, item, O.S., data e chave de idempotência no backend futuro;
- o bundle atual mantém o aviso não bloqueante de chunk acima de 500 kB.
