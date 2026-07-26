# Rollback seguro da remediação local

Este rollback desfaz somente objetos criados por esta entrega. Ele não restaura políticas
públicas inseguras e não reabre caminhos diretos para tabelas legadas.

## Regras

1. Não restaurar `USING (true)` ou `WITH CHECK (true)`.
2. Não recolocar grants públicos para tabelas legadas.
3. Não reintroduzir escrita direta na coluna `senha`.
4. Não tocar no Supabase remoto.
5. Não restaurar credenciais ou valores sensíveis.

## Sequência segura

1. Remover somente as políticas de Storage criadas por `202607220003`, se necessário.
2. Reavaliar grants restritos de `202607220002` sem conceder acesso a `public` ou `anon`.
3. Remover o trigger e a função auxiliar criados por `202607220001` somente depois de
   confirmar que nenhuma escrita de senha textual voltará a ser possível.
4. Manter removidas as políticas permissivas legadas.
5. Validar que o estado final continua em default deny para as superfícies legadas.

## Limitação

Não há arquivo SQL de rollback nesta entrega. A execução de rollback está bloqueada até que
um ambiente isolado permita ensaiar comandos compatíveis com o dump oficial. Se qualquer
reversão exigisse reabrir segurança, o rollback deve ser considerado bloqueado.
