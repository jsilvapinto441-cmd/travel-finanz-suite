# Arquitetura

[Voltar ao README](../README.md)

## Visão geral

```text
┌──────────────────────────────┐
│ Navegador (React 19 + PWA)   │
│  TanStack Router / Query     │
│  Tailwind + shadcn/ui        │
└──────┬───────────────┬───────┘
       │ supabase-js   │ funções de servidor / endpoints
       │ (RLS)         ▼
       │     ┌───────────────────────────────┐
       │     │ Servidor TanStack Start       │
       │     │ (ambiente Cloudflare Workers) │
       │     │  createServerFn  /api/*       │
       │     └──────┬───────────────┬────────┘
       ▼            ▼               ▼
┌──────────────────────────┐  ┌──────────────────┐
│ Lovable Cloud (Supabase) │  │ Lovable AI       │
│ PostgreSQL + RLS, Auth,  │  │ Gateway          │
│ Storage, Realtime,       │  │ (chat, extração, │
│ pg_cron                  │  │  transcrição)    │
└──────────────────────────┘  └──────────────────┘
```

## Camadas

| Camada | Local | Responsabilidade |
|--------|-------|------------------|
| Rotas e telas | `src/routes/` | Uma rota por arquivo. `_app.tsx` protege as telas internas e redireciona para `/login` sem sessão. |
| Componentes | `src/components/` | Interface reutilizável (tabelas, filtros, formulários, diálogos de pagamento, rateio, abatimentos, anexos, backup). |
| Regras de negócio | `src/lib/` | Cálculos financeiros, filtros de relatório, ordenação, exportação, validação de datas, exclusão segura, auditoria. |
| Servidor | `src/lib/*.functions.ts`, `src/lib/*.server.ts`, `src/routes/api/` | Administração de usuários, backup/restauração e IA. |
| Integração com o banco | `src/integrations/supabase/` | Clientes do navegador e do servidor, tipos gerados e middleware de autenticação. |

## Fluxo de dados

- **Leitura e escrita comuns:** o navegador usa o cliente do banco com o token do usuário. As regras de segurança por linha (RLS) limitam o acesso aos dados do próprio usuário.
- **Operações privilegiadas** (gestão de usuários, backup e restauração): funções de servidor (`createServerFn`) exigem usuário autenticado (`requireSupabaseAuth`) e verificam permissões antes de usar o cliente administrativo.
- **Cache:** TanStack Query, invalidado quando a sessão muda.
- **Tempo real:** inscrição no Realtime para atualizar as telas quando os dados mudam em outro dispositivo (`src/lib/use-realtime-sync.ts`).

## Autenticação e autorização

- E-mail e senha, com recuperação de senha (fluxos PKCE e implícito em `src/routes/reset-password.tsx`).
- Perfis em uma tabela separada (`user_roles`), consultados pela função `has_role` nas políticas do banco. Os perfis nunca vêm de dados editáveis pelo usuário.
- Funções de servidor recebem o token por um middleware de cliente registrado em `src/start.ts`.
- Saída automática por inatividade (`src/lib/idle-timeout.ts`).

## Endpoints HTTP

| Rota | Descrição | Proteção |
|------|-----------|----------|
| `POST /api/ai-chat` | Chat do assistente com acesso aos dados do usuário | Token do usuário |
| `POST /api/ai-extract` | Extração estruturada de registros de arquivos/texto | Token do usuário |
| `POST /api/ai-transcribe` | Transcrição de áudio | Token do usuário |
| `POST /api/public/hooks/backup-cron` | Executa backups agendados (chamado pelo `pg_cron`) | Header `apikey` |
| `GET /api/public/version` | Versão publicada, usada para atualização automática | Público |
| `/mcp` | Servidor MCP com ferramentas de consulta (empresas, missões, despesas, recebíveis, resumo) | OAuth |

## Integrações

- **Lovable AI Gateway** — API compatível com OpenAI para chat, extração (modelo Gemini) e transcrição de áudio. Chave apenas no servidor (`LOVABLE_API_KEY`).
- **MCP** — `src/lib/mcp/` expõe ferramentas de leitura para clientes de IA compatíveis, autenticadas por OAuth.

## Build e execução

- Vite 7 com a configuração `@lovable.dev/vite-tanstack-config`, que já inclui TanStack Start, React, Tailwind, aliases de caminho e o plugin Cloudflare.
- `src/server.ts` é a entrada do servidor e mostra uma página de erro própria em falhas de renderização.
- Erros de carregamento de módulos após uma nova publicação recarregam a página automaticamente, uma vez.

## Convenções

- Interface e mensagens em português do Brasil.
- Cores, sombras e fontes definidas como tokens em `src/styles.css` (identidade preto e laranja, fontes Sora e Manrope).
- `src/routeTree.gen.ts` e `src/integrations/supabase/types.ts` são gerados automaticamente e não devem ser editados à mão.
