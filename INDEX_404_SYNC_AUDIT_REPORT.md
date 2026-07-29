# Auditoria de sincronismo entre `index.html` e `404.html`

Data: 2026-07-29
Branch: `design/ui-ux-v1`
Base auditada: `9827c74`

## Resultado executivo

Foi encontrada uma única família de divergências, concentrada no tratamento de conflito de sincronização do estado remoto. A diferença era funcional, antiga e acidental: o `index.html` preservava alterações locais e permitia resolver conflitos; o `404.html` ainda recarregava a versão remota e podia descartar a edição local não sincronizada.

Não foram encontradas diferenças necessárias ao roteamento do fallback. Depois da correção cirúrgica, os dois arquivos ficaram binariamente idênticos.

## Classificação das divergências

| Classificação | Quantidade | Resultado |
|---|---:|---|
| Fallback intencional | 0 | Nenhuma diferença específica do GitHub Pages era necessária. |
| Visual | 0 | O CSS já era equivalente antes da Fase 4. |
| Funcional antiga | 1 família | Corrigida no `404.html`. |
| Duplicada e divergente | 1 família | A persistência remota possuía duas implementações diferentes; foi mantida a versão segura do `index.html`. |
| Possível defeito | 1 | Perda de alterações locais em conflito no fallback. Corrigida. |
| Obsoleta | 1 | Estratégia do fallback que recarregava o servidor automaticamente em `GM_STATE_CONFLICT`. Removida. |

## Divergência funcional comprovada

### Integração afetada

- Integração: persistência do estado da empresa via Supabase.
- Evento: alteração local chama `scheduleSupabaseSync()` e encadeia `gmPersistState()`.
- Listener relacionado: nenhum listener exclusivo; a diferença estava no fluxo chamado pelos listeners já existentes.
- IDs relacionados: `genericModal`, `genericModalBox`, `genericTitle`, `genericBody` e `toast`.
- RPCs relacionadas: `gm_load_tenant_state` e a RPC de gravação já usada por `gmPersistState`.

### Símbolos presentes apenas no `index.html`

- `gmSyncConflict`;
- `gmNormalizeRemoteState`;
- `gmChangedTopLevelKeys`;
- `gmDownloadSyncConflict`;
- `gmShowSyncConflictModal`;
- `gmUseServerSyncConflict`;
- `gmHandleStateConflict`;
- segundo parâmetro `conflictAttempt` de `gmPersistState`.

### Comportamento anterior

`index.html`:

- interrompia novos agendamentos enquanto havia conflito;
- comparava as chaves alteradas local e remotamente;
- fazia merge automático apenas quando não existia sobreposição;
- preservava a cópia local quando havia sobreposição;
- mostrava modal de conflito;
- permitia baixar a cópia local ou escolher explicitamente a versão do servidor;
- diferenciava negação de permissão.

`404.html`:

- marcava o estado como limpo;
- recarregava imediatamente a versão remota;
- mostrava apenas uma mensagem de atualização por outro dispositivo;
- não oferecia cópia local nem escolha ao usuário;
- não diferenciava a mensagem específica de permissão no mesmo ponto.

### Versão correta escolhida

A implementação do `index.html` foi considerada correta porque preserva dados locais, evita sobrescrita silenciosa, mantém o estado de conflito explícito e oferece decisão ao usuário. Somente esse bloco comprovado foi transportado para o `404.html`; nenhum arquivo foi copiado integralmente.

## Validação automática adicionada

Arquivo:

- `scripts/validate-index-404-sync.mjs`

O validador:

- normaliza CRLF/LF para a comparação textual;
- exige equivalência integral entre `index.html` e `404.html`;
- valida sintaxe de todos os blocos JavaScript inline;
- verifica IDs duplicados no HTML estático, excluindo corretamente templates JavaScript ainda não materializados;
- produz SHA-256 normalizado e contagem de blocos.

Comando:

```bash
node scripts/validate-index-404-sync.mjs
```

Resultado final:

- sincronizados: sim;
- hash binário: idêntico;
- IDs duplicados no HTML estático: 0;
- blocos JavaScript inline validados: 7 por arquivo;
- erro de sintaxe: 0.

## Risco residual

O monólito conserva 53 nomes de funções repetidos em blocos legados. Isso não foi criado nesta fase e não foi refatorado porque uma consolidação ampla ultrapassaria o escopo e poderia alterar contratos globais. O novo validador impede nova divergência entre os dois arquivos, mas não substitui uma futura modularização controlada.
