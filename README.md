# GestMan365

Sistema web inicial para gestao de manutencao, ativos e chamados, conectado ao Supabase.

## Arquivos

- `index.html`: tela inicial do sistema conectada ao Supabase.
- `supabase-setup.sql`: cria as tabelas iniciais no Supabase.
- `ESCOPO.md`: escopo inicial do sistema.

## Como configurar o Supabase

1. Abra seu projeto no Supabase.
2. Va em `SQL Editor`.
3. Clique em `New query`.
4. Cole o conteudo do arquivo `supabase-setup.sql`.
5. Clique em `Run`.

## Como abrir o sistema

Depois de rodar o SQL, abra o arquivo `index.html` no navegador.

O arquivo ja esta configurado com:

```env
NEXT_PUBLIC_SUPABASE_URL=https://zkkyiqtzmimcoderjrrm.supabase.co
```

## Como subir no GitHub pelo site

1. Crie um repositorio no GitHub chamado `gestman365`.
2. Clique em `Add file`.
3. Clique em `Upload files`.
4. Envie estes arquivos:
   - `index.html`
   - `supabase-setup.sql`
   - `ESCOPO.md`
   - `README.md`
5. Clique em `Commit changes`.

## Observacao de seguranca

Este projeto usa a chave publica do Supabase no navegador. Isso e normal para prototipos e apps com Row Level Security.

Nao coloque no GitHub:

- Senha do banco.
- Secret key.
- Service role key.
- Tokens pessoais.
