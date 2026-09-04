-- ETAPA 1 — EXTENSÕES
-- Espelha exatamente as extensões instaladas no banco atual.
-- (plpgsql e supabase_vault já vêm instalados em projetos Supabase novos.)

CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS pgcrypto        WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"     WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;

-- pg_net está instalado no schema public no banco de origem (mantido igual).
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;

-- pg_cron: só é possível no schema pg_catalog e requer plano/permite do provedor.
-- Se o destino não suportar pg_cron, pule esta linha e agende o backup por outro meio
-- (ver etapa 9).
CREATE EXTENSION IF NOT EXISTS pg_cron;
