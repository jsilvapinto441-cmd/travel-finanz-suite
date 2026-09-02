CREATE TABLE public.recebivel_abatimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  recebivel_id uuid NOT NULL REFERENCES public.recebiveis(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'reembolso',
  valor numeric NOT NULL DEFAULT 0,
  descricao text,
  data_abatimento date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recebivel_abatimentos TO authenticated;
GRANT ALL ON public.recebivel_abatimentos TO service_role;

ALTER TABLE public.recebivel_abatimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own abatimentos"
  ON public.recebivel_abatimentos FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_recebivel_abatimentos_recebivel ON public.recebivel_abatimentos(recebivel_id);

ALTER TABLE public.recebiveis
  ADD COLUMN IF NOT EXISTS total_abatimentos numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.inherit_owner_recebivel_abatimentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    SELECT owner_id INTO NEW.owner_id FROM public.recebiveis WHERE id = NEW.recebivel_id;
    IF NEW.owner_id IS NULL THEN NEW.owner_id := auth.uid(); END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_inherit_owner_recebivel_abatimentos
BEFORE INSERT ON public.recebivel_abatimentos
FOR EACH ROW EXECUTE FUNCTION public.inherit_owner_recebivel_abatimentos();

CREATE TRIGGER trg_recebivel_abatimentos_updated
BEFORE UPDATE ON public.recebivel_abatimentos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.recalc_total_abatimentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE rid uuid; total numeric;
BEGIN
  rid := COALESCE(NEW.recebivel_id, OLD.recebivel_id);
  IF rid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT COALESCE(SUM(valor), 0) INTO total
    FROM public.recebivel_abatimentos WHERE recebivel_id = rid;
  UPDATE public.recebiveis SET total_abatimentos = total WHERE id = rid;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_recalc_total_abatimentos
AFTER INSERT OR UPDATE OR DELETE ON public.recebivel_abatimentos
FOR EACH ROW EXECUTE FUNCTION public.recalc_total_abatimentos();

CREATE OR REPLACE FUNCTION public.compute_status_recebivel()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE valor_parc numeric;
BEGIN
  IF NEW.status = 'cancelado' THEN RETURN NEW; END IF;
  valor_parc := GREATEST(
    COALESCE(NEW.valor_parcela, NEW.valor_total, 0) - COALESCE(NEW.total_abatimentos, 0),
    0
  );
  IF COALESCE(NEW.valor_pago, 0) >= valor_parc AND valor_parc > 0 THEN
    NEW.status := 'pago';
    IF NEW.data_recebimento IS NULL THEN NEW.data_recebimento := CURRENT_DATE; END IF;
  ELSIF COALESCE(NEW.valor_pago, 0) > 0 THEN
    NEW.status := 'parcial';
  ELSIF NEW.data_vencimento IS NOT NULL AND NEW.data_vencimento < CURRENT_DATE THEN
    NEW.status := 'atrasado';
  ELSE
    NEW.status := 'em_aberto';
  END IF;
  RETURN NEW;
END $$;