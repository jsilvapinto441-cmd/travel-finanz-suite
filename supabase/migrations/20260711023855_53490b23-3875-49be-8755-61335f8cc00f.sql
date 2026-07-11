
-- Padronizar fornecedores, prestadores_mei e consolidadoras com os mesmos campos
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valor_contratado numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS banco text;

ALTER TABLE public.prestadores_mei
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.consolidadoras
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS email text;

-- Copiar 'documento' para 'cnpj' quando cnpj estiver vazio (compatibilidade)
UPDATE public.prestadores_mei SET cnpj = documento WHERE cnpj IS NULL AND documento IS NOT NULL;
UPDATE public.consolidadoras SET cnpj = documento WHERE cnpj IS NULL AND documento IS NOT NULL;
