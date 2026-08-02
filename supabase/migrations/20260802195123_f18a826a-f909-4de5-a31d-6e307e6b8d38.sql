-- 1) Missões: status agora é texto livre validado (ativo | concluido)
ALTER TABLE public.missoes
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.missoes
  ALTER COLUMN status TYPE text USING status::text;

UPDATE public.missoes SET status = 'concluido' WHERE status <> 'ativo';

ALTER TABLE public.missoes
  ALTER COLUMN status SET DEFAULT 'ativo';

ALTER TABLE public.missoes
  ADD CONSTRAINT missoes_status_check CHECK (status IN ('ativo','concluido'));

-- 2) Empresas: endereço e sócios
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS socios jsonb NOT NULL DEFAULT '[]'::jsonb;