# Migração do banco Rotas para um Supabase externo

Pacote gerado a partir da estrutura **real e atual** do banco em produção.
Nada aqui altera o banco de origem: são apenas scripts para criar uma cópia fiel no destino.

## Ordem de execução

Rode os arquivos **nesta sequência**, um por vez, no SQL Editor do projeto de destino:

| # | Arquivo | O que faz |
|---|---------|-----------|
| 1 | `01_extensoes.sql` | Extensões (pgcrypto, uuid-ossp, pg_net, pg_cron, pg_stat_statements) |
| 2 | `02_tipos_enums.sql` | 7 tipos ENUM |
| 3 | `03_tabelas.sql` | 25 tabelas + permissões (GRANT) |
| 4 | `04_constraints_fks.sql` | Chaves primárias, únicas, validações e relacionamentos |
| 5 | `05_indices.sql` | 47 índices de desempenho |
| 6 | `06_funcoes.sql` | 27 funções (parcelas, status, rateio, abatimentos, backup) |
| 7 | `07_triggers.sql` | Gatilhos automáticos |
| 8 | `08_rls_policies.sql` | Segurança por linha (cada login vê só os próprios dados) |
| 9 | `09_storage_agendamentos.sql` | Buckets de arquivos, políticas de acesso e agendamento do backup |

Se algum script falhar no meio, corrija a causa e rode **somente** o que faltou —
não repita etapas já concluídas (os `CREATE` não são idempotentes, exceto onde indicado).

## Antes de começar

1. Crie o projeto no Supabase de destino e anote URL, chave pública e chave de serviço.
2. Em **Authentication → Providers**, habilite E-mail/Senha e, se usar, o Google.
3. Em **Authentication → URL Configuration**, informe a URL do site e as URLs de redirecionamento
   (inclua `/reset-password`).
4. Confirmação de e-mail: mantenha a mesma configuração usada hoje.

## Importação de dados (preservando os IDs)

A ordem de inserção importa por causa dos relacionamentos:

1. `auth.users` (via export/import do Auth ou API Admin) — **os UUIDs dos usuários precisam ser os mesmos**,
   pois todo o isolamento de dados usa `owner_id = id do usuário`.
2. `profiles`, `user_roles`
3. `contas_bancarias`, `empresas`, `empresa_contas_bancarias`, `missoes`
4. `consolidadoras`, `prestadores_mei`, `fornecedores`, `funcionarios`
5. `contratos`, `recebiveis`, `recebivel_abatimentos`
6. `despesas`, `despesa_rateios`
7. `registros_pagamento`, `movimentacoes_financeiras`
8. `anexos`, `activity_logs`, `backups`, `backup_jobs`, `backup_schedules`, `ai_threads`, `ai_messages`

Durante a carga, desative os gatilhos para não gerar parcelas/movimentações duplicadas:

```sql
SET session_replication_role = 'replica';
-- ... seus INSERTs ...
SET session_replication_role = 'origin';
```

Colunas geradas automaticamente **não podem ser inseridas** — omita `contratos.valor_saldo` nos INSERTs.
Arquivos do Storage (pastas `anexos/`, `avatars/`, `backups/`) precisam ser copiados
mantendo o caminho `<id-do-usuario>/...`, senão as regras de acesso bloqueiam o download.

## Pontos que exigem sua atenção

- **pg_cron / pg_net**: o backup automático depende dessas extensões. Se o plano do destino não
  as oferecer, use um agendador externo chamando `POST /api/public/hooks/backup-cron`
  com o header `apikey` (instruções no arquivo 9).
- **Gatilho em `auth.users`**: `on_auth_user_created` cria o perfil no primeiro login.
  Alguns projetos exigem rodar esse comando com o papel `postgres` no SQL Editor.
- **Gatilhos duplicados em `registros_pagamento`**: existem dois gatilhos que chamam a mesma
  função de recálculo no banco atual. Foram mantidos por fidelidade e não causam soma dupla
  (a função recalcula o total, não incrementa). Se preferir, remova `trg_recalc_valor_pago_ins`.
- **`guard_parcela_imutavel_recebiveis`**: a função existe, mas o gatilho está desativado
  de propósito (recebíveis são totalmente editáveis). Não recrie esse gatilho.
- **Permissões amplas nas tabelas**: os papéis `anon`/`authenticated` têm privilégios em todas as
  tabelas; quem controla o acesso de verdade são as regras da etapa 8. Mantenha as duas coisas.
- **`status_generico`**: enum existente no banco, hoje sem uso por nenhuma coluna. Mantido por fidelidade.
- **Extensão `pg_net` no schema `public`**: replicado igual à origem para evitar quebra de chamadas.

## Depois de migrar — checklist de validação

```sql
-- 25 tabelas
SELECT count(*) FROM pg_tables WHERE schemaname='public';
-- 7 enums
SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
 WHERE n.nspname='public' AND t.typtype='e';
-- 47 índices próprios (fora PK/UNIQUE)
SELECT count(*) FROM pg_indexes WHERE schemaname='public'
 AND indexname NOT IN (SELECT conname FROM pg_constraint);
-- RLS ativo em todas as tabelas (deve retornar 0 linhas)
SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity;
-- Tabelas sem nenhuma política (deve retornar 0 linhas)
SELECT t.tablename FROM pg_tables t LEFT JOIN pg_policies p
  ON p.schemaname=t.schemaname AND p.tablename=t.tablename
 WHERE t.schemaname='public' AND p.policyname IS NULL GROUP BY 1;
```

Testes funcionais recomendados, já com um usuário real logado:

1. Criar empresa, missão e conta bancária.
2. Criar contrato com entrada e 3 parcelas → conferir se os recebíveis foram gerados.
3. Lançar abatimento em um recebível → conferir valor líquido e status.
4. Dar baixa parcial e total → conferir status, saldo e movimentação bancária.
5. Criar despesa parcelada com rateio entre duas missões → conferir filtros e relatórios.
6. Gerar backup, baixar e restaurar.
7. Enviar um anexo e um avatar → conferir upload e download.
