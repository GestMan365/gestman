# GestMan365 — Matriz de Acesso Frontend x Supabase

Aplicação auditada: monólito `index.html`/`404.html`. A pasta React permanece fora deste escopo.

| Módulo | Operação | Tabela/RPC/endpoint | Tipo | Perfil esperado | Proteção frontend | Proteção backend confirmada | Risco/observação |
|---|---|---|---|---|---|---|---|
| Login | autenticar/renovar/sair | `auth/v1/token`, `auth/v1/logout` | escrita de sessão | qualquer usuário ativo | domínio, usuário e senha | Supabase Auth + contexto empresarial | Sessão em `sessionStorage`; não persiste após fechar a aba |
| Contexto | obter empresa e perfil | `gm_current_context` | leitura | authenticated | exige sessão | SECURITY DEFINER; associação por `auth.uid()` | Médio: função tem acesso a `auth` e deve manter grants mínimos |
| Dashboard/módulos | carregar operação | `gm_load_tenant_state` | leitura | membro ativo | sessão/contexto | `gm_is_company_member` | Grant PUBLIC é mais amplo que o necessário, embora a condição negue não membros |
| Todos os módulos | salvar operação | `gm_save_tenant_state` | escrita | membro com `operate/manage` | matriz de permissões da UI | versão, membro, módulo e nível validados no RPC | Alto impacto: estado empresarial completo em um JSONB |
| Preferências | carregar/salvar preferências | `gm_user_preferences` | leitura/escrita | próprio usuário | escopo usuário/empresa | policy ALL com `auth.uid()` e associação | Baixo |
| Perfil | atualizar dados próprios | `gm_profiles` | escrita | próprio usuário | tela de perfil | policy UPDATE self | Confirmado |
| Empresa | registrar primeiro contexto | `gm_bootstrap_company` | escrita | fluxo inicial | formulário | remoto concede somente service_role | Divergência: chamada direta do frontend não possui grant authenticated |
| Sessão | registrar acesso | `gm_touch_company_access` | escrita | membro ativo | sessão | SECURITY DEFINER; definição precisa permanecer restritiva | Médio; EXECUTE remoto inclui PUBLIC |
| Usuários | listar/criar/alterar/desativar/excluir | Edge `manage-company-user` | leitura/escrita | administrador empresarial | checagem por perfil | Edge valida JWT, contexto e chama RPC interna por service_role | Alto impacto; teste multiempresa obrigatório |
| Solicitação pública | enviar cadastro | Edge `submit-company-request` | escrita | público | validação, honeypot | Edge + rate limit + RPC service_role | Confirmado nominalmente; tabela de rate limit não está no Git |
| Plataforma | listar solicitações | `company_requests` | leitura | platform owner/admin | rota e papel | policy `gm_is_platform_admin()` | Confirmado |
| Plataforma | revisar solicitação | `gm_review_company_request` | escrita | platform owner/admin | botão/rota | SECURITY DEFINER e papel da plataforma | EXECUTE inclui PUBLIC; depende integralmente da validação interna |
| Plataforma | converter solicitação | Edge `convert-company-request` | escrita | platform owner/admin | modal de aprovação | Edge valida usuário e chama RPC interna por service_role | Confirmado nominalmente |
| Plataforma | listar empresas/planos/unidades/membros | quatro tabelas `gm_*` | leitura | platform owner/admin | rota protegida | policies de plataforma/empresa | Confirmado |
| Plataforma | suspender/reativar/arquivar/limites | RPC `gm_manage_company` ou Edge `manage-company-access` | escrita | platform owner/admin | tela administrativa | validação server-side | Confirmado nominalmente |
| Plataforma | excluir empresa/resetar acesso | Edge `manage-company-access` | escrita destrutiva | proprietário da plataforma | senha administrativa e confirmação | Edge + secret + RPC interna | Crítico; requer testes destrutivos apenas em homologação |
| O.S. legada | número da O.S. | `proxima_ordem_servico_numero` | leitura/efeito em sequence | usuário operacional | sessão | SECURITY DEFINER, EXECUTE PUBLIC | Sequence gera número; grant deve ser reduzido |
| CMMS legado | CRUD direto | tabelas de ativos, O.S., peças e demais | leitura/escrita | perfis variados | verificações JavaScript | policies legadas ou RLS sem policy | Crítico nas tabelas com policies `true`; parte do código é posteriormente sobrescrita |
| Anexos | ler arquivo selecionado | Data URL no estado JSONB | escrita no estado | executor | validação de tipo/tamanho | `gm_save_tenant_state` | Bucket existe, mas não há chamada `storage/v1` confirmada no frontend |
| Storage futuro | arquivos privados | `gestman-attachments` | leitura/escrita | membro por módulo | não integrado | 4 policies por empresa/módulo | Configuração existe; integração incompleta |

## Observações

- A anon/publishable key no navegador é esperada em Supabase; não é segredo. A segurança depende de RLS e das Edge Functions.
- Há implementações antigas de localStorage e REST direto no mesmo HTML. As implementações finais substituem parte delas em tempo de execução, mas a duplicação dificulta auditoria.
- Verificações visuais e ocultação de botões não substituem autorização no banco.
- Operações de plataforma e usuários estão corretamente encaminhadas para Edge Functions, porém precisam de testes negativos com duas empresas.

