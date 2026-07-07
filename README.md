# GestMan365 React

Base profissional modular para evoluir o GestMan365 em React, TypeScript e Supabase.

Esta pasta nao altera o sistema HTML atual publicado no GitHub Pages. Ela prepara a futura arquitetura escalavel.

## Pastas principais

- `components/`: componentes reutilizaveis de UI, layout, seguranca e navegacao.
- `pages/`: telas dos modulos do sistema.
- `services/`: acesso a Supabase e regras de persistencia externa.
- `hooks/`: hooks de acesso aos contextos e permissoes.
- `types/`: tipos compartilhados do dominio CMMS/EAM.
- `contexts/`: estado global de autenticacao e multiempresa.
- `utils/`: helpers, rotas, navegacao e controle de permissoes.

## Comandos

```bash
npm install
npm run dev
npm run build
```

## Perfis base

- Administrador
- Supervisor
- Planejador
- Tecnico
- Solicitante

## Modulos base

- Dashboard
- Ativos
- Solicitacoes
- Ordens de Servico
- PCM
- Relatorios
- Administracao
