CREATE TABLE public.empresa_contas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_bancaria_id uuid NOT NULL REFERENCES public.contas_bancarias(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, conta_bancaria_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_contas_bancarias TO authenticated;
GRANT ALL ON public.empresa_contas_bancarias TO service_role;

ALTER TABLE public.empresa_contas_bancarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages empresa_contas_bancarias"
  ON public.empresa_contas_bancarias
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_empresa_conta_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    SELECT owner_id INTO NEW.owner_id FROM public.empresas WHERE id = NEW.empresa_id;
    IF NEW.owner_id IS NULL THEN NEW.owner_id := auth.uid(); END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_set_empresa_conta_owner
  BEFORE INSERT ON public.empresa_contas_bancarias
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_conta_owner();

CREATE INDEX idx_empresa_contas_bancarias_empresa ON public.empresa_contas_bancarias(empresa_id);
CREATE INDEX idx_empresa_contas_bancarias_conta ON public.empresa_contas_bancarias(conta_bancaria_id);

-- Seed junction from existing empresas.conta_bancaria_id
INSERT INTO public.empresa_contas_bancarias (owner_id, empresa_id, conta_bancaria_id)
SELECT e.owner_id, e.id, e.conta_bancaria_id
FROM public.empresas e
WHERE e.conta_bancaria_id IS NOT NULL
ON CONFLICT (empresa_id, conta_bancaria_id) DO NOTHING;