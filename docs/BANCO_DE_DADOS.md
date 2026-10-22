# Banco de dados

PostgreSQL gerenciado pelo Lovable Cloud (Supabase). O histórico completo está em `supabase/migrations/`, e uma versão consolidada para recriar o banco em outro projeto está em `supabase/migracao-externa/`.

[Voltar ao README](../README.md)

## Tabelas

| Grupo | Tabelas |
|-------|---------|
| Usuários e acesso | `profiles`, `user_roles`, `user_active_sessions` |
| Estrutura | `empresas`, `contas_bancarias`, `empresa_contas_bancarias`, `missoes` |
| Parceiros | `funcionarios`, `prestadores_mei`, `consolidadoras`, `fornecedores` |
| Financeiro | `contratos`, `recebiveis`, `recebivel_abatimentos`, `despesas`, `despesa_rateios`, `registros_pagamento`, `movimentacoes_financeiras` |
| Arquivos e histórico | `anexos`, `activity_logs` |
| Backup | `backups`, `backup_jobs`, `backup_schedules` |
| Assistente de IA | `ai_threads`, `ai_messages` |

## Relacionamentos principais

```text
empresas ──< empresa_contas_bancarias >── contas_bancarias
    │
    ├──< contratos ──< recebiveis ──< recebivel_abatimentos
    │                      │
    └──< despesas ──< despesa_rateios >── missoes
              │            
              └──────┬─────┘
                     ▼
            registros_pagamento ──> movimentacoes_financeiras
```

## Regras implementadas no banco

- **Isolamento por usuário:** os registros têm `owner_id`, e as políticas RLS permitem acesso apenas aos dados do próprio usuário.
- **Perfis de acesso:** enum `app_role` (`admin`, `financeiro`, `viewer`) na tabela `user_roles`, verificado pela função `has_role`. Um gatilho em `auth.users` cria o perfil e torna administrador o primeiro usuário.
- **Gatilhos:** preenchem `owner_id` e datas de atualização, geram parcelas, recalculam valores pagos, status e total de abatimentos.
- **Coluna calculada:** `contratos.valor_saldo` (não pode receber valor em `INSERT`).
- **Enums:** status, categorias e formas de pagamento (inclui `debito_em_conta`).

## Armazenamento de arquivos

Buckets privados `anexos`, `avatars` e `backups`. Os arquivos ficam em `<id-do-usuario>/...`, e as políticas permitem acesso apenas à pasta do próprio usuário.

## Agendamentos

O `pg_cron` chama periodicamente o endpoint `/api/public/hooks/backup-cron`, que executa os backups agendados e aplica a retenção.

## Recriar o banco

Siga o [guia de migração](../supabase/migracao-externa/README.md): ordem de execução dos scripts, importação de dados preservando IDs e checklist de validação.
