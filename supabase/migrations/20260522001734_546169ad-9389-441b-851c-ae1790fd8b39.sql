ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS data_admissao DATE,
  ADD COLUMN IF NOT EXISTS encargos_auto BOOLEAN NOT NULL DEFAULT true;