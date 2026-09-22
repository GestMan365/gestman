# Confiabilidade operacional — implementação incremental

## Escopo autorizado

Melhorar atualização, concorrência, alertas, patrimônio/preço de referência,
organização do frontend e gates de publicação. Não confundir validação local
com comprovação de persistência ou isolamento em produção.

## Lote 1 — frontend

- Adiar refresh automático durante formulário, modal, foco em campo ou aba oculta.
- Não redesenhar documento remoto com versão e timestamp inalterados.
- Revalidar conta, versão e edição pendente após esperas assíncronas.
- Atualizar somente timers do dashboard/painel no intervalo periódico.
- Preservar filtros fora de formulários e scroll de contêineres estáveis.
- Exibir última verificação, offline e falha de leitura; não afirmar salvamento.
- Permitir pausar animações mantendo cores e textos.
- Gate local reproduzível: node scripts/release-check.mjs.

Limitações: blocos reconstruídos sem ID estável não têm posição recuperável.
Atualizações com versão nova ainda usam renderização compartilhada; extração
por módulo será incremental. Adiar não salva rascunhos nem habilita modo offline.

## Lotes seguintes — não concluídos

1. Concorrência: validar contrato de versão, replay e unicidade
   empresa/plano/ocorrência em ambiente de teste. Dois navegadores/dispositivos,
   resposta perdida, rollback, OS e estoque. Trava de JavaScript não basta.
2. Patrimônio: contrato de persistência, validação, pesquisa e detalhe/histórico.
3. Peças: significado confirmado pelo operador: preço de referência cadastral,
   independente do custo médio de movimentações. Implementação frontend concluída;
   homologação de gravação real permanece separada, sem dados de produção nos testes.
4. Extrair atualização/apresentação e legenda de estados para módulos com testes.
5. Publicação: gate local obrigatório, revisão de diff, SHA no remoto/site,
   smoke autenticado somente leitura e decisão explícita em caso de bloqueio.

## Fronteira remota

Nenhuma migration, SQL, alteração de dados ou configuração de Supabase faz
parte do lote 1. Antes de mudanças estruturais: apresentar contrato e migration
exata; testar em ambiente isolado e obter autorização de aplicação.

O script release-check não publica e não certifica banco/Auth/RLS.
Testes remotos/official não fazem parte dele.

## Preço de referência de peças

- Campo editável em Mais detalhes, com vírgula ou ponto e até duas casas decimais.
- Usa o atributo existente spareParts.referenceValue no documento de estado.
- Exibido também no detalhe da peça, separado do custo unitário calculado.
- Nenhuma mudança em spareAverageCost, stockValuationRows ou materialFinancialInfo.
- Falha de gravação mantém formulário/ID e informa ausência de confirmação;
  não promete persistência local durável nem faz rollback de resposta ambígua.
- Testes locais usam dados sintéticos e gravação simulada. Reabertura normalizada,
  falha, nova tentativa, entrada inválida e independência de custo são cobertos.
- Nenhuma migration, SQL ou escrita remota de homologação foi executada.
- Patrimônio continua desabilitado e não foi implementado neste lote.
