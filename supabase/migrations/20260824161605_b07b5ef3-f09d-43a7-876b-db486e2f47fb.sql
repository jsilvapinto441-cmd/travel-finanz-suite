CREATE TABLE public.despesa_rateios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  despesa_id uuid NOT NULL REFERENCES public.despesas(id) ON DELETE CASCADE,
  missao_id uuid NOT NULL REFERENCES public.missoes(id) ON DELETE CASCADE,
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (despesa_id, missao_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesa_rateios TO authenticated;
GRANT ALL ON public.despesa_rateios TO service_role;

ALTER TABLE public.despesa_rateios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own despesa_rateios"
ON public.despesa_rateios FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.inherit_owner_despesa_rateios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    SELECT owner_id INTO NEW.owner_id FROM public.despesas WHERE id = NEW.despesa_id;
    IF NEW.owner_id IS NULL THEN NEW.owner_id := auth.uid(); END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_inherit_owner_despesa_rateios
BEFORE INSERT ON public.despesa_rateios
FOR EACH ROW EXECUTE FUNCTION public.inherit_owner_despesa_rateios();

CREATE TRIGGER trg_despesa_rateios_updated
BEFORE UPDATE ON public.despesa_rateios
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_despesa_rateios_despesa ON public.despesa_rateios(despesa_id);
CREATE INDEX idx_despesa_rateios_missao ON public.despesa_rateios(missao_id);